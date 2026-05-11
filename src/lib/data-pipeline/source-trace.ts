import type { FetchedSheetRows, SheetKind } from "@/src/lib/google/sheets-client";

export type SourceFreshnessStatus = "fresh" | "stale" | "error" | "unknown";

export type MetricTrace = {
  workbookFileLabel: string;
  workbookId: string;
  sheetTab: string;
  cellOrRange: string;
  reportingMonth: string;
  reportingMonthLabel: string;
  lastSynced: string;
  freshnessStatus: SourceFreshnessStatus;
  formulaErrorsPresent: boolean;
};

export type DepartmentSourceValidation = {
  department: SheetKind;
  sheetTab: string | null;
  dashboardReportingMonth: string;
  extractedSheetMonthKey: string | null;
  monthAligned: boolean;
  monthUnknown: boolean;
  warning?: string;
};

export type DepartmentSourceRow = {
  department: SheetKind;
  workbookTitle: string | null;
  workbookId: string;
  range: string;
  tabName: string | null;
  lastSynced: string;
  formulaErrorMessages: string[];
  parserIssues: string[];
};

export type LivePipelineMeta = {
  reportingMonth: string;
  reportingMonthLabel: string;
  sourceHealth: SourceHealthPayload;
  lineage: Array<{
    source: SheetKind;
    connectionStatus: "connected" | "excluded" | "error";
    sheetTitle: string | null;
    attemptedTabNames: string[];
    availableTabNames: string[];
    selectedMonth: string;
    matchedMonthTab: string | null;
    normalizedMatchedMonth: string | null;
    sourceSheetId: string;
    selectedGid: string | null;
    resolvedTabName: string | null;
    resolvedRange: string;
    rowsFetched: number;
    firstRowsPreview: string[][];
    monthDetectedFromSource: string | null;
    monthAligned: boolean;
    excluded: boolean;
    exclusionReason: string | null;
    rawParsedTotals: Record<string, number | null>;
    warnings: string[];
  }>;
  metricTraces: {
    sales: MetricTrace;
    service: MetricTrace;
    parts: MetricTrace;
    /** Present when forecast sheet is loaded (live-summary API). */
    forecast?: MetricTrace;
  };
};

export type SourceHealthPayload = {
  reportingMonth: string;
  reportingMonthLabel: string;
  lastSynced: string;
  overallFreshness: SourceFreshnessStatus;
  staleDataWarnings: string[];
  fallbackNotices: string[];
  departments: Array<{
    department: SheetKind;
    workbookTitle: string | null;
    workbookId: string;
    sheetTab: string | null;
    range: string;
    lastSynced: string;
    freshnessStatus: SourceFreshnessStatus;
    monthAligned: boolean;
    monthUnknown: boolean;
    extractedSheetMonthKey: string | null;
    fallbackUsed: boolean;
    fallbackLabel: string | null;
    validationWarning?: string;
    formulaErrors: string[];
    parserIssueCount: number;
  }>;
};

const MONTH_WORDS: Record<string, number> = {
  january: 1,
  jan: 1,
  february: 2,
  feb: 2,
  march: 3,
  mar: 3,
  april: 4,
  apr: 4,
  may: 5,
  june: 6,
  jun: 6,
  july: 7,
  jul: 7,
  august: 8,
  aug: 8,
  september: 9,
  sep: 9,
  sept: 9,
  october: 10,
  oct: 10,
  november: 11,
  nov: 11,
  december: 12,
  dec: 12,
};

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

export function reportingMonthKeyFromDate(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}

export function reportingMonthLabelFromKey(key: string): string {
  const [y, m] = key.split("-").map(Number);
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) return key;
  const labels = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  return `${labels[m - 1]} ${y}`;
}

/** Accepts `YYYY-MM` or falls back to the reference date's calendar month. */
export function resolveReportingMonthKey(input: string | null | undefined, reference = new Date()): string {
  if (input && /^\d{4}-\d{2}$/.test(input.trim())) {
    const [y, m] = input.trim().split("-").map(Number);
    if (m >= 1 && m <= 12 && y >= 2000 && y <= 2100) return `${y}-${pad2(m)}`;
  }
  return reportingMonthKeyFromDate(reference);
}

/**
 * Normalizes free-text month tokens to a canonical English month name for display/comparison.
 * Returns null if no recognizable month token is found.
 */
export function normalizeMonthName(fragment: string): string | null {
  const key = fragment.trim().toLowerCase().replace(/\./g, "");
  if (!key) return null;
  const monthNum = MONTH_WORDS[key];
  if (!monthNum) return null;
  const labels = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  return labels[monthNum - 1];
}

function twoDigitYearToFull(y2: number, referenceYear: number): number {
  if (y2 >= 100) return y2;
  const century = referenceYear - (referenceYear % 100);
  let y = century + y2;
  if (y > referenceYear + 15) y -= 100;
  if (y < referenceYear - 80) y += 100;
  return y;
}

/**
 * Best-effort parse of month/year encoded in a Google Sheet tab name (e.g. "APR 26", "April 2026", "MAY 2026").
 */
export function extractMonthFromSheetName(
  tabName: string,
  referenceDate = new Date(),
): { year: number; month: number } | null {
  const raw = tabName.replace(/\s+/g, " ").trim();
  if (!raw) return null;

  const refY = referenceDate.getFullYear();

  const fullMonthYear = raw.match(
    /\b(january|february|march|april|may|june|july|august|september|october|november|december)\b[^0-9]{0,6}(\d{4})\b/i,
  );
  if (fullMonthYear) {
    const m = MONTH_WORDS[fullMonthYear[1].toLowerCase()];
    const y = Number(fullMonthYear[2]);
    if (m && Number.isFinite(y)) return { year: y, month: m };
  }

  const abbrYear = raw.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)\b[^0-9]{0,4}(\d{2,4})\b/i);
  if (abbrYear) {
    const m = MONTH_WORDS[abbrYear[1].toLowerCase()];
    const yPart = Number(abbrYear[2]);
    if (m && Number.isFinite(yPart)) {
      const year = yPart >= 100 ? yPart : twoDigitYearToFull(yPart, refY);
      return { year, month: m };
    }
  }

  const ym = raw.match(/\b(20\d{2})[\s\-_/](\d{1,2})\b/);
  if (ym) {
    const year = Number(ym[1]);
    const month = Number(ym[2]);
    if (month >= 1 && month <= 12) return { year, month };
  }

  const my = raw.match(/\b(\d{1,2})[\s\-_/](20\d{2})\b/);
  if (my) {
    const month = Number(my[1]);
    const year = Number(my[2]);
    if (month >= 1 && month <= 12) return { year, month };
  }

  return null;
}

export function monthKeyFromParts(year: number, month: number): string {
  return `${year}-${pad2(month)}`;
}

export function validateDepartmentSource(
  dashboardReportingMonth: string,
  ctx: { department: SheetKind; sheetTab: string | null },
  referenceDate = new Date(),
): DepartmentSourceValidation {
  const tab = ctx.sheetTab?.trim() || null;
  if (!tab) {
    return {
      department: ctx.department,
      sheetTab: null,
      dashboardReportingMonth,
      extractedSheetMonthKey: null,
      monthAligned: false,
      monthUnknown: true,
      warning: "No sheet tab could be resolved for the selected reporting month from available tabs.",
    };
  }

  if (ctx.department === "forecast") {
    const normalized = tab.toLowerCase().replace(/\s+/g, " ");
    const quarterMatch = normalized.match(/\bq([1-4])\b/);
    const yearMatch = normalized.match(/\b(20\d{2})\b/);
    const [selectedYear, selectedMonth] = dashboardReportingMonth.split("-").map(Number);
    const selectedQuarter = Number.isFinite(selectedMonth) ? Math.floor((selectedMonth - 1) / 3) + 1 : null;
    const quarter = quarterMatch ? Number(quarterMatch[1]) : null;
    const year = yearMatch ? Number(yearMatch[1]) : null;
    const quarterAligned = Boolean(
      quarter &&
        year &&
        selectedQuarter &&
        Number.isFinite(selectedYear) &&
        quarter === selectedQuarter &&
        year === selectedYear,
    );
    return {
      department: ctx.department,
      sheetTab: tab,
      dashboardReportingMonth,
      extractedSheetMonthKey: quarterAligned ? dashboardReportingMonth : null,
      monthAligned: quarterAligned,
      monthUnknown: !quarter || !year,
      warning: quarterAligned
        ? undefined
        : `FORECAST tab "${tab}" does not match ${reportingMonthLabelFromKey(
            dashboardReportingMonth,
          )} quarter/year.`,
    };
  }

  const extracted = extractMonthFromSheetName(tab, referenceDate);
  if (!extracted) {
    return {
      department: ctx.department,
      sheetTab: tab,
      dashboardReportingMonth,
      extractedSheetMonthKey: null,
      monthAligned: false,
      monthUnknown: true,
      warning: `Tab "${tab}" does not include a recognizable month/year. Confirm the active tab matches ${reportingMonthLabelFromKey(
        dashboardReportingMonth,
      )}.`,
    };
  }

  const sheetKey = monthKeyFromParts(extracted.year, extracted.month);
  const monthAligned = sheetKey === dashboardReportingMonth;

  return {
    department: ctx.department,
    sheetTab: tab,
    dashboardReportingMonth,
    extractedSheetMonthKey: sheetKey,
    monthAligned,
    monthUnknown: false,
    warning: monthAligned
      ? undefined
      : `${ctx.department.toUpperCase()} tab "${tab}" looks like ${reportingMonthLabelFromKey(
          sheetKey,
        )}, but the dashboard reporting month is ${reportingMonthLabelFromKey(dashboardReportingMonth)}.`,
  };
}

export function getSourceFreshnessStatus(input: {
  monthAligned: boolean;
  monthUnknown: boolean;
  hasFormulaErrors: boolean;
}): SourceFreshnessStatus {
  if (input.hasFormulaErrors) return "error";
  if (input.monthUnknown) return "unknown";
  if (!input.monthAligned) return "stale";
  return "fresh";
}

export function getMetricTrace(params: {
  workbookTitle: string | null;
  workbookId: string;
  sheetTab: string;
  cellOrRange: string;
  reportingMonth: string;
  lastSynced: string;
  freshnessStatus: SourceFreshnessStatus;
  formulaErrorsPresent: boolean;
}): MetricTrace {
  const reportingMonthLabel = reportingMonthLabelFromKey(params.reportingMonth);
  const workbookFileLabel = params.workbookTitle?.trim() || `Google Sheet (${params.workbookId})`;
  return {
    workbookFileLabel,
    workbookId: params.workbookId,
    sheetTab: params.sheetTab,
    cellOrRange: params.cellOrRange,
    reportingMonth: params.reportingMonth,
    reportingMonthLabel,
    lastSynced: params.lastSynced,
    freshnessStatus: params.freshnessStatus,
    formulaErrorsPresent: params.formulaErrorsPresent,
  };
}

export function formatMetricTraceHoverLine(trace: MetricTrace): string {
  return `Pulled from ${trace.workbookFileLabel} → ${trace.sheetTab} → ${trace.cellOrRange}. Reporting ${trace.reportingMonthLabel}. Last synced ${trace.lastSynced}.`;
}

export function metricTraceWithCell(trace: MetricTrace, cellOrRange: string): MetricTrace {
  return { ...trace, cellOrRange };
}

export function buildStaleDataWarnings(validations: DepartmentSourceValidation[]): string[] {
  const messages: string[] = [];
  for (const v of validations) {
    if (v.warning && !v.monthAligned) messages.push(v.warning);
  }
  return [...new Set(messages)];
}

export function buildSourceHealthPayload(
  reportingMonth: string,
  rows: DepartmentSourceRow[],
  validations: DepartmentSourceValidation[],
): SourceHealthPayload {
  const reportingMonthLabel = reportingMonthLabelFromKey(reportingMonth);
  const lastSynced = rows.reduce((latest, r) => (r.lastSynced > latest ? r.lastSynced : latest), rows[0]?.lastSynced ?? new Date().toISOString());

  const departments = rows.map((r) => {
    const v = validations.find((x) => x.department === r.department);
    const formulaErrors = r.formulaErrorMessages;
    const hasFormulaErrors = formulaErrors.length > 0;
    const monthAligned = v?.monthAligned ?? false;
    const monthUnknown = v?.monthUnknown ?? true;
    const fallbackUsed = false;
    const fallbackLabel = null;
    const freshnessStatus = getSourceFreshnessStatus({ monthAligned, monthUnknown, hasFormulaErrors });

    return {
      department: r.department,
      workbookTitle: r.workbookTitle,
      workbookId: r.workbookId,
      sheetTab: r.tabName,
      range: r.range,
      lastSynced: r.lastSynced,
      freshnessStatus,
      monthAligned,
      monthUnknown,
      extractedSheetMonthKey: v?.extractedSheetMonthKey ?? null,
      fallbackUsed,
      fallbackLabel,
      validationWarning: v?.warning,
      formulaErrors,
      parserIssueCount: r.parserIssues.length,
    };
  });

  const fallbackNotices: string[] = [];

  const overallFreshness = departments.some((d) => d.freshnessStatus === "error")
    ? "error"
    : departments.some((d) => d.freshnessStatus === "stale")
      ? "stale"
      : departments.every((d) => d.freshnessStatus === "fresh")
        ? "fresh"
        : "unknown";

  return {
    reportingMonth,
    reportingMonthLabel,
    lastSynced,
    overallFreshness,
    staleDataWarnings: buildStaleDataWarnings(validations),
    fallbackNotices: [...new Set(fallbackNotices)],
    departments,
  };
}

export function departmentRowFromFetch(
  fetched: FetchedSheetRows,
  formulaErrorMessages: string[],
  parserIssues: string[],
): DepartmentSourceRow {
  return {
    department: fetched.kind,
    workbookTitle: fetched.workbookTitle,
    workbookId: fetched.sheetId,
    range: fetched.range,
    tabName: fetched.tabName,
    lastSynced: fetched.lastSynced,
    formulaErrorMessages,
    parserIssues,
  };
}

export function buildDepartmentMetricTrace(
  row: DepartmentSourceRow,
  validation: DepartmentSourceValidation | undefined,
  reportingMonth: string,
  cellOrRange: string,
): MetricTrace {
  const hasFormulaErrors = row.formulaErrorMessages.length > 0;
  const monthAligned = validation?.monthAligned ?? false;
  const monthUnknown = validation?.monthUnknown ?? true;
  const freshnessStatus = getSourceFreshnessStatus({ monthAligned, monthUnknown, hasFormulaErrors });
  const tab = row.tabName ?? "(default tab)";
  return getMetricTrace({
    workbookTitle: row.workbookTitle,
    workbookId: row.workbookId,
    sheetTab: tab,
    cellOrRange,
    reportingMonth,
    lastSynced: row.lastSynced,
    freshnessStatus,
    formulaErrorsPresent: hasFormulaErrors,
  });
}
