import { describe, expect, test } from "vitest";

import { buildSalesLeaderboard } from "../sales-leaderboard";
import type { SalesDeal } from "@/src/lib/types/dealership";

function deal(partial: Partial<SalesDeal> & Pick<SalesDeal, "salesperson" | "totalGross">): SalesDeal {
  return {
    id: partial.id ?? "1",
    date: partial.date ?? "2026-05-01",
    customer: partial.customer ?? "Customer",
    salesperson: partial.salesperson,
    manager: partial.manager ?? "Manager",
    vehicle: partial.vehicle ?? "Rogue",
    stockNumber: partial.stockNumber ?? "SN-1",
    dealType: partial.dealType ?? "new",
    tradeVehicle: null,
    acv: 0,
    tradeRetail: 0,
    businessManager: "BM",
    estimatedTerm: 72,
    frontGross: partial.frontGross ?? 1000,
    backGross: partial.backGross ?? 500,
    totalGross: partial.totalGross,
    status: "delivered",
    notes: "",
  };
}

describe("buildSalesLeaderboard", () => {
  test("ranks salespeople by total gross from Daily Log column", () => {
    const rows = buildSalesLeaderboard([
      deal({ salesperson: "A. Patel", totalGross: 4000, frontGross: 2500, backGross: 1500, dealType: "new" }),
      deal({ salesperson: "A. Patel", totalGross: 3000, frontGross: 2000, backGross: 1000, dealType: "used" }),
      deal({ salesperson: "D. Khan", totalGross: 8000, frontGross: 5000, backGross: 3000, dealType: "new" }),
      deal({ salesperson: "TBD", totalGross: 9999 }),
    ]);

    expect(rows).toHaveLength(2);
    expect(rows[0].name).toBe("A. Patel");
    expect(rows[0].rank).toBe(1);
    expect(rows[0].units).toBe(2);
    expect(rows[0].totalGross).toBe(7000);
    expect(rows[0].newUnits).toBe(1);
    expect(rows[0].usedUnits).toBe(1);
    expect(rows[0].perCopy).toBe(3500);
    expect(rows[1].name).toBe("D. Khan");
    expect(rows[1].units).toBe(1);
    expect(rows[1].totalGross).toBe(8000);
  });
});
