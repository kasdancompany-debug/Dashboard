import type { SalesDeal } from "@/src/lib/types/dealership";
import type { ForecastTrendItem } from "@/src/lib/parsers/forecast-parser";
import type { SourceHealth } from "@/src/lib/velocity/engine/types";
import { resolveDepartmentForecastTotal, resolveForecastTargetForLine } from "@/src/lib/velocity/monthly-gross/forecast-line-targets";
import type { DeptGrossSubLineMetrics, DeptGrossSubLineMetricsMap } from "@/src/lib/parsers/dept-summary-metrics";
import type { SalesGrossSubLineMetrics, SalesGrossTopMetricsMap } from "@/src/lib/parsers/sales-gross-top-metrics";
import type {
  BestWorstTrackingLine,
  DepartmentGrossTracking,
  GrossLineTracking,
  MonthlyGrossDepartment,
  MonthlyGrossTracking,
  TrackingStatus,
} from "@/src/lib/velocity/monthly-gross/types";

type ServiceParsedInput = {
  summary: {
    gross: { customer: number; warranty: number; internal: number; total: number };
    grossLineMetrics?: DeptGrossSubLineMetricsMap;
    actual: number;
    tracking: number;
    forecast: number;
  };
};

type PartsParsedInput = {
  summary: {
    gross: { customer: number; warranty: number; internal: number; wholesale: number; gog: number; total: number };
    grossLineMetrics?: DeptGrossSubLineMetricsMap;
    actual: number;
    tracking: number;
    forecast: number;
  };
  categoryBreakdown?: Array<{ category: string; gross: number }>;
};

type SalesParsedInput = {
  data: SalesDeal[];
  summary?: {
    actualGross?: number | null;
    trackingGross?: number | null;
    targetGross?: number | null;
    grossLineMetrics?: SalesGrossTopMetricsMap;
    newUnits?: number;
    usedUnits?: number;
  };
};

export type MonthlyGrossEngineInput = {
  sales: SalesParsedInput;
  service: ServiceParsedInput;
  parts: PartsParsedInput;
  month: number;
  year: number;
  daysUsed?: number;
  daysAvailable?: number;
  lastSynced?: string;
  sourceHealth?: SourceHealth;
  sourceLineage?: Array<{ source: "sales" | "service" | "parts" | "forecast"; monthAligned: boolean; excluded: boolean; warnings: string[] }>;
  targets?: Partial<Record<MonthlyGrossDepartment, number>>;
  /** When set, line-level targets prefer matching metrics from the forecast workbook tab. */
  forecastLineItems?: ForecastTrendItem[] | null;
};

function safe(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function statusFromPace(pacePercent: number): TrackingStatus {
  if (pacePercent >= 105) return "ahead";
  if (pacePercent >= 95) return "on-track";
  return "behind";
}

function tracking(actualGross: number, daysUsed: number, daysAvailable: number) {
  if (daysUsed <= 0 || daysAvailable <= 0) return null;
  return (actualGross / daysUsed) * daysAvailable;
}

function daysForMonth(month: number, year: number) {
  const daysAvailable = new Date(year, month, 0).getDate();
  const now = new Date();
  const isCurrent = now.getFullYear() === year && now.getMonth() + 1 === month;
  const isPast =
    year < now.getFullYear() || (year === now.getFullYear() && month < now.getMonth() + 1);
  const daysUsed = isPast ? daysAvailable : isCurrent ? now.getDate() : 0;
  return { daysUsed, daysAvailable };
}

function sheetLineForecast(metrics: DeptGrossSubLineMetrics | undefined, modeledFallback: number): number {
  const f = metrics?.forecast;
  return f !== null && f !== undefined && Number.isFinite(f) && f >= 1000 ? f : modeledFallback;
}

function salesSheetLineForecast(metrics: SalesGrossSubLineMetrics | undefined, modeledFallback: number): number {
  const f = metrics?.forecast;
  return f !== null && f !== undefined && Number.isFinite(f) && f >= 1000 ? f : modeledFallback;
}

function sheetLineTracking(metrics: DeptGrossSubLineMetrics | undefined): number | undefined {
  const t = metrics?.tracking;
  return t !== null && t !== undefined && Number.isFinite(t) && t > 0 ? t : undefined;
}

function salesSheetLineTracking(
  metrics: SalesGrossSubLineMetrics | undefined,
  daysUsed: number,
  daysAvailable: number,
): number | undefined {
  const fromSheet = metrics?.tracking;
  if (fromSheet !== null && fromSheet !== undefined && Number.isFinite(fromSheet) && fromSheet > 0) return fromSheet;
  const actual = metrics?.actual;
  if (actual !== null && actual !== undefined && Number.isFinite(actual) && actual > 0 && daysUsed > 0) {
    const projected = tracking(actual, daysUsed, daysAvailable);
    return projected !== null ? projected : undefined;
  }
  return undefined;
}

function sumDealGrossByType(deals: SalesDeal[]) {
  let newGross = 0;
  let usedGross = 0;
  let unknownGross = 0;
  for (const deal of deals) {
    const g = safe(deal.totalGross);
    if (deal.dealType === "new") newGross += g;
    else if (deal.dealType === "used") usedGross += g;
    else unknownGross += g;
  }
  return { newGross, usedGross, unknownGross };
}

function allocateUnclassifiedDealGross(
  deals: SalesDeal[],
  newUnits: number,
  usedUnits: number,
): { newGross: number; usedGross: number } {
  const { newGross, usedGross, unknownGross } = sumDealGrossByType(deals);
  const unitSum = newUnits + usedUnits;
  if (unknownGross > 0 && unitSum > 0) {
    return {
      newGross: newGross + unknownGross * (newUnits / unitSum),
      usedGross: usedGross + unknownGross * (usedUnits / unitSum),
    };
  }
  return { newGross, usedGross };
}

function resolveSalesNewUsedActualGross(params: {
  sheetTotalActual: number;
  metrics?: SalesGrossTopMetricsMap;
  dealNewRaw: number;
  dealUsedRaw: number;
  dealNewAllocated: number;
  dealUsedAllocated: number;
  newUnits: number;
  usedUnits: number;
}): { newActual: number; usedActual: number; method: string } {
  const sheetNew = params.metrics?.newVehicle.actual;
  const sheetUsed = params.metrics?.usedVehicle.actual;
  const sheetNewTracking = params.metrics?.newVehicle.tracking;
  const sheetUsedTracking = params.metrics?.usedVehicle.tracking;
  const hasBreakdownTracking =
    sheetNewTracking !== null &&
    sheetNewTracking !== undefined &&
    sheetNewTracking > 0 &&
    sheetUsedTracking !== null &&
    sheetUsedTracking !== undefined &&
    sheetUsedTracking > 0;
  if (
    hasBreakdownTracking &&
    sheetNew !== null &&
    sheetNew !== undefined &&
    sheetUsed !== null &&
    sheetUsed !== undefined &&
    sheetNew + sheetUsed >= params.sheetTotalActual * 0.5
  ) {
    return { newActual: sheetNew, usedActual: sheetUsed, method: "Daily Log New/Used breakdown table" };
  }

  const rawDealSum = params.dealNewRaw + params.dealUsedRaw;
  if (rawDealSum >= params.sheetTotalActual * 0.85) {
    return {
      newActual: params.dealNewRaw,
      usedActual: params.dealUsedRaw,
      method: "Deal log new/used gross from classified deals",
    };
  }

  const unitSum = params.newUnits + params.usedUnits;
  if (unitSum > 0 && params.sheetTotalActual > 0) {
    return {
      newActual: params.sheetTotalActual * (params.newUnits / unitSum),
      usedActual: params.sheetTotalActual * (params.usedUnits / unitSum),
      method: "Store total gross split by new/used unit mix (most deal $ is not classified new/used in the log)",
    };
  }

  return {
    newActual: params.dealNewAllocated,
    usedActual: params.dealUsedAllocated,
    method: "Deal log gross with unclassified deals split by units",
  };
}

function resolveNewUsedSalesTracking(params: {
  metrics?: SalesGrossTopMetricsMap;
  sheetTotal: number | null;
  newTarget: number;
  usedTarget: number;
  newActual: number;
  usedActual: number;
  dealNewRaw: number;
  dealUsedRaw: number;
  sheetTotalActual: number;
  daysUsed: number;
  daysAvailable: number;
}): { newTracking?: number; usedTracking?: number; method: string } {
  const newFromSheet = params.metrics?.newVehicle.tracking;
  const usedFromSheet = params.metrics?.usedVehicle.tracking;
  const newDirect =
    newFromSheet !== null && newFromSheet !== undefined && Number.isFinite(newFromSheet) && newFromSheet > 0
      ? newFromSheet
      : undefined;
  const usedDirect =
    usedFromSheet !== null && usedFromSheet !== undefined && Number.isFinite(usedFromSheet) && usedFromSheet > 0
      ? usedFromSheet
      : undefined;

  if (newDirect !== undefined && usedDirect !== undefined) {
    return { newTracking: newDirect, usedTracking: usedDirect, method: "Daily Log tracking columns for new and used" };
  }

  if (params.sheetTotal !== null && params.sheetTotal > 0) {
    if (newDirect !== undefined && usedDirect === undefined) {
      return {
        newTracking: newDirect,
        usedTracking: params.sheetTotal - newDirect,
        method: "Sheet new tracking; used is remainder of store tracking gross",
      };
    }
    if (usedDirect !== undefined && newDirect === undefined) {
      return {
        newTracking: params.sheetTotal - usedDirect,
        usedTracking: usedDirect,
        method: "Sheet used tracking; new is remainder of store tracking gross",
      };
    }

    const rawDealSum = params.dealNewRaw + params.dealUsedRaw;
    const dealGrossReliable = rawDealSum >= params.sheetTotalActual * 0.5;

    if (dealGrossReliable) {
      const newProj = tracking(params.newActual, params.daysUsed, params.daysAvailable);
      const usedProj = tracking(params.usedActual, params.daysUsed, params.daysAvailable);
      if (newProj !== null && usedProj !== null && newProj + usedProj > 0) {
        const sum = newProj + usedProj;
        return {
          newTracking: params.sheetTotal * (newProj / sum),
          usedTracking: params.sheetTotal * (usedProj / sum),
          method: "Each line MTD gross run-rate projected, scaled to match store Tracking Gross on the Daily Log",
        };
      }
    }

    const targetSum = params.newTarget + params.usedTarget;
    if (targetSum > 0) {
      return {
        newTracking: params.sheetTotal * (params.newTarget / targetSum),
        usedTracking: params.sheetTotal * (params.usedTarget / targetSum),
        method: "Store tracking gross split by annual forecast new/used targets (no line MTD on sheet)",
      };
    }
  }

  const newFallback = salesSheetLineTracking(params.metrics?.newVehicle, params.daysUsed, params.daysAvailable);
  const usedFallback = salesSheetLineTracking(params.metrics?.usedVehicle, params.daysUsed, params.daysAvailable);
  return {
    newTracking: newFallback,
    usedTracking: usedFallback,
    method: "Per-line projection from parsed sheet/deal MTD",
  };
}

function forecastLineSlug(metric: string, index: number) {
  const base = metric
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return `${base || "row"}-${index}`;
}

function toLine(params: {
  id: string;
  department: MonthlyGrossDepartment;
  label: string;
  actualGross: number;
  targetGross: number;
  daysUsed: number;
  daysAvailable: number;
  sourceMonthMatches: boolean;
  actualReliable: boolean;
  source: string;
  explanation: string;
  trackingOverride?: number | null;
}): GrossLineTracking {
  const actualGross = safe(params.actualGross);
  const targetGross = safe(params.targetGross);
  const reasons: string[] = [];
  if (!params.actualReliable) reasons.push("actual gross is not reliable");
  if (params.daysUsed <= 0) reasons.push("daysUsed must be greater than 0");
  if (params.daysAvailable <= 0) reasons.push("daysAvailable must be greater than 0");
  if (!params.sourceMonthMatches) reasons.push("source month does not match selected month");
  const canTrack = reasons.length === 0;
  const trackingGross = canTrack
    ? (typeof params.trackingOverride === "number" && Number.isFinite(params.trackingOverride)
      ? params.trackingOverride
      : tracking(actualGross, params.daysUsed, params.daysAvailable))
    : null;
  const gapToTarget = trackingGross === null ? null : trackingGross - targetGross;
  const pacePercent = trackingGross === null || targetGross <= 0 ? null : (trackingGross / targetGross) * 100;
  return {
    id: params.id,
    department: params.department,
    label: params.label,
    actualGross,
    trackingGross,
    targetGross,
    gapToTarget,
    pacePercent,
    status: pacePercent === null ? "insufficient-data" : statusFromPace(pacePercent),
    warning: canTrack ? null : `Tracking unavailable: ${reasons.join("; ")}.`,
    source: params.source,
    explanation: params.explanation,
  };
}

/** Store-wide cards: exclude deal splits (unreliable tracking) and proxy lines. */
const EXCLUDE_STORE_BEST_WORST = new Set([
  "sales-gross-per-copy",
  "sales-new-gross",
  "sales-used-gross",
  "sales-front-gross",
  "sales-back-gross",
  "service-cp-labour",
]);

/** Per-department cards: allow new/used; front/back only when forecast target is credible. */
const EXCLUDE_DEPT_BEST_WORST = new Set([
  "sales-gross-per-copy",
  "sales-front-gross",
  "sales-back-gross",
  "service-cp-labour",
]);

function lineEligibleForBestWorst(line: GrossLineTracking, exclude: Set<string>): boolean {
  if (line.gapToTarget === null) return false;
  if (exclude.has(line.id)) return false;
  const tracking = line.trackingGross ?? 0;
  const target = line.targetGross;
  if (target > 0 && target < 1000 && tracking > 10_000) return false;
  return true;
}

function pickBestWorstFromEligible(eligible: GrossLineTracking[]): {
  best: GrossLineTracking | null;
  worst: GrossLineTracking | null;
} {
  if (!eligible.length) return { best: null, worst: null };

  const byBest = eligible.slice().sort((a, b) => (b.gapToTarget ?? 0) - (a.gapToTarget ?? 0));
  const byWorst = eligible.slice().sort((a, b) => (a.gapToTarget ?? 0) - (b.gapToTarget ?? 0));

  let best = byBest[0] ?? null;
  let worst = byWorst[0] ?? null;

  if (best && worst && best.id === worst.id) {
    best = byBest.find((line) => line.id !== worst.id) ?? best;
    if (best.id === worst.id) {
      worst = byWorst.find((line) => line.id !== best.id) ?? worst;
    }
  }

  return { best, worst };
}

function pickStoreBestWorstLines(lines: GrossLineTracking[]) {
  return pickBestWorstFromEligible(lines.filter((line) => lineEligibleForBestWorst(line, EXCLUDE_STORE_BEST_WORST)));
}

function pickDepartmentBestWorstLines(lines: GrossLineTracking[]) {
  let eligible = lines.filter((line) => lineEligibleForBestWorst(line, EXCLUDE_DEPT_BEST_WORST));
  const subLines = eligible.filter((line) => line.id !== "sales-total-gross" && line.id !== "service-total-gross" && line.id !== "parts-total-gross");
  if (subLines.length >= 2) {
    eligible = subLines;
  }

  const behind = eligible.filter((line) => (line.gapToTarget ?? 0) < 0);
  const ahead = eligible.filter((line) => (line.gapToTarget ?? 0) > 0);
  if (behind.length && ahead.length) {
    const worst = behind.reduce((a, b) => ((a.gapToTarget ?? 0) < (b.gapToTarget ?? 0) ? a : b));
    const best = ahead.reduce((a, b) => ((a.gapToTarget ?? 0) > (b.gapToTarget ?? 0) ? a : b));
    return { best, worst };
  }

  return pickBestWorstFromEligible(eligible);
}

function toBestWorst(line: GrossLineTracking | null | undefined): BestWorstTrackingLine | null {
  if (!line) return null;
  return {
    department: line.department,
    label: line.label,
    trackingGross: line.trackingGross,
    targetGross: line.targetGross,
    gapToTarget: line.gapToTarget,
    pacePercent: line.pacePercent,
    warning: line.warning,
    explanation: line.explanation,
  };
}

function departmentFromLines(department: MonthlyGrossDepartment, lines: GrossLineTracking[]): DepartmentGrossTracking {
  const totalLine =
    lines.find((line) => /total\s+(service|parts)?\s*gross|total gross/i.test(line.label)) ??
    null;
  const actualGross = totalLine ? totalLine.actualGross : lines.reduce((sum, line) => sum + line.actualGross, 0);
  const trackingCandidates = totalLine ? [totalLine.trackingGross] : lines.map((line) => line.trackingGross);
  const trackingGross = trackingCandidates.some((value) => value === null)
    ? null
    : trackingCandidates.reduce<number>((sum, value) => sum + (value ?? 0), 0);
  const targetGross = totalLine ? totalLine.targetGross : lines.reduce((sum, line) => sum + line.targetGross, 0);
  const gapToTarget = trackingGross === null ? null : trackingGross - targetGross;
  const pacePercent = trackingGross === null || targetGross <= 0 ? null : (trackingGross / targetGross) * 100;
  const { best: bestLine, worst: worstLine } = pickDepartmentBestWorstLines(lines);
  const warnings = lines.map((line) => line.warning).filter((w): w is string => Boolean(w));
  return {
    department,
    actualGross,
    trackingGross,
    targetGross,
    gapToTarget,
    pacePercent,
    status: pacePercent === null ? "insufficient-data" : statusFromPace(pacePercent),
    warning: warnings.length ? warnings.join(" ") : null,
    bestLine: toBestWorst(bestLine),
    worstLine: toBestWorst(worstLine),
    lines,
  };
}

function fallbackSourceHealth(month: number, year: number): SourceHealth {
  const reportingMonth = `${year}-${String(month).padStart(2, "0")}`;
  return {
    connectionLabel: "Live data connected",
    reportingMonth,
    reportingMonthLabel: new Date(year, month - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" }),
    overallFreshness: "unknown",
    staleDataWarnings: [],
    fallbackNotices: [],
    departments: [
      {
        department: "sales",
        workbookTitle: null,
        workbookId: "unknown",
        sheetTab: null,
        range: "unknown",
        freshnessStatus: "unknown",
        monthAligned: true,
        extractedSheetMonthKey: reportingMonth,
      },
      {
        department: "service",
        workbookTitle: null,
        workbookId: "unknown",
        sheetTab: null,
        range: "unknown",
        freshnessStatus: "unknown",
        monthAligned: true,
        extractedSheetMonthKey: reportingMonth,
      },
      {
        department: "parts",
        workbookTitle: null,
        workbookId: "unknown",
        sheetTab: null,
        range: "unknown",
        freshnessStatus: "unknown",
        monthAligned: true,
        extractedSheetMonthKey: reportingMonth,
      },
    ],
    sources: [
      { source: "sales", enabled: true, connected: true, rowCount: 0, lastFetched: null, parserConfidence: 0, errors: [], warningCount: 0 },
      { source: "service", enabled: true, connected: true, rowCount: 0, lastFetched: null, parserConfidence: 0, errors: [], warningCount: 0 },
      { source: "parts", enabled: true, connected: true, rowCount: 0, lastFetched: null, parserConfidence: 0, errors: [], warningCount: 0 },
    ],
  };
}

export function buildMonthlyGrossTracking(input: MonthlyGrossEngineInput): MonthlyGrossTracking {
  const { month, year } = input;
  const defaultDays = daysForMonth(month, year);
  const daysUsed = typeof input.daysUsed === "number" && Number.isFinite(input.daysUsed) ? input.daysUsed : defaultDays.daysUsed;
  const daysAvailable = typeof input.daysAvailable === "number" && Number.isFinite(input.daysAvailable) ? input.daysAvailable : defaultDays.daysAvailable;
  const lineageMap = new Map((input.sourceLineage ?? []).map((line) => [line.source, line]));
  const salesLineage = lineageMap.get("sales");
  const serviceLineage = lineageMap.get("service");
  const partsLineage = lineageMap.get("parts");
  const forecastLineage = lineageMap.get("forecast");
  const reliableFromLineage = (source: typeof salesLineage) =>
    Boolean(source && !source.excluded && source.monthAligned);

  const fc = input.forecastLineItems;

  /** Target: daily sheet row → annual forecast workbook → modeled % split. */
  function lineForecastTarget(department: MonthlyGrossDepartment, label: string, modeledFallback: number): number {
    const hit = resolveForecastTargetForLine(department, label, fc);
    return hit !== null && Number.isFinite(hit) && hit > 0 ? hit : modeledFallback;
  }

  const salesTarget =
    resolveDepartmentForecastTotal("Sales", fc) ??
    (safe(input.sales.summary?.targetGross) || safe(input.targets?.Sales));

  // Deals are already scoped to the selected Daily Log month tab in live data.
  const monthlySalesDeals = input.sales.data.filter((deal) => deal.status === "delivered");

  const salesGrossMetrics = input.sales.summary?.grossLineMetrics;
  const salesFrontGross = monthlySalesDeals.reduce((sum, d) => sum + safe(d.frontGross), 0);
  const salesBackGross = monthlySalesDeals.reduce((sum, d) => sum + safe(d.backGross), 0);
  const salesTotalGrossFromDeals = monthlySalesDeals.reduce((sum, d) => sum + safe(d.totalGross), 0);
  const salesTotalGross = safe(input.sales.summary?.actualGross) || salesTotalGrossFromDeals;
  const salesNewUnits = safe(input.sales.summary?.newUnits);
  const salesUsedUnits = safe(input.sales.summary?.usedUnits);
  const { newGross: dealNewRaw, usedGross: dealUsedRaw } = sumDealGrossByType(monthlySalesDeals);
  const { newGross: dealNewAllocated, usedGross: dealUsedAllocated } = allocateUnclassifiedDealGross(
    monthlySalesDeals,
    salesNewUnits,
    salesUsedUnits,
  );
  const { newActual: salesNewGross, usedActual: salesUsedGross, method: salesActualMethod } = resolveSalesNewUsedActualGross({
    sheetTotalActual: salesTotalGross,
    metrics: salesGrossMetrics,
    dealNewRaw,
    dealUsedRaw,
    dealNewAllocated,
    dealUsedAllocated,
    newUnits: salesNewUnits,
    usedUnits: salesUsedUnits,
  });
  const grossPerCopy = monthlySalesDeals.length > 0 ? salesTotalGross / monthlySalesDeals.length : null;

  /** Align front/back *tracking* with sales sheet "Tracking gross" by MTD mix so gaps match the scorecard (deal run-rate alone often undercounts front vs DMS). */
  const sheetSalesTracking =
    typeof input.sales.summary?.trackingGross === "number" &&
    Number.isFinite(input.sales.summary.trackingGross) &&
    input.sales.summary.trackingGross > 0
      ? input.sales.summary.trackingGross
      : null;
  const frontBackMtd = salesFrontGross + salesBackGross;
  const salesFrontTrackingShare =
    sheetSalesTracking !== null && frontBackMtd > 0 ? sheetSalesTracking * (salesFrontGross / frontBackMtd) : null;
  const salesBackTrackingShare =
    sheetSalesTracking !== null && frontBackMtd > 0 ? sheetSalesTracking * (salesBackGross / frontBackMtd) : null;

  const newVehicleTarget = lineForecastTarget("Sales", "New Vehicle Gross", salesTarget * 0.45);
  const usedVehicleTarget = lineForecastTarget("Sales", "Used Vehicle Gross", salesTarget * 0.55);
  const {
    newTracking: salesNewTrackingOverride,
    usedTracking: salesUsedTrackingOverride,
    method: salesTrackingMethod,
  } = resolveNewUsedSalesTracking({
    metrics: salesGrossMetrics,
    sheetTotal: sheetSalesTracking,
    newTarget: newVehicleTarget,
    usedTarget: usedVehicleTarget,
    newActual: salesNewGross,
    usedActual: salesUsedGross,
    dealNewRaw,
    dealUsedRaw,
    sheetTotalActual: salesTotalGross,
    daysUsed,
    daysAvailable,
  });

  const salesLines: GrossLineTracking[] = [
    toLine({
      id: "sales-new-gross",
      department: "Sales",
      label: "New Vehicle Gross",
      actualGross: salesNewGross,
      targetGross: salesSheetLineForecast(salesGrossMetrics?.newVehicle, newVehicleTarget),
      daysUsed,
      daysAvailable,
      sourceMonthMatches: Boolean(salesLineage?.monthAligned),
      actualReliable: reliableFromLineage(salesLineage),
      source: "Sales Daily Log gross grid + annual forecast",
      explanation: `New-vehicle gross: MTD from ${salesActualMethod}. Tracking: ${salesTrackingMethod}. Target from 2026 Forecast when matched.`,
      trackingOverride: salesNewTrackingOverride,
    }),
    toLine({
      id: "sales-used-gross",
      department: "Sales",
      label: "Used Vehicle Gross",
      actualGross: salesUsedGross,
      targetGross: salesSheetLineForecast(salesGrossMetrics?.usedVehicle, usedVehicleTarget),
      daysUsed,
      daysAvailable,
      sourceMonthMatches: Boolean(salesLineage?.monthAligned),
      actualReliable: reliableFromLineage(salesLineage),
      source: "Sales Daily Log gross grid + annual forecast",
      explanation: `Used-vehicle gross: MTD from ${salesActualMethod}. Tracking: ${salesTrackingMethod}. Target from 2026 Forecast when matched.`,
      trackingOverride: salesUsedTrackingOverride,
    }),
    toLine({
      id: "sales-front-gross",
      department: "Sales",
      label: "Front Gross",
      actualGross: salesFrontGross,
      targetGross: lineForecastTarget("Sales", "Front Gross", salesTarget * 0.65),
      daysUsed,
      daysAvailable,
      sourceMonthMatches: Boolean(salesLineage?.monthAligned),
      actualReliable: reliableFromLineage(salesLineage),
      source: "Parsed sales deals",
      explanation:
        "Front-end gross: target from forecast when the row name matches; tracking uses the same share of sales sheet total tracking as MTD front ÷ (front+back) from deals.",
      trackingOverride: salesFrontTrackingShare ?? undefined,
    }),
    toLine({
      id: "sales-back-gross",
      department: "Sales",
      label: "Back Gross",
      actualGross: salesBackGross,
      targetGross: lineForecastTarget("Sales", "Back Gross", salesTarget * 0.35),
      daysUsed,
      daysAvailable,
      sourceMonthMatches: Boolean(salesLineage?.monthAligned),
      actualReliable: reliableFromLineage(salesLineage),
      source: "Parsed sales deals",
      explanation:
        "Back-end gross: target from forecast when matched; tracking uses the same share of sales sheet total tracking as MTD back ÷ (front+back) from deals.",
      trackingOverride: salesBackTrackingShare ?? undefined,
    }),
    toLine({
      id: "sales-total-gross",
      department: "Sales",
      label: "Total Gross",
      actualGross: salesTotalGross,
      targetGross: lineForecastTarget("Sales", "Total Gross", salesTarget),
      daysUsed,
      daysAvailable,
      sourceMonthMatches: Boolean(salesLineage?.monthAligned),
      actualReliable: reliableFromLineage(salesLineage),
      source: "Parsed sales deals",
      explanation: "Total sales department gross projection for the selected month.",
      trackingOverride: input.sales.summary?.trackingGross ?? null,
    }),
  ];

  if (grossPerCopy !== null) {
    salesLines.push(
      toLine({
        id: "sales-gross-per-copy",
        department: "Sales",
        label: "Gross Per Copy",
        actualGross: grossPerCopy,
        targetGross: grossPerCopy,
        daysUsed: Math.max(daysUsed, 1),
        daysAvailable: Math.max(daysUsed, 1),
        sourceMonthMatches: Boolean(salesLineage?.monthAligned),
        actualReliable: reliableFromLineage(salesLineage),
        source: "Derived from parsed sales deals",
        explanation: "Low-confidence pacing proxy. Included because gross-per-copy is available.",
      }),
    );
  }

  const serviceTarget =
    resolveDepartmentForecastTotal("Service", fc) ?? safe(input.targets?.Service);
  const serviceMetrics = input.service.summary.grossLineMetrics;
  const serviceLines: GrossLineTracking[] = [
    toLine({
      id: "service-customer-gross",
      department: "Service",
      label: "Customer Gross",
      actualGross: safe(input.service.summary.gross.customer),
      targetGross: sheetLineForecast(
        serviceMetrics?.customer,
        lineForecastTarget("Service", "Customer Gross", serviceTarget * 0.5),
      ),
      daysUsed,
      daysAvailable,
      sourceMonthMatches: Boolean(serviceLineage?.monthAligned),
      actualReliable: reliableFromLineage(serviceLineage),
      source: "Parsed service summary",
      explanation:
        "Customer-pay gross: forecast and tracking from the service workbook row when present; otherwise forecast-tab match or modeled share.",
      trackingOverride: sheetLineTracking(serviceMetrics?.customer),
    }),
    toLine({
      id: "service-warranty-gross",
      department: "Service",
      label: "Warranty Gross",
      actualGross: safe(input.service.summary.gross.warranty),
      targetGross: sheetLineForecast(
        serviceMetrics?.warranty,
        lineForecastTarget("Service", "Warranty Gross", serviceTarget * 0.25),
      ),
      daysUsed,
      daysAvailable,
      sourceMonthMatches: Boolean(serviceLineage?.monthAligned),
      actualReliable: reliableFromLineage(serviceLineage),
      source: "Parsed service summary",
      explanation: "Warranty gross: workbook forecast/tracking when parsed.",
      trackingOverride: sheetLineTracking(serviceMetrics?.warranty),
    }),
    toLine({
      id: "service-internal-gross",
      department: "Service",
      label: "Internal Gross",
      actualGross: safe(input.service.summary.gross.internal),
      targetGross: sheetLineForecast(
        serviceMetrics?.internal,
        lineForecastTarget("Service", "Internal Gross", serviceTarget * 0.25),
      ),
      daysUsed,
      daysAvailable,
      sourceMonthMatches: Boolean(serviceLineage?.monthAligned),
      actualReliable: reliableFromLineage(serviceLineage),
      source: "Parsed service summary",
      explanation: "Internal gross: workbook forecast/tracking when parsed.",
      trackingOverride: sheetLineTracking(serviceMetrics?.internal),
    }),
    toLine({
      id: "service-total-gross",
      department: "Service",
      label: "Total Service Gross",
      actualGross: safe(input.service.summary.gross.total),
      targetGross: lineForecastTarget("Service", "Total Service Gross", serviceTarget),
      daysUsed,
      daysAvailable,
      sourceMonthMatches: Boolean(serviceLineage?.monthAligned),
      actualReliable: reliableFromLineage(serviceLineage),
      source: "Parsed service summary",
      explanation:
        "Uses the service sheet Total Gross · Tracking when present so numbers match the workbook; otherwise MTD actual is projected by days in month.",
      trackingOverride:
        typeof input.service.summary.tracking === "number" &&
        Number.isFinite(input.service.summary.tracking) &&
        input.service.summary.tracking > 0
          ? input.service.summary.tracking
          : undefined,
    }),
  ];

  const cpLabor = safe(input.service.summary.actual);
  if (cpLabor > 0) {
    serviceLines.push(
      toLine({
        id: "service-cp-labour",
        department: "Service",
        label: "CP Labour",
        actualGross: cpLabor,
        targetGross: safe(input.service.summary.tracking) || cpLabor,
        daysUsed,
        daysAvailable,
        sourceMonthMatches: Boolean(serviceLineage?.monthAligned),
        actualReliable: reliableFromLineage(serviceLineage),
        source: "Parsed service summary",
        explanation: "Low-confidence proxy line using CP labour figures where available.",
      }),
    );
  }

  const partsTarget =
    resolveDepartmentForecastTotal("Parts", fc) ?? safe(input.targets?.Parts);
  const partsMetrics = input.parts.summary.grossLineMetrics;
  const partsLines: GrossLineTracking[] = [
    toLine({
      id: "parts-customer-gross",
      department: "Parts",
      label: "Customer Gross",
      actualGross: safe(input.parts.summary.gross.customer),
      targetGross: sheetLineForecast(
        partsMetrics?.customer,
        lineForecastTarget("Parts", "Customer Gross", partsTarget * 0.5),
      ),
      daysUsed,
      daysAvailable,
      sourceMonthMatches: Boolean(partsLineage?.monthAligned),
      actualReliable: reliableFromLineage(partsLineage),
      source: "Parsed parts summary",
      explanation: "Customer parts gross: workbook forecast/tracking when parsed.",
      trackingOverride: sheetLineTracking(partsMetrics?.customer),
    }),
    toLine({
      id: "parts-warranty-gross",
      department: "Parts",
      label: "Warranty Gross",
      actualGross: safe(input.parts.summary.gross.warranty),
      targetGross: sheetLineForecast(
        partsMetrics?.warranty,
        lineForecastTarget("Parts", "Warranty Gross", partsTarget * 0.2),
      ),
      daysUsed,
      daysAvailable,
      sourceMonthMatches: Boolean(partsLineage?.monthAligned),
      actualReliable: reliableFromLineage(partsLineage),
      source: "Parsed parts summary",
      explanation: "Warranty parts gross: workbook forecast/tracking when parsed.",
      trackingOverride: sheetLineTracking(partsMetrics?.warranty),
    }),
    toLine({
      id: "parts-internal-gross",
      department: "Parts",
      label: "Internal Gross",
      actualGross: safe(input.parts.summary.gross.internal),
      targetGross: sheetLineForecast(
        partsMetrics?.internal,
        lineForecastTarget("Parts", "Internal Gross", partsTarget * 0.3),
      ),
      daysUsed,
      daysAvailable,
      sourceMonthMatches: Boolean(partsLineage?.monthAligned),
      actualReliable: reliableFromLineage(partsLineage),
      source: "Parsed parts summary",
      explanation: "Internal parts gross: workbook forecast/tracking when parsed.",
      trackingOverride: sheetLineTracking(partsMetrics?.internal),
    }),
    toLine({
      id: "parts-wholesale-gross",
      department: "Parts",
      label: "Wholesale Gross",
      actualGross: safe(input.parts.summary.gross.wholesale ?? 0),
      targetGross: sheetLineForecast(
        partsMetrics?.wholesale,
        lineForecastTarget("Parts", "Wholesale Gross", partsTarget * 0.11),
      ),
      daysUsed,
      daysAvailable,
      sourceMonthMatches: Boolean(partsLineage?.monthAligned),
      actualReliable: reliableFromLineage(partsLineage),
      source: "Parsed parts summary",
      explanation: "Wholesale parts gross: workbook forecast/tracking when parsed.",
      trackingOverride: sheetLineTracking(partsMetrics?.wholesale),
    }),
    toLine({
      id: "parts-gog-gross",
      department: "Parts",
      label: "GOG Gross",
      actualGross: safe(input.parts.summary.gross.gog ?? 0),
      targetGross: sheetLineForecast(
        partsMetrics?.gog,
        lineForecastTarget("Parts", "GOG Gross", partsTarget * 0.08),
      ),
      daysUsed,
      daysAvailable,
      sourceMonthMatches: Boolean(partsLineage?.monthAligned),
      actualReliable: reliableFromLineage(partsLineage),
      source: "Parsed parts summary",
      explanation: "GOG parts gross: workbook forecast/tracking when parsed.",
      trackingOverride: sheetLineTracking(partsMetrics?.gog),
    }),
    toLine({
      id: "parts-total-gross",
      department: "Parts",
      label: "Total Parts Gross",
      actualGross: safe(input.parts.summary.gross.total),
      targetGross: lineForecastTarget("Parts", "Total Parts Gross", partsTarget),
      daysUsed,
      daysAvailable,
      sourceMonthMatches: Boolean(partsLineage?.monthAligned),
      actualReliable: reliableFromLineage(partsLineage),
      source: "Parsed parts summary",
      explanation:
        "Uses the parts sheet Total Gross · Tracking when present so numbers match the workbook; otherwise MTD actual is projected by days in month.",
      trackingOverride:
        typeof input.parts.summary.tracking === "number" &&
        Number.isFinite(input.parts.summary.tracking) &&
        input.parts.summary.tracking > 0
          ? input.parts.summary.tracking
          : undefined,
    }),
  ];

  const FORECAST_LINES_CAP = 80;
  const forecastLines: GrossLineTracking[] = (() => {
    const rows: GrossLineTracking[] = [];
    if (!fc?.length || !forecastLineage) return rows;
    const slice = fc.slice(0, FORECAST_LINES_CAP);
    for (let i = 0; i < slice.length; i += 1) {
      const row = slice[i];
      if (!Number.isFinite(row.forecast) || row.forecast === 0) continue;
      const label = row.metric?.trim() || `Forecast row ${i + 1}`;
      rows.push(
        toLine({
          id: `forecast-line-${forecastLineSlug(label, i)}`,
          department: "Forecast",
          label,
          actualGross: row.actual,
          targetGross: row.forecast,
          daysUsed,
          daysAvailable,
          sourceMonthMatches: Boolean(forecastLineage.monthAligned),
          actualReliable: reliableFromLineage(forecastLineage),
          source: "Forecast workbook",
          explanation:
            "Forecast tab: MTD actual vs budget/forecast for this metric; month-end projection from actual pacing (same basis as Sales, Service, and Parts lines).",
        }),
      );
    }
    return rows;
  })();

  const departments: DepartmentGrossTracking[] = [
    departmentFromLines("Sales", salesLines),
    departmentFromLines("Service", serviceLines),
    departmentFromLines("Parts", partsLines),
  ];

  const allLines = [...departments.flatMap((d) => d.lines)].filter(
    (line) => line.department !== "Forecast" && lineEligibleForBestWorst(line, EXCLUDE_STORE_BEST_WORST),
  );
  const bestTrackingLine = toBestWorst(allLines.slice().sort((a, b) => (b.gapToTarget ?? 0) - (a.gapToTarget ?? 0))[0]);
  const worstTrackingLine = toBestWorst(allLines.slice().sort((a, b) => (a.gapToTarget ?? 0) - (b.gapToTarget ?? 0))[0]);

  const totalActualGross = departments.reduce((sum, d) => sum + d.actualGross, 0);
  const totalTrackingGross = departments.some((d) => d.trackingGross === null)
    ? null
    : departments.reduce((sum, d) => sum + (d.trackingGross ?? 0), 0);
  const totalTargetGross = departments.reduce((sum, d) => sum + d.targetGross, 0);
  const totalGapToTarget = totalTrackingGross === null ? null : totalTrackingGross - totalTargetGross;
  const totalPacePercent = totalTrackingGross === null || totalTargetGross <= 0 ? null : (totalTrackingGross / totalTargetGross) * 100;

  return {
    month,
    year,
    daysUsed,
    daysAvailable,
    totalActualGross,
    totalTrackingGross,
    totalTargetGross,
    totalGapToTarget,
    totalPacePercent,
    departments,
    bestTrackingLine,
    worstTrackingLine,
    lastSynced: input.lastSynced ?? new Date().toISOString(),
    sourceHealth: input.sourceHealth ?? fallbackSourceHealth(month, year),
  };
}

