import { describe, expect, test } from "vitest";

import { analyzeExecutiveDealSignals } from "../executive-deal-signals";

describe("analyzeExecutiveDealSignals", () => {
  test("counts hygiene buckets", () => {
    const deals = [
      {
        id: "1",
        dealType: "unknown" as const,
        totalGross: 1000,
        frontGross: 0,
        backGross: 500,
      },
      {
        id: "2",
        dealType: "new" as const,
        totalGross: 0,
        frontGross: 0,
        backGross: 0,
      },
      {
        id: "3",
        dealType: "used" as const,
        totalGross: 2000,
        frontGross: 0,
        backGross: 0,
      },
    ];
    const r = analyzeExecutiveDealSignals(deals as never[]);
    expect(r.unclassifiedDeals).toBe(1);
    expect(r.zeroGrossDeals).toBe(1);
    expect(r.missingFrontGrossDeals).toBe(2);
    expect(r.missingBackGrossDeals).toBe(1);
  });
});
