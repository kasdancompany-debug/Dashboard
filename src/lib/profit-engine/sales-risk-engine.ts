import { SalesDeal, SalesSummary } from "@/src/lib/types/dealership";
import { AtRiskDeal, DepartmentHealth, HealthStatus, ProfitLeak, Severity } from "@/src/lib/profit-engine/types";

const toSeverity = (score: number): Severity => (score >= 70 ? "high" : score >= 40 ? "medium" : "low");

const toHealthStatus = (pace: number): HealthStatus => {
  if (pace >= 100) return "ahead";
  if (pace >= 92) return "on-track";
  return "at-risk";
};

export function buildSalesAtRiskDeals(input: {
  salesDeals: SalesDeal[];
  salesSummary: SalesSummary;
  limit?: number;
}): AtRiskDeal[] {
  const { salesDeals, salesSummary, limit = 10 } = input;
  return getTopAtRiskDeals(salesDeals, limit, {
    frontAverage: salesSummary.frontAverage,
    backAverage: salesSummary.backAverage,
  });
}

const missingSignal = (value: string | null | undefined) => !value || /(TBD|NT|N\/A|NA|UNKNOWN)/i.test(value);

function scoreDeal(
  deal: SalesDeal,
  context: {
    weakBySalesperson: Map<string, number>;
    weakByManager: Map<string, number>;
    frontAverage: number;
    backAverage: number;
  },
): AtRiskDeal {
  const reasons: string[] = [];
  let score = 0;
  let recoverable = 0;

  if (deal.frontGross < 0) {
    score += 30;
    reasons.push("Front gross is negative");
    recoverable += Math.abs(deal.frontGross) + 1500;
  } else if (deal.frontGross < 1000) {
    score += 18;
    reasons.push("Front gross is below $1,000");
    recoverable += 1000 - deal.frontGross;
  }

  if (deal.totalGross === 0) {
    score += 28;
    reasons.push("Total gross is zero");
    recoverable += Math.max(context.frontAverage + context.backAverage, 2500);
  }

  if (deal.dealType === "used" && deal.frontGross < 1500) {
    score += 12;
    reasons.push("Used vehicle has weak front gross");
    recoverable += Math.max(0, 1500 - deal.frontGross);
  }

  const backCarryRatio = deal.backGross / Math.max(1, Math.abs(deal.totalGross));
  if (backCarryRatio >= 0.75 && deal.frontGross < context.frontAverage * 0.8) {
    score += 10;
    reasons.push("Back gross is carrying most of total gross");
    recoverable += Math.max(0, context.frontAverage - Math.max(0, deal.frontGross)) * 0.5;
  }

  const hasTrade = !!deal.tradeVehicle;
  if (hasTrade && deal.acv <= 0) {
    score += 10;
    reasons.push("Missing or TBD ACV");
    recoverable += 750;
  }
  if (hasTrade && deal.tradeRetail <= 0) {
    score += 10;
    reasons.push("Missing or TBD trade retail");
    recoverable += 750;
  }

  if (deal.status === "incoming" || deal.status === "preorder") {
    score += 8;
    reasons.push("Incoming or preorder status may slip close timing");
    recoverable += 600;
  }

  const isCashDeal = deal.estimatedTerm <= 0 || /cash/i.test(deal.notes);
  if (isCashDeal && deal.totalGross < 1500) {
    score += 9;
    reasons.push("Cash deal with low total gross");
    recoverable += Math.max(0, 2000 - deal.totalGross);
  }

  if (missingSignal(deal.stockNumber) || missingSignal(deal.businessManager) || missingSignal(deal.notes)) {
    score += 8;
    reasons.push("Missing/TBD critical fields");
    recoverable += 500;
  }

  const spWeak = context.weakBySalesperson.get(deal.salesperson) ?? 0;
  if (spWeak >= 3) {
    score += 7;
    reasons.push("Salesperson concentration of weak deals");
  }
  const mgrWeak = context.weakByManager.get(deal.manager) ?? 0;
  if (mgrWeak >= 4) {
    score += 7;
    reasons.push("Manager concentration of weak deals");
  }

  const riskScore = Math.max(0, Math.min(100, Math.round(score)));
  const riskLevel = toSeverity(riskScore);
  const recommendedAction =
    riskLevel === "high"
      ? "Escalate to desk manager now; re-structure gross before funding."
      : riskLevel === "medium"
        ? "Review desk terms and fix missing fields before delivery."
        : "Monitor and complete standard manager review.";

  return {
    dealId: deal.id,
    customer: deal.customer,
    vehicle: deal.vehicle,
    salesperson: deal.salesperson,
    manager: deal.manager,
    businessManager: deal.businessManager,
    frontGross: deal.frontGross,
    backGross: deal.backGross,
    totalGross: deal.totalGross,
    riskScore,
    riskLevel,
    reasons: reasons.length ? reasons : ["No material risk signals"],
    recommendedAction,
    estimatedRecoverableGross: Math.max(0, Math.round(recoverable)),
  };
}

export function getTopAtRiskDeals(
  deals: SalesDeal[],
  limit = 10,
  benchmarks?: { frontAverage?: number; backAverage?: number },
): AtRiskDeal[] {
  const weakDealPredicate = (deal: SalesDeal) =>
    deal.frontGross < 1000 ||
    deal.frontGross < 0 ||
    deal.totalGross <= 0 ||
    (deal.dealType === "used" && deal.frontGross < 1500);

  const weakBySalesperson = new Map<string, number>();
  const weakByManager = new Map<string, number>();
  for (const deal of deals) {
    if (!weakDealPredicate(deal)) continue;
    weakBySalesperson.set(deal.salesperson, (weakBySalesperson.get(deal.salesperson) ?? 0) + 1);
    weakByManager.set(deal.manager, (weakByManager.get(deal.manager) ?? 0) + 1);
  }

  const context = {
    weakBySalesperson,
    weakByManager,
    frontAverage: benchmarks?.frontAverage ?? 3000,
    backAverage: benchmarks?.backAverage ?? 1600,
  };

  return deals
    .map((deal) => scoreDeal(deal, context))
    .filter((deal) => deal.riskScore >= 35)
    .sort((a, b) => b.riskScore - a.riskScore || b.estimatedRecoverableGross - a.estimatedRecoverableGross)
    .slice(0, limit);
}

export function buildSalesHealth(salesSummary: SalesSummary): DepartmentHealth {
  const pacePercent = Math.round((salesSummary.totalGross / Math.max(1, salesSummary.targetGross)) * 100);
  return {
    department: "Sales",
    status: toHealthStatus(pacePercent),
    score: Math.max(40, Math.min(98, pacePercent)),
    summary: `${salesSummary.totalUnits}/${salesSummary.targetUnits} units with per-copy $${salesSummary.perCopy.toLocaleString()}.`,
    actual: salesSummary.totalGross,
    target: salesSummary.targetGross,
    pacePercent,
  };
}

export function buildSalesLeakSignals(input: {
  salesDeals: SalesDeal[];
  salesSummary: SalesSummary;
}): ProfitLeak[] {
  const { salesDeals, salesSummary } = input;
  const leaks: ProfitLeak[] = [];

  const grossGap = Math.max(0, salesSummary.targetGross - salesSummary.totalGross);
  if (grossGap > 0) {
    leaks.push({
      department: "Sales",
      title: "Front-end gross below target pace",
      severity: grossGap >= 70000 ? "high" : "medium",
      dollarImpact: grossGap,
      cause: "Used mix and sub-threshold front-end structures are diluting gross quality.",
      ownerRole: "Sales Managers",
      recommendedAction: "Escalate low-front deals before funding and enforce desk minimums.",
      confidence: grossGap >= 70000 ? "high" : "medium",
    });
  }

  const zeroOrNegativeDeals = salesDeals.filter((d) => d.totalGross <= 0).length;
  if (zeroOrNegativeDeals > 0) {
    const impact = zeroOrNegativeDeals * Math.max(2500, Math.round(salesSummary.perCopy * 0.6));
    leaks.push({
      department: "Sales",
      title: "Zero/negative gross deal structures",
      severity: zeroOrNegativeDeals >= 3 ? "high" : "medium",
      dollarImpact: impact,
      cause: `${zeroOrNegativeDeals} deals currently carry zero or negative total gross.`,
      ownerRole: "Sales Managers",
      recommendedAction: "Run same-day exception review with manager sign-off.",
      confidence: zeroOrNegativeDeals >= 3 ? "high" : "medium",
    });
  }

  return leaks;
}
