import { describe, expect, test } from "vitest";

import { parseSalesSheet } from "../sales-parser";

describe("Sales parser gross columns", () => {
  test("reads Front Gross / Back Gross / Total Gross headers with spaces", () => {
    const sheet = [
      [
        "",
        "Date",
        "Customer",
        "Manager",
        "Salesperson",
        "Vehicle",
        "Stock #",
        "1 2 3 4",
        "Trade",
        "ACV",
        "Trade Retail",
        "Business Manager",
        "Est. Term",
        "Front Gross",
        "Back Gross",
        "Total Gross",
        "LAG",
        "Source",
        "Notes",
        "Finance Status",
        "Status",
      ],
      [
        "",
        "Jul 2",
        "Naomi Perreria",
        "GSM",
        "Ron",
        "Rogue",
        "SN-1",
        "3",
        "",
        "",
        "",
        "BM",
        "72",
        "$576.12",
        "$3,638.25",
        "$4,214.37",
        "",
        "",
        "",
        "",
        "POSTED",
      ],
    ];

    const result = parseSalesSheet(sheet, "sales");
    expect(result.data).toHaveLength(1);
    expect(result.data[0].salesperson).toBe("Ron");
    expect(result.data[0].frontGross).toBeCloseTo(576.12, 2);
    expect(result.data[0].backGross).toBeCloseTo(3638.25, 2);
    expect(result.data[0].totalGross).toBeCloseTo(4214.37, 2);
    expect(result.data[0].estimatedTerm).toBe(72);
  });
});
