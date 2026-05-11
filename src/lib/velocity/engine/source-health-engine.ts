import { evaluateDataTrust } from "@/src/lib/data-pipeline/data-trust";
import type { SourceHealthPayload } from "@/src/lib/data-pipeline/source-trace";
import type { SalesDeal } from "@/src/lib/types/dealership";
import type { DataConfidenceDecision, VelocitySourceHealth } from "@/src/lib/velocity/engine/types";

function toDepartmentKey(value: string): "sales" | "service" | "parts" | null {
  if (value === "sales" || value === "service" || value === "parts") return value;
  return null;
}

export function evaluateSourceHealth(input: {
  sourceHealth: SourceHealthPayload;
  salesDeals: SalesDeal[];
  parserIssues: string[];
  targets: { salesGross: number; serviceGross: number; partsGross: number; totalGross: number };
  actuals: { salesGross: number; serviceGross: number; partsGross: number; monthToDateGross: number };
}): { sourceHealth: VelocitySourceHealth; dataConfidence: DataConfidenceDecision } {
  const trust = evaluateDataTrust({
    sourceHealth: input.sourceHealth,
    salesDeals: input.salesDeals,
    forecastSummary: {
      totalActual: input.actuals.monthToDateGross,
      totalForecast: input.targets.totalGross,
      variance: input.actuals.monthToDateGross - input.targets.totalGross,
    },
    targets: input.targets,
    actuals: input.actuals,
    parserIssues: input.parserIssues,
  });

  const departments = input.sourceHealth.departments
    .map((d) => {
      const dept = toDepartmentKey(d.department);
      if (!dept) return null;
      return {
        department: dept,
        workbookTitle: d.workbookTitle,
        workbookId: d.workbookId,
        sheetTab: d.sheetTab,
        range: d.range,
        freshnessStatus: d.freshnessStatus,
        monthAligned: d.monthAligned,
        extractedSheetMonthKey: d.extractedSheetMonthKey,
      };
    })
    .filter((d): d is NonNullable<typeof d> => Boolean(d));

  const sourceHealth: VelocitySourceHealth = {
    connectionLabel:
      input.sourceHealth.overallFreshness === "fresh" && input.sourceHealth.staleDataWarnings.length === 0
        ? "Live data connected"
        : "Live data partially connected",
    reportingMonth: input.sourceHealth.reportingMonth,
    reportingMonthLabel: input.sourceHealth.reportingMonthLabel,
    overallFreshness: input.sourceHealth.overallFreshness,
    staleDataWarnings: input.sourceHealth.staleDataWarnings,
    fallbackNotices: input.sourceHealth.fallbackNotices,
    departments,
    sources: departments.map((d) => ({
      source: d.department,
      enabled: true,
      connected: d.freshnessStatus !== "error",
      rowCount: input.salesDeals.length,
      lastFetched: input.sourceHealth.lastSynced,
      parserConfidence: Math.max(0, Math.min(100, trust.sectionConfidence.sourceHealth)),
      errors: d.freshnessStatus === "error" ? ["Source freshness check failed."] : [],
      warningCount: input.sourceHealth.staleDataWarnings.length,
    })),
  };

  const dataConfidence: DataConfidenceDecision = {
    department: "Store",
    severity: trust.classification === "unreliable" ? "high" : trust.classification === "warning" ? "medium" : "low",
    dollarImpact: null,
    ownerRole: "Dealer Principal",
    recommendedAction:
      trust.classification === "unreliable"
        ? "Treat decisions as provisional and correct source alignment before end-of-day."
        : "Monitor source warnings and keep executing with confidence controls.",
    reason: trust.estimationReason ?? "Source alignment and parsing checks are stable.",
    confidence: trust.classification === "healthy" ? "high" : "medium",
    score: trust.confidenceScore,
    classification: trust.classification,
    label: trust.confidenceLabel,
    estimated: trust.estimated,
    estimationReason: trust.estimationReason,
  };

  return { sourceHealth, dataConfidence };
}
