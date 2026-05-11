import {
  SheetMatrix,
  cleanCell,
  collectFormulaErrorDiagnostics,
  compactRow,
  findHeaderRow,
  hasAnyKeyword,
  normalizeCell,
  isEmptyRow,
  nowIso,
  parseCurrency,
  parseNumber,
} from "@/src/lib/parsers/parse-utils";
import { parseTabToCanonicalKey } from "@/src/lib/google/month-tab-resolver";

type ServiceParsed = {
  summary: {
    sales: { customer: number; warranty: number; internal: number; total: number };
    gross: { customer: number; warranty: number; internal: number; total: number };
    previousYear: number;
    forecast: number;
    actual: number;
    tracking: number;
    upDown: number;
    dailyCpLaborGoal: number;
  };
  advisorPerformance: Array<{
    name: string;
    csiScore: number;
    elr: number;
    hpro: number;
    cpRo: number;
    cpLabor: number;
    soldWildcards: number;
  }>;
};

export function parseServiceSheet(rows: SheetMatrix, sourceSheet: string) {
  const issues: string[] = [...collectFormulaErrorDiagnostics(rows)];

  const summary: ServiceParsed["summary"] = {
    sales: { customer: 0, warranty: 0, internal: 0, total: 0 },
    gross: { customer: 0, warranty: 0, internal: 0, total: 0 },
    previousYear: 0,
    forecast: 0,
    actual: 0,
    tracking: 0,
    upDown: 0,
    dailyCpLaborGoal: 0,
  };

  const readAtNullable = (row: string[], index: number): number | null => {
    if (index < 0) return null;
    const candidates = [index, index + 1, index - 1, index + 2].filter((i) => i >= 0);
    for (const i of candidates) {
      const parsed = parseCurrency(row[i]) ?? parseNumber(row[i]);
      if (parsed !== null) return parsed;
      const mergedForward = `${row[i] ?? ""}${row[i + 1] ?? ""}`;
      const mergedBackward = `${row[i - 1] ?? ""}${row[i] ?? ""}`;
      const merged = parseCurrency(mergedForward) ?? parseCurrency(mergedBackward);
      if (merged !== null) return merged;
    }
    return null;
  };

  const firstLabelCell = (row: string[]) => {
    for (let i = 0; i < Math.min(5, row.length); i += 1) {
      const cell = normalizeCell(row[i]);
      if (!cell) continue;
      if (cell === "$") continue;
      if (parseNumber(cell) !== null) continue;
      return cell;
    }
    return "";
  };

  const findAnchor = (row: string[], tokens: string[]) =>
    row.findIndex((cell) => tokens.some((token) => normalizeCell(cell).includes(token)));

  let forecastCol = 5;
  let actualCol = 7;
  let trackingCol = 12;
  let previousYearCol = 3;
  let upDownCol = 15;

  let section: "sales" | "gross" | null = null;
  let foundServiceSalesTotal = false;
  let foundServiceGrossTotal = false;
  let foundCpLabor = false;
  for (const rawRow of rows) {
    if (isEmptyRow(rawRow)) continue;
    const row = compactRow(rawRow);
    const rowText = row.map(normalizeCell).join(" ");
    const label = firstLabelCell(row);
    const forecastAnchor = findAnchor(row, ["forecast"]);
    const actualAnchor = findAnchor(row, ["actual"]);
    const trackingAnchor = findAnchor(row, ["tracking"]);
    const previousAnchor = findAnchor(row, ["previous year"]);
    if (forecastAnchor >= 0) forecastCol = forecastAnchor;
    if (actualAnchor >= 0) actualCol = actualAnchor;
    if (trackingAnchor >= 0) trackingCol = trackingAnchor;
    if (previousAnchor >= 0) previousYearCol = previousAnchor;
    if (findAnchor(row, ["up/down", "up down"]) >= 0) upDownCol = findAnchor(row, ["up/down", "up down"]);

    if (/\bsales\b/.test(rowText) && /\bforecast\b/.test(rowText)) {
      section = "sales";
      continue;
    }
    if (/\bgross\b/.test(rowText) && /\bforecast\b/.test(rowText)) {
      section = "gross";
      continue;
    }

    const actualValue = readAtNullable(row, actualCol);
    const trackingValue = readAtNullable(row, trackingCol);
    const forecastValue = readAtNullable(row, forecastCol);
    const previousYearValue = readAtNullable(row, previousYearCol);
    const upDownValue = readAtNullable(row, upDownCol);

    if (section === "sales") {
      if (label.includes("customer") && actualValue !== null) summary.sales.customer = actualValue;
      if (label.includes("warranty") && actualValue !== null) summary.sales.warranty = actualValue;
      if (label.includes("internal") && actualValue !== null) summary.sales.internal = actualValue;
      if (label === "total" && actualValue !== null) {
        summary.sales.total = actualValue;
        foundServiceSalesTotal = true;
      }
      if (label === "total") {
        if (forecastValue !== null) summary.forecast = forecastValue;
        if (actualValue !== null) {
          summary.actual = actualValue;
          foundCpLabor = true;
        }
        if (trackingValue !== null) summary.tracking = trackingValue;
        if (previousYearValue !== null) summary.previousYear = previousYearValue;
        if (upDownValue !== null) summary.upDown = upDownValue;
      }
    }

    if (section === "gross") {
      if (label.includes("customer") && actualValue !== null) summary.gross.customer = actualValue;
      if (label.includes("warranty") && actualValue !== null) summary.gross.warranty = actualValue;
      if (label.includes("internal") && actualValue !== null) summary.gross.internal = actualValue;
      if (label === "total" && actualValue !== null) {
        summary.gross.total = actualValue;
        foundServiceGrossTotal = true;
      }
      if (label === "total" && forecastValue !== null) {
        // Gross forecast is the correct target basis for service pacing.
        summary.forecast = forecastValue;
      }
      if (label === "total" && trackingValue !== null) {
        summary.tracking = trackingValue;
      }
    }

    if (row.some((cell) => normalizeCell(cell).includes("daily c/p labor department goal"))) {
      const goal = parseCurrency(row[row.length - 1]) ?? parseNumber(row[row.length - 1]);
      if (goal !== null) summary.dailyCpLaborGoal = goal;
    }
    if (label.includes("cp labour") || label.includes("c/p labour")) {
      if (actualValue !== null) {
        summary.actual = actualValue;
        foundCpLabor = true;
      }
    }
  }

  const advisorHeaderIdx = findHeaderRow(rows, ["advisor", "csi", "elr", "hpro", "cp ro"]);
  const advisorPerformance: ServiceParsed["advisorPerformance"] = [];

  if (advisorHeaderIdx >= 0) {
    for (let i = advisorHeaderIdx + 1; i < rows.length; i += 1) {
      const row = compactRow(rows[i]);
      if (isEmptyRow(row)) continue;
      const text = row.join(" ").toLowerCase();
      if (text.includes("total") || text.includes("summary")) continue;
      const name = cleanCell(row[0]);
      if (!name || hasAnyKeyword(name, ["advisor"])) continue;

      advisorPerformance.push({
        name,
        csiScore: parseNumber(row[1]) ?? 0,
        elr: parseCurrency(row[2]) ?? 0,
        hpro: parseNumber(row[3]) ?? 0,
        cpRo: parseNumber(row[4]) ?? 0,
        cpLabor: parseCurrency(row[5]) ?? 0,
        soldWildcards: parseNumber(row[6]) ?? 0,
      });
    }
  } else {
    issues.push("Advisor performance header not found.");
  }

  if (!foundServiceSalesTotal) issues.push("Service parser could not confidently locate sales total in top summary grid.");
  if (!foundServiceGrossTotal) issues.push("Service parser could not confidently locate gross total in top summary grid.");
  if (!foundCpLabor) issues.push("Service parser could not confidently locate CP labour actual value.");

  return {
    data: { summary, advisorPerformance },
    dataQualityIssues: [...new Set(issues)],
    parsedAt: nowIso(),
    sourceSheet,
  };
}

export function parseServiceSheetForMonth(
  rows: SheetMatrix,
  sourceSheet: string,
  month: number,
  year: number,
  options?: { resolvedTabName?: string | null; selectedMonthKey?: string },
) {
  const base = parseServiceSheet(rows, sourceSheet);
  const warnings = [...base.dataQualityIssues];
  if (options?.selectedMonthKey && options?.resolvedTabName) {
    const resolved = parseTabToCanonicalKey(options.resolvedTabName);
    if (!resolved || resolved.key !== options.selectedMonthKey) {
      warnings.push(`Service tab "${options.resolvedTabName}" may not match selected month ${options.selectedMonthKey}.`);
    }
  }
  const lines = [
    { label: "Customer Gross", value: base.data.summary.gross.customer },
    { label: "Warranty Gross", value: base.data.summary.gross.warranty },
    { label: "Internal Gross", value: base.data.summary.gross.internal },
    { label: "Total Service Gross", value: base.data.summary.gross.total },
    ...(base.data.summary.actual ? [{ label: "CP Labour", value: base.data.summary.actual }] : []),
  ];
  const confidence = Math.max(0, Math.min(100, 100 - warnings.length * 10));
  return {
    month,
    year,
    rows,
    summaries: {
      ...base.data.summary,
      advisorPerformance: base.data.advisorPerformance,
    },
    lines,
    warnings,
    confidence,
    parsedAt: base.parsedAt,
    sourceSheet: base.sourceSheet,
  };
}
