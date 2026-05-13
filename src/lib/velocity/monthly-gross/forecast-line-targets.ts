import type { ForecastTrendItem } from "@/src/lib/parsers/forecast-parser";
import type { MonthlyGrossDepartment } from "@/src/lib/velocity/monthly-gross/types";

function norm(s: string) {
  return s
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/\s+/g, " ")
    .trim();
}

function metricConflictsDepartment(metricNorm: string, department: MonthlyGrossDepartment): boolean {
  if (department === "Forecast") return false;
  if (department === "Sales") {
    if (/\bservice\b/.test(metricNorm) && !/sales\s+service|service\s+sales/.test(metricNorm)) return true;
    if (/\bparts\b/.test(metricNorm) && !/sales\s+parts/.test(metricNorm)) return true;
  }
  if (department === "Service") {
    if (/\bparts\b/.test(metricNorm) && !/service\s+parts/.test(metricNorm)) return true;
    if (/\bsales\b/.test(metricNorm) && !/service\s+sales|sales\s+service/.test(metricNorm)) return true;
  }
  if (department === "Parts") {
    if (/\bservice\b/.test(metricNorm) && !/parts\s+service/.test(metricNorm)) return true;
    if (/\bsales\b/.test(metricNorm) && !/parts\s+sales|sales\s+parts/.test(metricNorm)) return true;
  }
  return false;
}

function firstForecastMatch(
  items: ForecastTrendItem[],
  needles: string[],
  department: MonthlyGrossDepartment,
): number | null {
  for (const needle of needles) {
    const n = norm(needle);
    for (const row of items) {
      const m = norm(row.metric);
      if (metricConflictsDepartment(m, department)) continue;
      if (!m.includes(n) && !n.includes(m)) continue;
      if (typeof row.forecast === "number" && Number.isFinite(row.forecast) && row.forecast !== 0) {
        return row.forecast;
      }
    }
  }
  return null;
}

const DEPT_TOTAL_NEEDLES: Record<MonthlyGrossDepartment, string[][]> = {
  Sales: [
    ["total sales gross", "sales department total", "sales gross total", "vehicle sales total", "total vehicle gross"],
    ["total new and used gross", "total new & used gross", "new and used gross total", "total gross sales"],
    ["sales total", "total sales"],
  ],
  Service: [
    ["total service gross", "service gross total", "service department total", "total service department gross"],
    ["service total gross", "total gross service"],
  ],
  Parts: [
    ["total parts gross", "parts gross total", "parts department total", "total parts department gross"],
    ["parts total gross", "total gross parts"],
  ],
  Forecast: [],
};

export function resolveDepartmentForecastTotal(
  department: MonthlyGrossDepartment,
  items: ForecastTrendItem[] | null | undefined,
): number | null {
  if (!items?.length) return null;
  for (const group of DEPT_TOTAL_NEEDLES[department]) {
    const hit = firstForecastMatch(items, group, department);
    if (hit !== null) return hit;
  }
  return null;
}

const LINE_NEEDLES: Record<string, string[]> = {
  "Sales:Front Gross": [
    "sales front gross",
    "front gross sales",
    "vehicle front gross",
    "front-end gross",
    "frontend gross",
    "front gross",
    "fe gross",
    "front pru",
  ],
  "Sales:Back Gross": [
    "sales back gross",
    "back gross sales",
    "vehicle back gross",
    "back-end gross",
    "f and i gross",
    "f&i gross",
    "fi gross",
    "back gross",
  ],
  "Sales:Total Gross": [
    "total sales gross",
    "sales gross total",
    "total new and used gross",
    "total new & used gross",
    "new and used gross",
    "total vehicle gross",
    "total gross",
  ],
  "Sales:New Vehicle Gross": ["new vehicle gross", "new car gross", "new gross", "new units gross", "new retail gross"],
  "Sales:Used Vehicle Gross": ["used vehicle gross", "used car gross", "used gross", "used units gross", "used retail gross"],
  "Service:Customer Gross": [
    "service customer gross",
    "customer pay gross",
    "customer gross service",
    "cp gross",
    "customer gross",
    "customer-pay gross",
  ],
  "Service:Warranty Gross": ["service warranty gross", "warranty gross service", "warranty gross"],
  "Service:Internal Gross": ["service internal gross", "internal gross service", "internal gross"],
  "Service:Total Service Gross": ["total service gross", "service gross total", "service total gross", "total gross service"],
  "Parts:Customer Gross": ["parts customer gross", "customer gross parts", "parts customer", "customer parts gross"],
  "Parts:Warranty Gross": ["parts warranty gross", "warranty gross parts", "parts warranty"],
  "Parts:Internal Gross": ["parts internal gross", "internal gross parts", "parts internal"],
  "Parts:Total Parts Gross": ["total parts gross", "parts gross total", "parts total gross", "total gross parts"],
};

export function resolveForecastTargetForLine(
  department: MonthlyGrossDepartment,
  lineLabel: string,
  items: ForecastTrendItem[] | null | undefined,
): number | null {
  if (!items?.length) return null;
  const key = `${department}:${lineLabel}`;
  const needles = LINE_NEEDLES[key];
  if (!needles) return null;
  return firstForecastMatch(items, needles, department);
}
