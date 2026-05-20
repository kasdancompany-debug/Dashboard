import {
  SheetMatrix,
  cleanCell,
  compactRow,
  findHeaderRow,
  isEmptyRow,
  nowIso,
  parseCurrency,
  parseNumber,
  rowObjectFromHeader,
} from "@/src/lib/parsers/parse-utils";
import { parseForecastWideSheet } from "@/src/lib/parsers/forecast-wide-parser";

export type ForecastTrendItem = {
  metric: string;
  actual: number;
  forecast: number;
  variance: number;
  variancePercent: number;
  direction: "above" | "below";
};

function readNumeric(cells: Map<string, string>, keys: string[], fallback: string[]) {
  for (const key of keys) {
    const value = parseCurrency(cells.get(key)) ?? parseNumber(cells.get(key));
    if (value !== null) return value;
  }
  for (const raw of fallback) {
    const value = parseCurrency(raw) ?? parseNumber(raw);
    if (value !== null) return value;
  }
  return null;
}

export type ParseForecastSheetOptions = {
  /** e.g. 2026-05 — required to read month columns in annual forecast workbooks */
  reportingMonthKey?: string;
};

function buildForecastParseResult(
  data: ForecastTrendItem[],
  dataQualityIssues: string[],
  sourceSheet: string,
) {
  const totalActual = data.reduce((sum, item) => sum + item.actual, 0);
  const totalForecast = data.reduce((sum, item) => sum + item.forecast, 0);
  const totalVariance = totalActual - totalForecast;
  const totalVariancePercent = totalForecast === 0 ? 0 : (totalVariance / totalForecast) * 100;
  const topAbove = data
    .filter((item) => item.variancePercent > 0)
    .sort((a, b) => b.variancePercent - a.variancePercent)
    .slice(0, 3);
  const topBelow = data
    .filter((item) => item.variancePercent <= -5)
    .sort((a, b) => a.variancePercent - b.variancePercent)
    .slice(0, 3);

  return {
    data,
    summary: {
      totalActual,
      totalForecast,
      variance: totalVariance,
      variancePercent: totalVariancePercent,
    },
    topAbove,
    topBelow,
    dataQualityIssues: [...new Set(dataQualityIssues)],
    parsedAt: nowIso(),
    sourceSheet,
  };
}

function parseForecastTableSheet(rows: SheetMatrix, sourceSheet: string) {
  const issues: string[] = [];
  const headerIdx = findHeaderRow(rows, ["forecast", "actual", "department", "metric"]);
  if (headerIdx < 0) {
    return null;
  }

  const header = compactRow(rows[headerIdx]);
  const parsed: ForecastTrendItem[] = [];

  for (let i = headerIdx + 1; i < rows.length; i += 1) {
    const row = compactRow(rows[i]);
    if (isEmptyRow(row)) continue;

    const cells = rowObjectFromHeader(header, row);
    const metric =
      cleanCell(cells.get("metric")) ||
      cleanCell(cells.get("department")) ||
      cleanCell(cells.get("category")) ||
      cleanCell(cells.get("line item")) ||
      cleanCell(row[0]);

    if (!metric || ["total", "totals", "summary", "overall"].includes(metric.toLowerCase())) continue;

    const actual =
      readNumeric(cells, ["actual", "actuals", "mtd actual", "gross actual"], [row[2] ?? "", row[1] ?? ""]) ?? 0;
    const forecast = readNumeric(
      cells,
      ["forecast", "budget", "target", "mtd forecast", "gross forecast"],
      [row[1] ?? "", row[2] ?? ""],
    );

    if (forecast === null || forecast === 0) {
      issues.push(`Row ${i + 1}: unable to parse forecast/target for "${metric}".`);
      continue;
    }

    const variance = actual - forecast;
    const variancePercent = (variance / forecast) * 100;
    parsed.push({
      metric,
      actual,
      forecast,
      variance,
      variancePercent,
      direction: variance >= 0 ? "above" : "below",
    });
  }

  return buildForecastParseResult(parsed, issues, sourceSheet);
}

/** Table layout (metric/actual/forecast) or wide annual layout (months as columns). */
export function parseForecastSheet(rows: SheetMatrix, sourceSheet: string, options?: ParseForecastSheetOptions) {
  const table = parseForecastTableSheet(rows, sourceSheet);
  if (table && table.data.length > 0) return table;

  const issues: string[] = table?.dataQualityIssues ?? ["Unable to find forecast header row."];

  if (options?.reportingMonthKey) {
    const wide = parseForecastWideSheet(rows, options.reportingMonthKey);
    if (wide.data.length > 0) {
      return buildForecastParseResult(
        wide.data,
        [...issues.filter((i) => !i.startsWith("Unable to find forecast header")), ...wide.issues],
        sourceSheet,
      );
    }
    issues.push(...wide.issues);
  }

  return buildForecastParseResult([], issues, sourceSheet);
}
