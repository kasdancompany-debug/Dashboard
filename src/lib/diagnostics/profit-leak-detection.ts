import { PartsSummary, SalesDeal, SalesSummary, ServiceSummary } from "@/src/lib/types/dealership";

export type ProfitLeakFinding = {
  department: "Sales" | "Service" | "Parts";
  issue: string;
  impact: string;
  cause: string;
  recommendation: string;
  confidence: "low" | "medium" | "high";
  impactValue: number;
};

const dollars = (value: number) => `$${Math.round(value).toLocaleString()}`;

export function detectProfitLeaks(input: {
  salesDeals: SalesDeal[];
  salesSummary: SalesSummary;
  serviceSummary: ServiceSummary;
  partsSummary: PartsSummary;
}): ProfitLeakFinding[] {
  const { salesDeals, salesSummary, serviceSummary, partsSummary } = input;
  const findings: ProfitLeakFinding[] = [];

  // Sales leak: front-end shortfall vs target
  const salesFrontShortfall = Math.max(salesSummary.targetGross - salesSummary.totalGross, 0);
  if (salesFrontShortfall > 0) {
    findings.push({
      department: "Sales",
      issue: "Front-end gross below expected threshold",
      impact: `${dollars(salesFrontShortfall)} below target pace`,
      cause: "Used deal mix and low-front structures are reducing gross quality.",
      recommendation: "Escalate low-front desked deals and enforce front-end thresholds before funding.",
      confidence: salesFrontShortfall > 60000 ? "high" : "medium",
      impactValue: salesFrontShortfall,
    });
  }

  // Sales category drag: zero/negative-gross deals
  const zeroOrNegativeCount = salesDeals.filter((d) => d.totalGross <= 0).length;
  if (zeroOrNegativeCount > 0) {
    const impliedLeak = zeroOrNegativeCount * Math.max(2500, Math.round(salesSummary.perCopy * 0.6));
    findings.push({
      department: "Sales",
      issue: "Zero/negative-gross deal structures",
      impact: `${dollars(impliedLeak)} implied gross leakage risk`,
      cause: `${zeroOrNegativeCount} deals currently show zero or negative gross.`,
      recommendation: "Run same-day exception review and require manager override documentation.",
      confidence: zeroOrNegativeCount >= 3 ? "high" : "medium",
      impactValue: impliedLeak,
    });
  }

  // Service leak: gross below forecast threshold
  const serviceGrossGap = Math.max(serviceSummary.forecastGross - serviceSummary.totalGross, 0);
  if (serviceGrossGap > 0) {
    findings.push({
      department: "Service",
      issue: "Service gross under forecast",
      impact: `${dollars(serviceGrossGap)} below forecast`,
      cause: "CP labour performance remains below daily objective.",
      recommendation: "Rebalance advisor load and push high-value maintenance closes in peak blocks.",
      confidence: serviceGrossGap > 12000 ? "high" : "medium",
      impactValue: serviceGrossGap,
    });
  }

  // Parts leak: category mix and forecast gap
  const partsGrossGap = Math.max(partsSummary.forecastGross - partsSummary.totalGross, 0);
  if (partsGrossGap > 0) {
    findings.push({
      department: "Parts",
      issue: "Parts gross below forecast",
      impact: `${dollars(partsGrossGap)} below forecast`,
      cause: "Category mix and special-order execution are suppressing margin conversion.",
      recommendation: "Prioritize top SKU replenishment and audit margin exceptions today.",
      confidence: partsGrossGap > 5000 ? "high" : "medium",
      impactValue: partsGrossGap,
    });
  }

  const internalMix = partsSummary.internalSales / Math.max(1, partsSummary.totalSales);
  if (internalMix > 0.28) {
    const mixImpact = Math.round(partsSummary.totalGross * 0.07);
    findings.push({
      department: "Parts",
      issue: "Internal-heavy sales mix dragging margin",
      impact: `${dollars(mixImpact)} estimated margin opportunity`,
      cause: `Internal mix is ${(internalMix * 100).toFixed(1)}%, reducing retail-margin capture.`,
      recommendation: "Shift advisor/counter focus to customer-pay pull-through on deferred maintenance.",
      confidence: "medium",
      impactValue: mixImpact,
    });
  }

  return findings.sort((a, b) => b.impactValue - a.impactValue);
}
