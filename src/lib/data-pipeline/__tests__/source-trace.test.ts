import { describe, expect, test } from "vitest";

import {
  extractMonthFromSheetName,
  monthKeyFromParts,
  normalizeMonthName,
  reportingMonthLabelFromKey,
  resolveReportingMonthKey,
  validateDepartmentSource,
} from "../source-trace";

describe("normalizeMonthName", () => {
  test("maps abbreviations to canonical names", () => {
    expect(normalizeMonthName("apr")).toBe("April");
    expect(normalizeMonthName("MAY")).toBe("May");
    expect(normalizeMonthName("sept")).toBe("September");
  });

  test("returns null for unknown fragments", () => {
    expect(normalizeMonthName("foo")).toBeNull();
  });
});

describe("extractMonthFromSheetName", () => {
  test("parses APR 26 style tabs", () => {
    const ref = new Date(2026, 4, 4);
    expect(extractMonthFromSheetName("APR 26", ref)).toEqual({ year: 2026, month: 4 });
    expect(extractMonthFromSheetName("MAY 26", ref)).toEqual({ year: 2026, month: 5 });
  });

  test("parses April 2026 style tabs", () => {
    expect(extractMonthFromSheetName("April 2026", new Date(2026, 4, 1))).toEqual({ year: 2026, month: 4 });
  });

  test("returns null when month is not embedded", () => {
    expect(extractMonthFromSheetName("Log", new Date())).toBeNull();
  });
});

describe("validateDepartmentSource", () => {
  test("flags stale service tab when dashboard is May but tab is April", () => {
    const v = validateDepartmentSource("2026-05", { department: "service", sheetTab: "APR 26" }, new Date(2026, 4, 4));
    expect(v.monthAligned).toBe(false);
    expect(v.monthUnknown).toBe(false);
    expect(v.extractedSheetMonthKey).toBe("2026-04");
    expect(v.warning).toContain("SERVICE");
  });

  test("accepts aligned tab", () => {
    const v = validateDepartmentSource("2026-05", { department: "parts", sheetTab: "MAY 26" }, new Date(2026, 4, 4));
    expect(v.monthAligned).toBe(true);
    expect(v.warning).toBeUndefined();
  });
});

describe("resolveReportingMonthKey", () => {
  test("honors YYYY-MM query param", () => {
    expect(resolveReportingMonthKey("2026-03", new Date(2026, 4, 1))).toBe("2026-03");
  });

  test("falls back to reference date", () => {
    expect(resolveReportingMonthKey(undefined, new Date(2026, 4, 4))).toBe("2026-05");
  });
});

describe("reportingMonthLabelFromKey", () => {
  test("formats labels", () => {
    expect(reportingMonthLabelFromKey("2026-05")).toBe("May 2026");
  });
});

describe("monthKeyFromParts", () => {
  test("pads month", () => {
    expect(monthKeyFromParts(2026, 1)).toBe("2026-01");
  });
});
