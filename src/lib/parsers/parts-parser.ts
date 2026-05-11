import {
  SheetMatrix,
  collectFormulaErrorDiagnostics,
  compactRow,
  normalizeCell,
  isEmptyRow,
  nowIso,
  parseCurrency,
  parseNumber,
} from "@/src/lib/parsers/parse-utils";
import { parseTabToCanonicalKey } from "@/src/lib/google/month-tab-resolver";

type PartsParsed = {
  summary: {
    sales: { customer: number; warranty: number; internal: number; total: number };
    gross: { customer: number; warranty: number; internal: number; total: number };
    forecast: number;
    actual: number;
    tracking: number;
    upDown: number;
  };
  categoryBreakdown: Array<{ category: string; sales: number; gross: number }>;
};

export function parsePartsSheet(rows: SheetMatrix, sourceSheet: string) {
  const issues: string[] = [...collectFormulaErrorDiagnostics(rows)];
  const summary: PartsParsed["summary"] = {
    sales: { customer: 0, warranty: 0, internal: 0, total: 0 },
    gross: { customer: 0, warranty: 0, internal: 0, total: 0 },
    forecast: 0,
    actual: 0,
    tracking: 0,
    upDown: 0,
  };
  const categoryBreakdown: PartsParsed["categoryBreakdown"] = [];
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
  let section: "sales" | "gross" | null = null;
  let forecastCol = 5;
  let actualCol = 7;
  let trackingCol = 12;
  let upDownCol = 15;
  let foundPartsSalesTotal = false;
  let foundPartsGrossTotal = false;

  for (const rawRow of rows) {
    if (isEmptyRow(rawRow)) continue;
    const row = compactRow(rawRow);
    const rowText = row.map(normalizeCell).join(" ");
    const label = firstLabelCell(row);
    const forecastAnchor = findAnchor(row, ["forecast"]);
    const actualAnchor = findAnchor(row, ["actual"]);
    const trackingAnchor = findAnchor(row, ["tracking"]);
    const upDownAnchor = findAnchor(row, ["up/down", "up down"]);
    if (forecastAnchor >= 0) forecastCol = forecastAnchor;
    if (actualAnchor >= 0) actualCol = actualAnchor;
    if (trackingAnchor >= 0) trackingCol = trackingAnchor;
    if (upDownAnchor >= 0) upDownCol = upDownAnchor + 1;

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
    const upDownValue = readAtNullable(row, upDownCol);

    if (section === "sales") {
      if (label.includes("customer") && !label.includes("counter") && actualValue !== null) summary.sales.customer = actualValue;
      if (label.includes("warranty") && actualValue !== null) summary.sales.warranty = actualValue;
      if (label.includes("internal") && actualValue !== null) summary.sales.internal = actualValue;
      if (label === "total") {
        if (actualValue !== null) {
          summary.sales.total = actualValue;
          summary.actual = actualValue;
          foundPartsSalesTotal = true;
        }
        if (forecastValue !== null) summary.forecast = forecastValue;
        if (trackingValue !== null) summary.tracking = trackingValue;
        if (upDownValue !== null) summary.upDown = upDownValue;
      }
    }

    if (section === "gross") {
      if (label.includes("customer") && !label.includes("counter") && actualValue !== null) summary.gross.customer = actualValue;
      if (label.includes("warranty") && actualValue !== null) summary.gross.warranty = actualValue;
      if (label.includes("internal") && actualValue !== null) summary.gross.internal = actualValue;
      if (label === "total" && actualValue !== null) {
        summary.gross.total = actualValue;
        foundPartsGrossTotal = true;
      }
      if (label === "total" && forecastValue !== null) {
        // Gross forecast is the correct target basis for parts pacing.
        summary.forecast = forecastValue;
      }
      if (label === "total" && trackingValue !== null) {
        summary.tracking = trackingValue;
      }
    }

    if (
      row.length >= 3 &&
      (label.includes("counter") ||
        label.includes("accessories") ||
        label.includes("tires") ||
        label.includes("maintenance") ||
        label.includes("collision"))
    ) {
      categoryBreakdown.push({
        category: row[1] || row[0],
        sales: actualValue ?? 0,
        gross: readAtNullable(row, 7) ?? 0,
      });
    }
  }

  if (!foundPartsSalesTotal) issues.push("Parts parser could not confidently locate sales total in top summary grid.");
  if (!foundPartsGrossTotal) issues.push("Parts parser could not confidently locate gross total in top summary grid.");

  return {
    data: { summary, categoryBreakdown },
    dataQualityIssues: [...new Set(issues)],
    parsedAt: nowIso(),
    sourceSheet,
  };
}

export function parsePartsSheetForMonth(
  rows: SheetMatrix,
  sourceSheet: string,
  month: number,
  year: number,
  options?: { resolvedTabName?: string | null; selectedMonthKey?: string },
) {
  const base = parsePartsSheet(rows, sourceSheet);
  const warnings = [...base.dataQualityIssues];
  if (options?.selectedMonthKey && options?.resolvedTabName) {
    const resolved = parseTabToCanonicalKey(options.resolvedTabName);
    if (!resolved || resolved.key !== options.selectedMonthKey) {
      warnings.push(`Parts tab "${options.resolvedTabName}" may not match selected month ${options.selectedMonthKey}.`);
    }
  }
  const wholesale = base.data.categoryBreakdown.find((c) => /wholesale/i.test(c.category));
  const gog = base.data.categoryBreakdown.find((c) => /gog/i.test(c.category));
  const lines = [
    { label: "Customer Gross", value: base.data.summary.gross.customer },
    { label: "Warranty Gross", value: base.data.summary.gross.warranty },
    { label: "Internal Gross", value: base.data.summary.gross.internal },
    ...(wholesale ? [{ label: "Wholesale Gross", value: wholesale.gross }] : []),
    ...(gog ? [{ label: "GOG Gross", value: gog.gross }] : []),
    { label: "Total Parts Gross", value: base.data.summary.gross.total },
  ];
  const confidence = Math.max(0, Math.min(100, 100 - warnings.length * 10));
  return {
    month,
    year,
    rows,
    summaries: base.data.summary,
    lines,
    warnings,
    confidence,
    parsedAt: base.parsedAt,
    sourceSheet: base.sourceSheet,
  };
}
