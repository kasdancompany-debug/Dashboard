import { PartsSummary } from "@/src/lib/types/dealership";
import { DepartmentHealth, HealthStatus, ProfitLeak } from "@/src/lib/profit-engine/types";

const toHealthStatus = (pace: number): HealthStatus => {
  if (pace >= 100) return "ahead";
  if (pace >= 94) return "on-track";
  return "at-risk";
};

export function buildPartsHealth(partsSummary: PartsSummary): DepartmentHealth {
  const pacePercent = Math.round((partsSummary.totalGross / Math.max(1, partsSummary.forecastGross)) * 100);
  return {
    department: "Parts",
    status: toHealthStatus(pacePercent),
    score: Math.max(45, Math.min(99, pacePercent + 3)),
    summary: `Mix balance shows customer-pay $${partsSummary.customerSales.toLocaleString()} and internal $${partsSummary.internalSales.toLocaleString()}.`,
    actual: partsSummary.totalGross,
    target: partsSummary.forecastGross,
    pacePercent,
  };
}

export function buildPartsLeakSignals(partsSummary: PartsSummary): ProfitLeak[] {
  const leaks: ProfitLeak[] = [];

  const grossGap = Math.max(0, partsSummary.forecastGross - partsSummary.totalGross);
  if (grossGap > 0) {
    leaks.push({
      department: "Parts",
      title: "Parts gross below forecast",
      severity: grossGap >= 7000 ? "high" : "medium",
      dollarImpact: grossGap,
      cause: "Category execution and order timing are suppressing margin conversion.",
      ownerRole: "Parts Manager",
      recommendedAction: "Confirm top SKU commitments and clear special-order blockers today.",
      confidence: grossGap >= 7000 ? "high" : "medium",
    });
  }

  const internalMix = partsSummary.internalSales / Math.max(1, partsSummary.totalSales);
  if (internalMix > 0.3) {
    const impact = Math.round(partsSummary.totalGross * 0.07);
    leaks.push({
      department: "Parts",
      title: "Internal-heavy mix dragging retail margin",
      severity: "medium",
      dollarImpact: impact,
      cause: `Internal sales mix is ${(internalMix * 100).toFixed(1)}%, reducing higher-margin retail capture.`,
      ownerRole: "Parts Manager",
      recommendedAction: "Shift pull-through focus to customer-pay deferred maintenance categories.",
      confidence: "medium",
    });
  }

  return leaks;
}
