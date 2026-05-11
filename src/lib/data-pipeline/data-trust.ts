import type { SalesDeal } from "@/src/lib/types/dealership";
import type { SourceHealthPayload } from "@/src/lib/data-pipeline/source-trace";

export type TrustSeverity = "high" | "medium" | "low";
export type TrustClassification = "healthy" | "warning" | "unreliable";

export type DataTrustIssue = {
  code: string;
  severity: TrustSeverity;
  message: string;
  affectedMetrics: string[];
  reason: string;
};

export type DataTrustPayload = {
  confidenceScore: number;
  classification: TrustClassification;
  confidenceLabel: "High confidence" | "Medium confidence" | "Low confidence";
  forecastReliability: "reliable" | "limited";
  forecastReliabilityReason: string | null;
  stale: boolean;
  lastUpdatedAt: string;
  estimated: boolean;
  estimationReason: string | null;
  fallbackMonthUsed: boolean;
  fallbackMonthLabel: string | null;
  deductions: number;
  issues: DataTrustIssue[];
  sectionConfidence: {
    commandStrip: number;
    departments: number;
    playbook: number;
    sourceHealth: number;
  };
  downgradedMetrics: string[];
};

type Inputs = {
  sourceHealth: SourceHealthPayload;
  salesDeals: SalesDeal[];
  forecastSummary: { totalActual: number; totalForecast: number; variance: number };
  targets: { salesGross: number; serviceGross: number; partsGross: number; totalGross: number };
  actuals: { salesGross: number; serviceGross: number; partsGross: number; monthToDateGross: number };
  parserIssues: string[];
};

const DEDUCTIONS: Record<TrustSeverity, number> = {
  high: 15,
  medium: 8,
  low: 3,
};

const SOURCE_WEIGHTS = {
  sales: 0.45,
  service: 0.2,
  parts: 0.15,
  forecast: 0.2, // capped at 20% so forecast cannot dominate trust
} as const;

function pctDelta(a: number, b: number) {
  const max = Math.max(Math.abs(a), Math.abs(b), 1);
  return Math.abs(a - b) / max;
}

function classify(score: number): TrustClassification {
  if (score > 80) return "healthy";
  if (score >= 60) return "warning";
  return "unreliable";
}

function confidenceLabel(score: number): "High confidence" | "Medium confidence" | "Low confidence" {
  if (score > 80) return "High confidence";
  if (score >= 60) return "Medium confidence";
  return "Low confidence";
}

function monthDistance(fromKey: string, toKey: string): number | null {
  const [fromY, fromM] = fromKey.split("-").map(Number);
  const [toY, toM] = toKey.split("-").map(Number);
  if (![fromY, fromM, toY, toM].every((n) => Number.isFinite(n))) return null;
  return (fromY - toY) * 12 + (fromM - toM);
}

function sourceMonthScore(reportingMonth: string, extractedMonth: string | null, monthAligned: boolean): number {
  if (monthAligned) return 100;
  if (!extractedMonth) return 30;
  const d = monthDistance(reportingMonth, extractedMonth);
  if (d === null) return 30;
  if (Math.abs(d) === 1) return 60;
  if (Math.abs(d) > 1) return 30;
  return 100;
}

export function evaluateDataTrust(inputs: Inputs): DataTrustPayload {
  const issues: DataTrustIssue[] = [];
  const nowMs = Date.now();
  const lastUpdatedAt = inputs.sourceHealth.lastSynced;
  const lastUpdatedMs = Date.parse(lastUpdatedAt);
  const ageMs = Number.isFinite(lastUpdatedMs) ? nowMs - lastUpdatedMs : Number.POSITIVE_INFINITY;
  const stale = ageMs > 24 * 60 * 60 * 1000;

  if (stale) {
    issues.push({
      code: "stale-data",
      severity: "high",
      message: "Source data is older than 24 hours.",
      affectedMetrics: ["all"],
      reason: "Freshness threshold exceeded (>24h), numbers may no longer represent today's operating state.",
    });
  }

  if (inputs.sourceHealth.staleDataWarnings.length > 0) {
    const forecastMismatchOnly = inputs.sourceHealth.departments
      .filter((d) => !d.monthAligned && !d.monthUnknown)
      .every((d) => d.department === "forecast");
    issues.push({
      code: "reporting-month-mismatch",
      severity: forecastMismatchOnly ? "medium" : "high",
      message: forecastMismatchOnly
        ? "Forecast tab does not match dashboard reporting month (limited reliability)."
        : "One or more sheets do not match the dashboard reporting month.",
      affectedMetrics: ["forecast", "department-gross", "month-to-date-gross"],
      reason: "Month alignment mismatch can blend periods and distort pace vs forecast.",
    });
  }

  const formulaErrorCount = inputs.sourceHealth.departments.reduce((n, d) => n + d.formulaErrors.length, 0);
  if (formulaErrorCount > 0) {
    issues.push({
      code: "excel-formula-errors",
      severity: "high",
      message: `${formulaErrorCount} spreadsheet formula error(s) detected.`,
      affectedMetrics: ["all"],
      reason: "Excel/Sheets formula faults can produce incorrect totals (#REF!, #DIV/0!, etc.).",
    });
  }

  if (inputs.actuals.salesGross < 0 || inputs.actuals.serviceGross < 0 || inputs.actuals.partsGross < 0 || inputs.actuals.monthToDateGross < 0) {
    issues.push({
      code: "unexpected-negative-totals",
      severity: "high",
      message: "Unexpected negative gross total detected.",
      affectedMetrics: ["month-to-date-gross", "department-gross"],
      reason: "Negative totals are out-of-range for this reporting context and likely indicate source or mapping errors.",
    });
  }

  const missingRequiredCount = inputs.salesDeals.filter((d) => !d.manager || !d.salesperson || !d.vehicle || !d.customer).length;
  if (missingRequiredCount > 0) {
    issues.push({
      code: "required-fields-missing",
      severity: "medium",
      message: `${missingRequiredCount} sales row(s) are missing required fields.`,
      affectedMetrics: ["sales-risk", "playbook", "accountability"],
      reason: "Missing owner/deal context weakens risk scoring and ownership assignment.",
    });
  }

  const zeroGrossDeals = inputs.salesDeals.filter((d) => Math.abs(d.totalGross) < 1).length;
  if (zeroGrossDeals > 0) {
    issues.push({
      code: "zero-gross-deals",
      severity: zeroGrossDeals >= 10 ? "high" : "medium",
      message: `${zeroGrossDeals} zero-value deal(s) found.`,
      affectedMetrics: ["sales-gross", "recoverable-risk"],
      reason: "Zero-value deal rows can indicate incomplete posting or true margin leakage requiring review.",
    });
  }

  const missingGrossDeals = inputs.salesDeals.filter((d) => !Number.isFinite(d.frontGross) || !Number.isFinite(d.backGross) || !Number.isFinite(d.totalGross)).length;
  if (missingGrossDeals > 0) {
    issues.push({
      code: "missing-gross-values",
      severity: "high",
      message: `${missingGrossDeals} deal row(s) have missing gross values.`,
      affectedMetrics: ["sales-gross", "month-to-date-gross"],
      reason: "Missing gross fields break total integrity and understate/overstate recoverable opportunity.",
    });
  }

  const missingClassification = inputs.salesDeals.filter((d) => d.dealType === "unknown").length;
  if (missingClassification > 0) {
    issues.push({
      code: "missing-classifications",
      severity: "medium",
      message: `${missingClassification} deal(s) have unknown classification.`,
      affectedMetrics: ["new-used-mix", "forecast-variance"],
      reason: "Unknown new/used mix reduces reliability of pacing and deal-quality diagnostics.",
    });
  }

  const targetSum = inputs.targets.salesGross + inputs.targets.serviceGross + inputs.targets.partsGross;
  if (inputs.targets.totalGross > 0 && pctDelta(targetSum, inputs.targets.totalGross) > 0.05) {
    issues.push({
      code: "cross-check-target-mismatch",
      severity: "low",
      message: "Forecast totals mismatch across sheets by more than 5%.",
      affectedMetrics: ["forecast", "gap-vs-forecast", "command-strip"],
      reason: "Cross-sheet forecast mismatch reduces forecast reliability but should not block operating decisions.",
    });
  }

  if (inputs.forecastSummary.totalActual > 0 && pctDelta(inputs.actuals.monthToDateGross, inputs.forecastSummary.totalActual) > 0.05) {
    issues.push({
      code: "cross-check-actual-mismatch",
      severity: "high",
      message: "Actual gross totals mismatch between logs and forecast mapping by more than 5%.",
      affectedMetrics: ["month-to-date-gross", "gap-vs-forecast"],
      reason: "Cross-source actual mismatch means at least one sheet mapping is not aligned.",
    });
  }

  if (inputs.parserIssues.length > 0) {
    issues.push({
      code: "parser-quality-issues",
      severity: "low",
      message: `${inputs.parserIssues.length} parser warning(s) detected.`,
      affectedMetrics: ["varies"],
      reason: "Parser warnings suggest potential field ambiguity or non-standard source layout.",
    });
  }

  const salesRow = inputs.sourceHealth.departments.find((d) => d.department === "sales");
  const serviceRow = inputs.sourceHealth.departments.find((d) => d.department === "service");
  const partsRow = inputs.sourceHealth.departments.find((d) => d.department === "parts");
  const forecastRow = inputs.sourceHealth.departments.find((d) => d.department === "forecast");
  const forecastScore = forecastRow
    ? forecastRow.monthAligned
      ? 100
      : forecastRow.monthUnknown
        ? 60
        : 60
    : 60;

  const weightedConfidenceRaw =
    SOURCE_WEIGHTS.sales *
      sourceMonthScore(inputs.sourceHealth.reportingMonth, salesRow?.extractedSheetMonthKey ?? null, Boolean(salesRow?.monthAligned)) +
    SOURCE_WEIGHTS.service *
      sourceMonthScore(inputs.sourceHealth.reportingMonth, serviceRow?.extractedSheetMonthKey ?? null, Boolean(serviceRow?.monthAligned)) +
    SOURCE_WEIGHTS.parts *
      sourceMonthScore(inputs.sourceHealth.reportingMonth, partsRow?.extractedSheetMonthKey ?? null, Boolean(partsRow?.monthAligned)) +
    SOURCE_WEIGHTS.forecast * forecastScore;

  const confidenceScore = Math.max(0, Math.min(100, Math.round(weightedConfidenceRaw)));
  const deductions = 100 - confidenceScore;
  const classification = classify(confidenceScore);
  const confidenceBand = confidenceLabel(confidenceScore);
  const forecastReliability = forecastScore >= 100 ? "reliable" : "limited";
  const forecastReliabilityReason = forecastReliability === "limited" ? "Forecast using mismatched or unavailable month; treat as directional." : null;
  const fallbackMonthRows = inputs.sourceHealth.departments.filter((d) => d.extractedSheetMonthKey && !d.monthAligned);
  const fallbackMonthUsed = fallbackMonthRows.length > 0;
  const fallbackMonthLabel = fallbackMonthUsed ? fallbackMonthRows[0].extractedSheetMonthKey : null;
  const estimated = issues.length > 0;
  const estimationReason = fallbackMonthUsed
    ? `${fallbackMonthRows.map((d) => d.department[0].toUpperCase() + d.department.slice(1)).join(" + ")} using ${fallbackMonthLabel} data`
    : issues[0]?.message ?? null;

  const downgradedMetrics: string[] = [];
  if (classification === "unreliable") downgradedMetrics.push("playbook");

  const sectionPenalty = (codes: string[]) =>
    issues.filter((i) => codes.includes(i.code)).reduce((sum, i) => sum + DEDUCTIONS[i.severity], 0);

  const sectionConfidence = {
    commandStrip: Math.max(0, 100 - sectionPenalty(["stale-data", "reporting-month-mismatch", "cross-check-target-mismatch", "cross-check-actual-mismatch"])),
    departments: Math.max(0, 100 - sectionPenalty(["missing-gross-values", "missing-classifications", "zero-gross-deals"])),
    playbook: Math.max(0, 100 - sectionPenalty(["required-fields-missing", "missing-classifications", "parser-quality-issues"])),
    sourceHealth: Math.max(0, 100 - sectionPenalty(["excel-formula-errors", "stale-data", "reporting-month-mismatch"])),
  };

  return {
    confidenceScore,
    classification,
    confidenceLabel: confidenceBand,
    forecastReliability,
    forecastReliabilityReason,
    stale,
    lastUpdatedAt,
    estimated,
    estimationReason,
    fallbackMonthUsed,
    fallbackMonthLabel,
    deductions,
    issues,
    sectionConfidence,
    downgradedMetrics,
  };
}

