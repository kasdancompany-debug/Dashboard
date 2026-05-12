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

export function parseForecastSheet(rows: SheetMatrix, sourceSheet: string) {
  const issues: string[] = [];
  const headerIdx = findHeaderRow(rows, ["forecast", "actual", "department", "metric"]);
  if (headerIdx < 0) {
    return {
      data: [] as ForecastTrendItem[],
      summary: {
        totalActual: 0,
        totalForecast: 0,
        variance: 0,
        variancePercent: 0,
      },
      topAbove: [] as ForecastTrendItem[],
      topBelow: [] as ForecastTrendItem[],
      dataQualityIssues: ["Unable to find forecast header row."],
      parsedAt: nowIso(),
      sourceSheet,
    };
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

  const totalActual = parsed.reduce((sum, item) => sum + item.actual, 0);
  const totalForecast = parsed.reduce((sum, item) => sum + item.forecast, 0);
  const totalVariance = totalActual - totalForecast;
  const totalVariancePercent = totalForecast === 0 ? 0 : (totalVariance / totalForecast) * 100;

  const topAbove = parsed
    .filter((item) => item.variancePercent > 0)
    .sort((a, b) => b.variancePercent - a.variancePercent)
    .slice(0, 3);

  const topBelow = parsed
    .filter((item) => item.variancePercent <= -5)
    .sort((a, b) => a.variancePercent - b.variancePercent)
    .slice(0, 3);

  return {
    data: parsed,
    summary: {
      totalActual,
      totalForecast,
      variance: totalVariance,
      variancePercent: totalVariancePercent,
    },
    topAbove,
    topBelow,
    dataQualityIssues: [...new Set(issues)],
    parsedAt: nowIso(),
    sourceSheet,
  };
}
