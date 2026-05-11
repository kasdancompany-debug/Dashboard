import { describe, expect, test } from "vitest";

import { parseTabToCanonicalKey, resolveForecastQuarterTab, resolveMonthTab } from "../month-tab-resolver";

describe("parseTabToCanonicalKey", () => {
  test("normalizes month tabs to canonical keys", () => {
    expect(parseTabToCanonicalKey("May 26")?.key).toBe("2026-05");
    expect(parseTabToCanonicalKey("MAY 2026")?.key).toBe("2026-05");
    expect(parseTabToCanonicalKey("Feb. 2026")?.key).toBe("2026-02");
    expect(parseTabToCanonicalKey("Jan. 2026")?.key).toBe("2026-01");
    expect(parseTabToCanonicalKey("APR 26")?.key).toBe("2026-04");
    expect(parseTabToCanonicalKey("MAY 25")?.key).toBe("2025-05");
  });
});

describe("resolveMonthTab", () => {
  test("selected May 2026 does not match MAY 25", () => {
    const result = resolveMonthTab("2026-05", ["MAY 25"]);
    expect(result.matched).toBe(false);
    expect(result.matchedTab).toBeNull();
  });

  test("selected May 2026 matches May 26", () => {
    const result = resolveMonthTab("2026-05", ["APR 26", "May 26"]);
    expect(result.matched).toBe(true);
    expect(result.matchedTab).toBe("May 26");
    expect(result.normalizedMatchedMonth).toBe("2026-05");
  });

  test("selected May 2026 matches May 2026", () => {
    const result = resolveMonthTab("2026-05", ["May 2026", "May 26"]);
    expect(result.matched).toBe(true);
    expect(result.matchedTab).toBe("May 2026");
    expect(result.normalizedMatchedMonth).toBe("2026-05");
  });

  test("selected April 2026 matches APR 26", () => {
    const result = resolveMonthTab("2026-04", ["APR 26", "MAY 26"]);
    expect(result.matched).toBe(true);
    expect(result.matchedTab).toBe("APR 26");
    expect(result.normalizedMatchedMonth).toBe("2026-04");
  });

  test("selected June 2025 matches JUNE 25", () => {
    const result = resolveMonthTab("2025-06", ["JUNE 25", "JUNE 26"]);
    expect(result.matched).toBe(true);
    expect(result.matchedTab).toBe("JUNE 25");
    expect(result.normalizedMatchedMonth).toBe("2025-06");
  });
});

describe("resolveForecastQuarterTab", () => {
  test("matches Q1 tab for January 2026", () => {
    const result = resolveForecastQuarterTab("2026-01", ["2026 Forecast Q1", "2026 Forecast Q2"]);
    expect(result.matched).toBe(true);
    expect(result.matchedTab).toBe("2026 Forecast Q1");
    expect(result.normalizedMatchedMonth).toBe("2026-01");
  });

  test("does not match wrong quarter for February 2026", () => {
    const result = resolveForecastQuarterTab("2026-02", ["2026 Forecast Q2"]);
    expect(result.matched).toBe(false);
    expect(result.matchedTab).toBeNull();
  });
});

