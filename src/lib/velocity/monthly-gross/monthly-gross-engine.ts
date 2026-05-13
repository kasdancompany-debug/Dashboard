import type { SalesDeal } from "@/src/lib/types/dealership";
import type { ForecastTrendItem } from "@/src/lib/parsers/forecast-parser";
import type { SourceHealth } from "@/src/lib/velocity/engine/types";
import { resolveDepartmentForecastTotal, resolveForecastTargetForLine } from "@/src/lib/velocity/monthly-gross/forecast-line-targets";
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
    actual: number;
    tracking: number;
    forecast: number;
  };
};

type PartsParsedInput = {
  summary: {
    gross: { customer: number; warranty: number; internal: number; total: number };
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
  const bestLine = lines.length
    ? lines
        .filter((line) => line.gapToTarget !== null)
        .slice()
        .sort((a, b) => (b.gapToTarget ?? 0) - (a.gapToTarget ?? 0))[0]
    : null;
  const worstLine = lines.length
    ? lines
        .filter((line) => line.gapToTarget !== null)
        .slice()
        .sort((a, b) => (a.gapToTarget ?? 0) - (b.gapToTarget ?? 0))[0]
    : null;
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
  const reliableFromLineage = (source: typeof salesLineage) =>
    Boolean(source && !source.excluded && source.monthAligned);

  const fc = input.forecastLineItems;

  function lineForecastTarget(department: MonthlyGrossDepartment, label: string, modeledFallback: number): number {
    const hit = resolveForecastTargetForLine(department, label, fc);
    return hit !== null && Number.isFinite(hit) && hit > 0 ? hit : modeledFallback;
  }

  const salesTarget =
    resolveDepartmentForecastTotal("Sales", fc) ??
    (safe(input.sales.summary?.targetGross) || safe(input.targets?.Sales));

  const monthlySalesDeals = input.sales.data.filter((deal) => {
    const d = new Date(deal.date);
    return d.getFullYear() === year && d.getMonth() + 1 === month;
  });

  const salesNewGross = monthlySalesDeals.filter((d) => d.dealType === "new").reduce((sum, d) => sum + safe(d.totalGross), 0);
  const salesUsedGross = monthlySalesDeals.filter((d) => d.dealType === "used").reduce((sum, d) => sum + safe(d.totalGross), 0);
  const salesFrontGross = monthlySalesDeals.reduce((sum, d) => sum + safe(d.frontGross), 0);
  const salesBackGross = monthlySalesDeals.reduce((sum, d) => sum + safe(d.backGross), 0);
  const salesTotalGrossFromDeals = monthlySalesDeals.reduce((sum, d) => sum + safe(d.totalGross), 0);
  const salesTotalGross = safe(input.sales.summary?.actualGross) || salesTotalGrossFromDeals;
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

  const salesLines: GrossLineTracking[] = [
    toLine({
      id: "sales-new-gross",
      department: "Sales",
      label: "New Vehicle Gross",
      actualGross: salesNewGross,
      targetGross: lineForecastTarget("Sales", "New Vehicle Gross", salesTarget * 0.45),
      daysUsed,
      daysAvailable,
      sourceMonthMatches: Boolean(salesLineage?.monthAligned),
      actualReliable: reliableFromLineage(salesLineage),
      source: "Parsed sales deals",
      explanation: "New-vehicle gross vs forecast row when matched; otherwise modeled share of department target.",
    }),
    toLine({
      id: "sales-used-gross",
      department: "Sales",
      label: "Used Vehicle Gross",
      actualGross: salesUsedGross,
      targetGross: lineForecastTarget("Sales", "Used Vehicle Gross", salesTarget * 0.55),
      daysUsed,
      daysAvailable,
      sourceMonthMatches: Boolean(salesLineage?.monthAligned),
      actualReliable: reliableFromLineage(salesLineage),
      source: "Parsed sales deals",
      explanation: "Used-vehicle gross vs forecast row when matched; otherwise modeled share of department target.",
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
  const serviceLines: GrossLineTracking[] = [
    toLine({
      id: "service-customer-gross",
      department: "Service",
      label: "Customer Gross",
      actualGross: safe(input.service.summary.gross.customer),
      targetGross: lineForecastTarget("Service", "Customer Gross", serviceTarget * 0.5),
      daysUsed,
      daysAvailable,
      sourceMonthMatches: Boolean(serviceLineage?.monthAligned),
      actualReliable: reliableFromLineage(serviceLineage),
      source: "Parsed service summary",
      explanation: "Customer-pay gross contribution tracking.",
    }),
    toLine({
      id: "service-warranty-gross",
      department: "Service",
      label: "Warranty Gross",
      actualGross: safe(input.service.summary.gross.warranty),
      targetGross: lineForecastTarget("Service", "Warranty Gross", serviceTarget * 0.25),
      daysUsed,
      daysAvailable,
      sourceMonthMatches: Boolean(serviceLineage?.monthAligned),
      actualReliable: reliableFromLineage(serviceLineage),
      source: "Parsed service summary",
      explanation: "Warranty gross contribution tracking.",
    }),
    toLine({
      id: "service-internal-gross",
      department: "Service",
      label: "Internal Gross",
      actualGross: safe(input.service.summary.gross.internal),
      targetGross: lineForecastTarget("Service", "Internal Gross", serviceTarget * 0.25),
      daysUsed,
      daysAvailable,
      sourceMonthMatches: Boolean(serviceLineage?.monthAligned),
      actualReliable: reliableFromLineage(serviceLineage),
      source: "Parsed service summary",
      explanation: "Internal gross contribution tracking.",
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
  const partsLines: GrossLineTracking[] = [
    toLine({
      id: "parts-customer-gross",
      department: "Parts",
      label: "Customer Gross",
      actualGross: safe(input.parts.summary.gross.customer),
      targetGross: lineForecastTarget("Parts", "Customer Gross", partsTarget * 0.5),
      daysUsed,
      daysAvailable,
      sourceMonthMatches: Boolean(partsLineage?.monthAligned),
      actualReliable: reliableFromLineage(partsLineage),
      source: "Parsed parts summary",
      explanation: "Customer parts gross contribution tracking.",
    }),
    toLine({
      id: "parts-warranty-gross",
      department: "Parts",
      label: "Warranty Gross",
      actualGross: safe(input.parts.summary.gross.warranty),
      targetGross: lineForecastTarget("Parts", "Warranty Gross", partsTarget * 0.2),
      daysUsed,
      daysAvailable,
      sourceMonthMatches: Boolean(partsLineage?.monthAligned),
      actualReliable: reliableFromLineage(partsLineage),
      source: "Parsed parts summary",
      explanation: "Warranty parts gross contribution tracking.",
    }),
    toLine({
      id: "parts-internal-gross",
      department: "Parts",
      label: "Internal Gross",
      actualGross: safe(input.parts.summary.gross.internal),
      targetGross: lineForecastTarget("Parts", "Internal Gross", partsTarget * 0.3),
      daysUsed,
      daysAvailable,
      sourceMonthMatches: Boolean(partsLineage?.monthAligned),
      actualReliable: reliableFromLineage(partsLineage),
      source: "Parsed parts summary",
      explanation: "Internal parts gross contribution tracking.",
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

  const categoryLines = input.parts.categoryBreakdown ?? [];
  const wholesale = categoryLines.find((c) => /wholesale/i.test(c.category));
  if (wholesale) {
    partsLines.push(
      toLine({
        id: "parts-wholesale-gross",
        department: "Parts",
        label: "Wholesale Gross",
        actualGross: safe(wholesale.gross),
        targetGross: safe(wholesale.gross),
        daysUsed: Math.max(daysUsed, 1),
        daysAvailable: Math.max(daysUsed, 1),
        sourceMonthMatches: Boolean(partsLineage?.monthAligned),
        actualReliable: reliableFromLineage(partsLineage),
        source: "Parsed parts category breakdown",
        explanation: "Low-confidence line from category breakdown (wholesale).",
      }),
    );
  }
  const gog = categoryLines.find((c) => /gog/i.test(c.category));
  if (gog) {
    partsLines.push(
      toLine({
        id: "parts-gog-gross",
        department: "Parts",
        label: "GOG Gross",
        actualGross: safe(gog.gross),
        targetGross: safe(gog.gross),
        daysUsed: Math.max(daysUsed, 1),
        daysAvailable: Math.max(daysUsed, 1),
        sourceMonthMatches: Boolean(partsLineage?.monthAligned),
        actualReliable: reliableFromLineage(partsLineage),
        source: "Parsed parts category breakdown",
        explanation: "Low-confidence line from category breakdown (GOG).",
      }),
    );
  }

  const departments: DepartmentGrossTracking[] = [
    departmentFromLines("Sales", salesLines),
    departmentFromLines("Service", serviceLines),
    departmentFromLines("Parts", partsLines),
  ];

  const EXCLUDE_FROM_BEST_WORST = new Set([
    "sales-gross-per-copy",
    "service-cp-labour",
    "parts-wholesale-gross",
    "parts-gog-gross",
  ]);

  const allLines = departments
    .flatMap((d) => d.lines)
    .filter((line) => line.gapToTarget !== null && !EXCLUDE_FROM_BEST_WORST.has(line.id));
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

