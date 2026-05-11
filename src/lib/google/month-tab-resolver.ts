const MONTH_INDEX: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function normalize(value: string) {
  return value.replace(/[.]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
}

function toCanonicalYear(value: number) {
  if (value >= 1000) return value;
  if (value >= 0 && value <= 99) return 2000 + value;
  return NaN;
}

export function canonicalMonthKey(year: number, month: number) {
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) return null;
  return `${Math.trunc(year)}-${pad2(Math.trunc(month))}`;
}

export function parseTabToCanonicalKey(tabName: string): { key: string; precision: "full-year" | "short-year" | "iso" } | null {
  const raw = normalize(tabName);
  if (!raw) return null;

  const iso = raw.match(/^(\d{4})-(\d{1,2})$/);
  if (iso) {
    const key = canonicalMonthKey(Number(iso[1]), Number(iso[2]));
    return key ? { key, precision: "iso" } : null;
  }

  const monthYear = raw.match(
    /^(jan|january|feb|february|mar|march|apr|april|may|jun|june|jul|july|aug|august|sep|sept|september|oct|october|nov|november|dec|december)[\s\-_]*(\d{2,4})$/,
  );
  if (!monthYear) return null;

  const month = MONTH_INDEX[monthYear[1]];
  const yearPart = Number(monthYear[2]);
  const year = toCanonicalYear(yearPart);
  const key = canonicalMonthKey(year, month);
  if (!key) return null;
  return { key, precision: yearPart >= 1000 ? "full-year" : "short-year" };
}

export function attemptedTabNamesForSelectedMonth(selectedKey: string): string[] {
  const [year, month] = selectedKey.split("-").map(Number);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) return [selectedKey];
  const monthFull = [
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
  ][month - 1];
  const monthAbbr = monthFull.slice(0, 3);
  const yy = String(year).slice(-2);
  return [`${year}-${pad2(month)}`, `${monthFull} ${year}`, `${monthAbbr} ${year}`, `${monthFull} ${yy}`, `${monthAbbr} ${yy}`];
}

function quarterFromMonth(month: number) {
  if (month < 1 || month > 12) return null;
  return Math.floor((month - 1) / 3) + 1;
}

function parseForecastQuarterTab(tabName: string): { year: number; quarter: number } | null {
  const raw = normalize(tabName);
  if (!raw) return null;
  const qy = raw.match(/\bq([1-4])\b[^0-9]*\b(20\d{2})\b/);
  if (qy) return { quarter: Number(qy[1]), year: Number(qy[2]) };
  const yq = raw.match(/\b(20\d{2})\b[^0-9]*\bq([1-4])\b/);
  if (yq) return { year: Number(yq[1]), quarter: Number(yq[2]) };
  return null;
}

export function attemptedForecastTabNamesForSelectedMonth(selectedKey: string): string[] {
  const [year, month] = selectedKey.split("-").map(Number);
  const quarter = quarterFromMonth(month);
  if (!Number.isFinite(year) || !quarter) return [selectedKey];
  return [`${year} Forecast Q${quarter}`, `Forecast ${year} Q${quarter}`, `Q${quarter} ${year}`, `${year} Q${quarter}`];
}

export function resolveForecastQuarterTab(selectedKey: string, availableTabNames: string[]) {
  const [year, month] = selectedKey.split("-").map(Number);
  const selectedQuarter = quarterFromMonth(month);
  const attemptedTabNames = attemptedForecastTabNamesForSelectedMonth(selectedKey);
  if (!Number.isFinite(year) || !selectedQuarter) {
    return { matched: false, matchedTab: null as string | null, attemptedTabNames, normalizedMatchedMonth: null as string | null };
  }
  const match = availableTabNames.find((tabName) => {
    const parsed = parseForecastQuarterTab(tabName);
    return Boolean(parsed && parsed.year === year && parsed.quarter === selectedQuarter);
  });
  return {
    matched: Boolean(match),
    matchedTab: match ?? null,
    normalizedMatchedMonth: match ? selectedKey : null,
    attemptedTabNames,
  };
}

type RankedCandidate = {
  tabName: string;
  key: string;
  precision: "full-year" | "short-year" | "iso";
  rank: number;
};

export function resolveMonthTab(selectedKey: string, availableTabNames: string[]) {
  const candidates: RankedCandidate[] = [];
  for (const tabName of availableTabNames) {
    const parsed = parseTabToCanonicalKey(tabName);
    if (!parsed) continue;
    if (parsed.key !== selectedKey) continue;
    const rank = parsed.precision === "full-year" ? 0 : parsed.precision === "short-year" ? 1 : 2;
    candidates.push({ tabName, key: parsed.key, precision: parsed.precision, rank });
  }
  candidates.sort((a, b) => a.rank - b.rank || a.tabName.localeCompare(b.tabName));
  const winner = candidates[0] ?? null;
  return {
    matched: Boolean(winner),
    matchedTab: winner?.tabName ?? null,
    normalizedMatchedMonth: winner?.key ?? null,
    attemptedTabNames: attemptedTabNamesForSelectedMonth(selectedKey),
  };
}

