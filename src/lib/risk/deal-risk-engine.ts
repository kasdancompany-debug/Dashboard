import { SalesDeal } from "@/src/lib/types/dealership";

export type DealRiskLevel = "low" | "medium" | "high";

export type DealRiskAssessment = {
  score: number;
  level: DealRiskLevel;
  reasons: string[];
  recommendedAction: string;
};

export type DealRiskBenchmarks = {
  frontAverage: number;
  backAverage: number;
};

const containsMissingSignal = (value: string | null | undefined) =>
  !!value && /(TBD|NT)/i.test(value);

export function assessDealRisk(
  deal: SalesDeal,
  benchmarks: DealRiskBenchmarks,
): DealRiskAssessment {
  const reasons: string[] = [];
  let score = 0;

  // 1) Front gross vs average benchmark
  if (deal.frontGross <= 0) {
    score += 35;
    reasons.push("Zero or negative front gross");
  } else if (deal.frontGross < benchmarks.frontAverage * 0.6) {
    score += 22;
    reasons.push("Front gross materially below average");
  } else if (deal.frontGross < benchmarks.frontAverage * 0.85) {
    score += 12;
    reasons.push("Front gross below average");
  }

  // 2) Back-gross dependency ratio
  const backDependency =
    deal.totalGross !== 0 ? deal.backGross / Math.max(1, Math.abs(deal.totalGross)) : 0;
  if (backDependency > 0.9 && deal.frontGross < benchmarks.frontAverage * 0.7) {
    score += 18;
    reasons.push("Deal relies heavily on back gross");
  } else if (backDependency > 0.7) {
    score += 10;
    reasons.push("Back gross dependency elevated");
  }

  // 3) Missing data (TBD, NT)
  if (
    containsMissingSignal(deal.stockNumber) ||
    containsMissingSignal(deal.businessManager) ||
    containsMissingSignal(deal.notes)
  ) {
    score += 18;
    reasons.push("Missing/TBD data fields");
  }

  // 4) Trade margin quality
  if (deal.tradeVehicle && deal.acv > 0) {
    const tradeMargin = deal.tradeRetail - deal.acv;
    if (tradeMargin < 0) {
      score += 12;
      reasons.push("Negative trade margin");
    } else if (tradeMargin < 1000) {
      score += 6;
      reasons.push("Thin trade margin");
    }
  }

  // 5) Deal structure stressors
  if (deal.estimatedTerm >= 84) {
    score += 6;
    reasons.push("Long finance term");
  }
  if (deal.status === "pending" || deal.status === "incoming" || deal.status === "preorder") {
    score += 8;
    reasons.push("Deal not finalized");
  }
  if (deal.backGross > benchmarks.backAverage * 1.5 && deal.frontGross < benchmarks.frontAverage * 0.7) {
    score += 8;
    reasons.push("Back-heavy structure with weak front");
  }

  const normalized = Math.max(0, Math.min(100, Math.round(score)));
  const level: DealRiskLevel =
    normalized >= 65 ? "high" : normalized >= 35 ? "medium" : "low";

  const recommendedAction =
    level === "high"
      ? "Escalate to desk manager before funding and validate gross structure."
      : level === "medium"
        ? "Review gross mix, missing fields, and lender structure before delivery."
        : "Standard desk review; no immediate intervention required.";

  return {
    score: normalized,
    level,
    reasons: reasons.length > 0 ? reasons : ["No material risk signals"],
    recommendedAction,
  };
}

export function assessSalesDealsRisk(
  deals: SalesDeal[],
  benchmarks: DealRiskBenchmarks,
) {
  return deals.map((deal) => ({
    deal,
    risk: assessDealRisk(deal, benchmarks),
  }));
}
