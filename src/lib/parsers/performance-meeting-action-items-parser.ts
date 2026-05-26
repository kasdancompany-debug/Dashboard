export type PerformanceMeetingActionItem = {
  department: "Sales" | "Service";
  text: string;
};

function normalizeCell(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function isActionItemsHeader(cell: string, department: "sales" | "service") {
  const lower = cell.toLowerCase();
  return lower.includes(department) && lower.includes("action") && lower.includes("item");
}

function rowText(row: string[], startCol: number) {
  const parts: string[] = [];
  for (let c = startCol; c < Math.min(row.length, startCol + 5); c += 1) {
    const text = normalizeCell(row[c]);
    if (text) parts.push(text);
  }
  return parts.join(" ").trim();
}

function looksLikeMetricRow(text: string) {
  return /^(mtd|tracking|prior|forecast|new units|used units|total)/i.test(text);
}

function collectItemsBelow(
  rows: string[][],
  headerRow: number,
  headerCol: number,
  department: "Sales" | "Service",
): PerformanceMeetingActionItem[] {
  const out: PerformanceMeetingActionItem[] = [];
  let emptyStreak = 0;

  for (let r = headerRow + 1; r < Math.min(rows.length, headerRow + 14); r += 1) {
    const row = rows[r] ?? [];
    const text = rowText(row, headerCol);
    if (!text) {
      emptyStreak += 1;
      if (out.length > 0 && emptyStreak >= 2) break;
      continue;
    }
    emptyStreak = 0;

    const lower = text.toLowerCase();
    if (isActionItemsHeader(lower, department === "Sales" ? "sales" : "service")) break;
    if (looksLikeMetricRow(text)) break;

    out.push({ department, text });
  }

  return out;
}

/**
 * Reads Sales / Service action item blocks from the performance meeting workbook
 * (headers like "Sales Action Items" with commitments in rows below).
 */
export function parsePerformanceMeetingActionItems(rows: string[][]): PerformanceMeetingActionItem[] {
  const out: PerformanceMeetingActionItem[] = [];
  const seen = new Set<string>();

  for (let r = 0; r < rows.length; r += 1) {
    const row = rows[r] ?? [];
    for (let c = 0; c < row.length; c += 1) {
      const cell = normalizeCell(row[c]);
      if (!cell) continue;

      if (isActionItemsHeader(cell, "sales")) {
        for (const item of collectItemsBelow(rows, r, c, "Sales")) {
          const key = `sales|${item.text.toLowerCase()}`;
          if (!seen.has(key)) {
            seen.add(key);
            out.push(item);
          }
        }
      }

      if (isActionItemsHeader(cell, "service")) {
        for (const item of collectItemsBelow(rows, r, c, "Service")) {
          const key = `service|${item.text.toLowerCase()}`;
          if (!seen.has(key)) {
            seen.add(key);
            out.push(item);
          }
        }
      }
    }
  }

  const sales = out.filter((i) => i.department === "Sales");
  const service = out.filter((i) => i.department === "Service");
  return [...sales, ...service];
}
