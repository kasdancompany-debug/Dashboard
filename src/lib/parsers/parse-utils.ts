export type SheetMatrix = string[][];

export function cleanCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).replace(/\s+/g, " ").trim();
}

export function normalizeCell(value: unknown): string {
  return cleanCell(value).toLowerCase();
}

export function isEmptyRow(row: unknown[]): boolean {
  return row.every((cell) => cleanCell(cell) === "");
}

export function compactRow(row: unknown[]): string[] {
  return row.map(cleanCell);
}

const FORMULA_ERROR_TOKENS = [
  "#REF!",
  "#DIV/0!",
  "#VALUE!",
  "#N/A",
  "#NAME?",
  "#NUM!",
  "#NULL!",
];

export function isSpreadsheetFormulaError(value: unknown): boolean {
  const raw = cleanCell(value);
  if (!raw) return false;
  const upper = raw.toUpperCase();
  return FORMULA_ERROR_TOKENS.some((token) => upper.includes(token));
}

/** Sample locations of Excel/Google Sheets formula errors for diagnostics. */
export function collectFormulaErrorDiagnostics(rows: SheetMatrix, maxSamples = 12): string[] {
  const samples: string[] = [];
  for (let r = 0; r < rows.length && samples.length < maxSamples; r += 1) {
    const row = rows[r] ?? [];
    for (let c = 0; c < row.length && samples.length < maxSamples; c += 1) {
      const cell = row[c];
      if (isSpreadsheetFormulaError(cell)) {
        const colLetter = String.fromCharCode(65 + Math.min(c, 25));
        samples.push(`Formula error ${cleanCell(cell)} at ${colLetter}${r + 1}`);
      }
    }
  }
  return samples;
}

export function parseCurrency(value: unknown): number | null {
  const raw = cleanCell(value);
  if (!raw) return null;
  if (isSpreadsheetFormulaError(raw)) return null;
  if (["nt", "tbd", "n/a"].includes(raw.toLowerCase())) return null;

  const isParenNegative = raw.startsWith("(") && raw.endsWith(")");
  const cleaned = raw.replace(/[\$,()%\s]/g, "");
  const parsed = Number(cleaned);
  if (!Number.isFinite(parsed)) return null;
  return isParenNegative ? -parsed : parsed;
}

export function parseNumber(value: unknown): number | null {
  const raw = cleanCell(value);
  if (!raw) return null;
  if (isSpreadsheetFormulaError(raw)) return null;
  if (["nt", "tbd", "n/a"].includes(raw.toLowerCase())) return null;
  const parsed = Number(raw.replace(/[,%\s]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

export function parsePercent(value: unknown): number | null {
  const raw = cleanCell(value);
  if (!raw) return null;
  const parsed = parseNumber(raw);
  if (parsed === null) return null;
  return raw.includes("%") ? parsed : parsed * 100;
}

export function parseDateLike(value: unknown, year = new Date().getFullYear()): string | null {
  const raw = cleanCell(value);
  if (!raw) return null;

  const parsed = new Date(`${raw} ${year}`);
  if (Number.isNaN(parsed.getTime())) {
    const isoTry = new Date(raw);
    if (Number.isNaN(isoTry.getTime())) return null;
    return isoTry.toISOString().slice(0, 10);
  }
  return parsed.toISOString().slice(0, 10);
}

export function hasAnyKeyword(text: string, keywords: string[]): boolean {
  const normalized = normalizeCell(text);
  return keywords.some((keyword) => normalized.includes(keyword));
}

export function findHeaderRow(rows: SheetMatrix, requiredKeywords: string[]): number {
  for (let i = 0; i < rows.length; i += 1) {
    const rowText = rows[i].map(normalizeCell).join(" ");
    const matches = requiredKeywords.filter((keyword) => rowText.includes(keyword)).length;
    if (matches >= Math.max(2, Math.floor(requiredKeywords.length / 2))) return i;
  }
  return -1;
}

export function rowObjectFromHeader(header: string[], row: string[]) {
  const map = new Map<string, string>();
  header.forEach((h, idx) => {
    map.set(normalizeCell(h), cleanCell(row[idx] ?? ""));
  });
  return map;
}

export function nowIso() {
  return new Date().toISOString();
}

export function partitionFormulaDiagnostics(issues: string[]): { formulaErrors: string[]; otherIssues: string[] } {
  const formulaErrors = issues.filter((i) => i.startsWith("Formula error"));
  const otherIssues = issues.filter((i) => !i.startsWith("Formula error"));
  return { formulaErrors, otherIssues };
}
