import {
  SheetMatrix,
  cleanCell,
  compactRow,
  isEmptyRow,
  normalizeCell,
  parseCurrency,
  parseNumber,
} from "@/src/lib/parsers/parse-utils";
import type { ForecastTrendItem } from "@/src/lib/parsers/forecast-parser";

const MONTH_TOKENS: { month: number; tokens: string[] }[] = [
  { month: 1, tokens: ["january", "jan"] },
  { month: 2, tokens: ["february", "feb"] },
  { month: 3, tokens: ["march", "mar"] },
  { month: 4, tokens: ["april", "apr"] },
  { month: 5, tokens: ["may"] },
  { month: 6, tokens: ["june", "jun"] },
  { month: 7, tokens: ["july", "jul"] },
  { month: 8, tokens: ["august", "aug"] },
  { month: 9, tokens: ["september", "sep", "sept"] },
  { month: 10, tokens: ["october", "oct"] },
  { month: 11, tokens: ["november", "nov"] },
  { month: 12, tokens: ["december", "dec"] },
];

function parseReportingMonth(monthKey: string): { year: number; month: number } | null {
  const [y, m] = monthKey.split("-").map(Number);
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) return null;
  return { year: y, month: m };
}

function cellMatchesMonth(cellNorm: string, month: number, year: number): boolean {
  const tokens = MONTH_TOKENS.find((row) => row.month === month)?.tokens ?? [];
  if (!tokens.some((t) => cellNorm === t || cellNorm.startsWith(`${t} `) || cellNorm.includes(` ${t} `))) {
    return false;
  }
  const yearStr = String(year);
  if (cellNorm.includes(yearStr)) return true;
  const shortYear = yearStr.slice(-2);
  return cellNorm.includes(shortYear) || !/\b20\d{2}\b/.test(cellNorm);
}

function findMonthColumn(rows: SheetMatrix, month: number, year: number, scanRows = 20): number | null {
  for (let r = 0; r < Math.min(scanRows, rows.length); r += 1) {
    const row = compactRow(rows[r]);
    for (let c = 0; c < row.length; c += 1) {
      if (cellMatchesMonth(normalizeCell(row[c]), month, year)) return c;
    }
  }
  return null;
}

function rowLabel(row: string[]): string {
  for (let i = 0; i < Math.min(4, row.length); i += 1) {
    const cell = cleanCell(row[i]);
    if (!cell) continue;
    if (parseCurrency(cell) !== null || parseNumber(cell) !== null) continue;
    if (MONTH_TOKENS.some((m) => m.tokens.includes(normalizeCell(cell)))) continue;
    return cell;
  }
  return "";
}

function inferSection(labelNorm: string): string | null {
  if (/new\s+vehicle/.test(labelNorm)) return "Sales New";
  if (/used\s+vehicle/.test(labelNorm)) return "Sales Used";
  if (/\bservice\b/.test(labelNorm) && !/\bparts\b/.test(labelNorm)) return "Service";
  if (/\bparts\b/.test(labelNorm)) return "Parts";
  if (/vehicle|sales/.test(labelNorm)) return "Sales";
  return null;
}

function toTrendItem(metric: string, forecast: number): ForecastTrendItem {
  return {
    metric,
    actual: 0,
    forecast,
    variance: -forecast,
    variancePercent: -100,
    direction: "below",
  };
}

function addItem(map: Map<string, ForecastTrendItem>, metric: string, forecast: number) {
  if (!Number.isFinite(forecast) || forecast === 0) return;
  const key = metric.toLowerCase();
  if (!map.has(key)) map.set(key, toTrendItem(metric, forecast));
}

/**
 * Parses annual/quarterly forecast workbooks with months across columns (e.g. 2026 Forecast Q2).
 * Produces ForecastTrendItem rows for the selected reporting month — actual is 0 (budget-only sheet).
 */
export function parseForecastWideSheet(
  rows: SheetMatrix,
  reportingMonthKey: string,
): { data: ForecastTrendItem[]; issues: string[]; monthColumn: number | null; monthLabel: string | null } {
  const issues: string[] = [];
  const parsed = parseReportingMonth(reportingMonthKey);
  if (!parsed) {
    return { data: [], issues: ["Invalid reporting month key for wide forecast parser."], monthColumn: null, monthLabel: null };
  }

  const monthColumn = findMonthColumn(rows, parsed.month, parsed.year);
  if (monthColumn === null) {
    return {
      data: [],
      issues: [`Unable to locate ${reportingMonthLabel(parsed.month)} column in annual forecast sheet.`],
      monthColumn: null,
      monthLabel: reportingMonthLabel(parsed.month),
    };
  }

  const items = new Map<string, ForecastTrendItem>();
  let currentSection: string | null = null;
  let newVehicleTotal: number | null = null;
  let usedVehicleTotal: number | null = null;
  let serviceTotal: number | null = null;
  let partsTotal: number | null = null;

  for (let r = 0; r < rows.length; r += 1) {
    if (isEmptyRow(rows[r])) continue;
    const row = compactRow(rows[r]);
    const label = rowLabel(row);
    if (!label) continue;

    const labelNorm = normalizeCell(label);
    if (/^sault|^forecast|^q[1-4]\s|^\d{4}\s/.test(labelNorm) && parseCurrency(row[monthColumn]) === null) {
      continue;
    }

    const section = inferSection(labelNorm);
    if (section && /gross\s+profit|department|^\s*(new|used)\s+vehicle/i.test(labelNorm)) {
      currentSection = section;
    }

    const value = parseCurrency(row[monthColumn]) ?? parseNumber(row[monthColumn]);
    if (value === null || Math.abs(value) < 1) continue;

    const metricBase = label.trim();
    const metric =
      currentSection && !labelNorm.includes(currentSection.toLowerCase())
        ? `${currentSection} — ${metricBase}`
        : metricBase;

    addItem(items, metric, value);

    if (/total\s+new\s+vehicle/.test(labelNorm)) newVehicleTotal = value;
    if (/total\s+used\s+vehicle/.test(labelNorm)) usedVehicleTotal = value;
    if (/total\s+service/.test(labelNorm) && !/\bparts\b/.test(labelNorm)) serviceTotal = value;
    if (/total\s+parts/.test(labelNorm)) partsTotal = value;

    if (/\bcustomer/.test(labelNorm) && currentSection === "Service") {
      addItem(items, "Service Customer Gross", value);
    }
    if (/\bwarranty/.test(labelNorm) && currentSection === "Service") {
      addItem(items, "Service Warranty Gross", value);
    }
    if (/\binternal/.test(labelNorm) && currentSection === "Service") {
      addItem(items, "Service Internal Gross", value);
    }
    if (/\bcustomer/.test(labelNorm) && currentSection === "Parts") {
      addItem(items, "Parts Customer Gross", value);
    }
    if (/\bwarranty/.test(labelNorm) && currentSection === "Parts") {
      addItem(items, "Parts Warranty Gross", value);
    }
    if (/\binternal/.test(labelNorm) && currentSection === "Parts") {
      addItem(items, "Parts Internal Gross", value);
    }
    if (/\bf\s*&\s*i\b|f and i|finance/.test(labelNorm) && currentSection === "Sales New") {
      addItem(items, "Sales New F&I Gross", value);
    }
    if (/\bf\s*&\s*i\b|f and i|finance/.test(labelNorm) && currentSection === "Sales Used") {
      addItem(items, "Sales Used F&I Gross", value);
    }
  }

  if (newVehicleTotal !== null) addItem(items, "New Vehicle Gross", newVehicleTotal);
  if (usedVehicleTotal !== null) addItem(items, "Used Vehicle Gross", usedVehicleTotal);
  if (newVehicleTotal !== null && usedVehicleTotal !== null) {
    addItem(items, "Total New and Used Gross", newVehicleTotal + usedVehicleTotal);
    addItem(items, "Total Sales Gross", newVehicleTotal + usedVehicleTotal);
  }
  if (serviceTotal !== null) {
    addItem(items, "Total Service Gross", serviceTotal);
    addItem(items, "Service Gross Total", serviceTotal);
  }
  if (partsTotal !== null) {
    addItem(items, "Total Parts Gross", partsTotal);
    addItem(items, "Parts Gross Total", partsTotal);
  }

  const data = [...items.values()];
  if (!data.length) {
    issues.push(`No forecast amounts found for ${reportingMonthLabel(parsed.month)} in annual workbook.`);
  } else {
    issues.push(`Parsed ${data.length} budget line(s) from annual forecast (${reportingMonthLabel(parsed.month)} column).`);
  }

  return {
    data,
    issues,
    monthColumn,
    monthLabel: reportingMonthLabel(parsed.month),
  };
}

function reportingMonthLabel(month: number): string {
  return MONTH_TOKENS.find((m) => m.month === month)?.tokens[0] ?? `month ${month}`;
}
