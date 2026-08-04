import type { SalesDeal } from "@/src/lib/types/dealership";

export type SalesLeaderboardRow = {
  rank: number;
  name: string;
  units: number;
  totalGross: number;
  frontGross: number;
  backGross: number;
  perCopy: number;
  newUnits: number;
  usedUnits: number;
};

function normalizeName(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function isUsableName(name: string) {
  if (!name) return false;
  if (/^(tbd|nt|n\/a|na|unknown|-)$/i.test(name)) return false;
  return true;
}

/**
 * Aggregates Daily Log deals by Salesperson column for the expanded insights leaderboard.
 * Ranked by total gross (then units).
 */
export function buildSalesLeaderboard(deals: SalesDeal[], limit = 12): SalesLeaderboardRow[] {
  const grouped = new Map<
    string,
    { name: string; units: number; totalGross: number; frontGross: number; backGross: number; newUnits: number; usedUnits: number }
  >();

  for (const deal of deals) {
    const name = normalizeName(deal.salesperson ?? "");
    if (!isUsableName(name)) continue;

    const key = name.toLowerCase();
    const current = grouped.get(key) ?? {
      name,
      units: 0,
      totalGross: 0,
      frontGross: 0,
      backGross: 0,
      newUnits: 0,
      usedUnits: 0,
    };
    current.units += 1;
    current.totalGross += Number.isFinite(deal.totalGross) ? deal.totalGross : 0;
    current.frontGross += Number.isFinite(deal.frontGross) ? deal.frontGross : 0;
    current.backGross += Number.isFinite(deal.backGross) ? deal.backGross : 0;
    if (deal.dealType === "new") current.newUnits += 1;
    if (deal.dealType === "used") current.usedUnits += 1;
    grouped.set(key, current);
  }

  return Array.from(grouped.values())
    .sort((a, b) => b.totalGross - a.totalGross || b.units - a.units || a.name.localeCompare(b.name))
    .slice(0, Math.max(1, limit))
    .map((row, index) => ({
      rank: index + 1,
      name: row.name,
      units: row.units,
      totalGross: row.totalGross,
      frontGross: row.frontGross,
      backGross: row.backGross,
      perCopy: row.units > 0 ? row.totalGross / row.units : 0,
      newUnits: row.newUnits,
      usedUnits: row.usedUnits,
    }));
}
