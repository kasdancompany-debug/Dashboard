import { describe, expect, test } from "vitest";

import { parsePartsSheet } from "../parts-parser";
import { parseSalesSheet } from "../sales-parser";
import { parseServiceSheet } from "../service-parser";

/** Matches live sheet layout: labels in column B, actuals in column H (index 7). */
function wideRow(cells: Record<number, string>, len = 18): string[] {
  const row = Array.from({ length: len }, () => "");
  Object.entries(cells).forEach(([k, v]) => {
    row[Number(k)] = v;
  });
  return row;
}

describe("Sales parser", () => {
  test("parses messy sales sheet rows", () => {
    const sheet = [
      ["Sault Nissan Sales Tracker"],
      ["", "", ""],
      ["Date", "Customer", "Manager", "Salesperson", "Vehicle", "StockNumber", "DealType", "Trade", "ACV", "TradeRetail", "BusinessManager", "EstimatedTerm", "FrontGross", "BackGross", "TotalGross", "Status", "Notes"],
      ["Apr 7", "Marina Hale", "R. McAllister", "A. Patel", "Rogue", "SN-1001", "NEW", "Sentra", "$12,500", "$14,995", "C. Levesque", "72", "$2,250", "$1,100", "$3,350", "Delivered", ""],
      ["Apr 7", "David Owen", "K. Brennan", "D. Khan", "Kicks", "TBD", "used", "", "", "", "TBD", "84", "($350)", "$1,950", "$1,600", "Incoming", "NT reserve"],
      ["TOTALS", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
    ];

    const result = parseSalesSheet(sheet, "sales-log");
    expect(result.data.length).toBe(2);
    expect(result.data[1].frontGross).toBe(-350);
    expect(result.data[1].status).toBe("incoming");
    expect(result.dataQualityIssues.some((i) => i.includes("TBD/NT"))).toBe(true);
  });
});

describe("Service parser", () => {
  test("parses service summary and advisor section", () => {
    const sheet = [
      ["Service Tracker"],
      wideRow({ 1: "sales" }),
      wideRow({ 1: "Customer", 7: "$312,600" }),
      wideRow({ 1: "Warranty", 7: "$128,300" }),
      wideRow({ 1: "Internal", 7: "$44,100" }),
      wideRow({
        1: "Total",
        3: "$462,500",
        5: "$515,000",
        7: "$485,000",
        12: "$501,200",
        15: "($13,800)",
      }),
      wideRow({ 1: "gross" }),
      wideRow({ 1: "Customer", 7: "$169,200" }),
      wideRow({ 1: "Warranty", 7: "$52,400" }),
      wideRow({ 1: "Internal", 7: "$14,800" }),
      wideRow({ 1: "Total", 7: "$236,400" }),
      wideRow({ 0: "Daily C/P Labor Department Goal", 17: "$140" }),
      ["Advisor", "CSI", "ELR", "HPRO", "CP RO", "CP Labor", "Wildcards"],
      ["J. Martin", "96.7", "$149.2", "3.1", "96", "$81,400", "18"],
      ["N. Caron", "94.1", "$141.8", "2.8", "84", "$69,400", "13"],
    ];

    const result = parseServiceSheet(sheet, "service-tracker");
    expect(result.data.summary.sales.total).toBe(485000);
    expect(result.data.summary.upDown).toBe(-13800);
    expect(result.data.advisorPerformance[0].name).toBe("J. Martin");
    expect(result.data.advisorPerformance[1].elr).toBe(141.8);
  });
});

describe("Parts parser", () => {
  test("parses parts summary and category breakdown", () => {
    const sheet = [
      ["Parts Tracker"],
      wideRow({ 1: "sales" }),
      wideRow({ 1: "Customer", 7: "$138,900" }),
      wideRow({ 1: "Warranty", 7: "$74,200" }),
      wideRow({ 1: "Internal", 7: "$96,800" }),
      wideRow({
        1: "Total",
        5: "$331,000",
        7: "$309,900",
        12: "$325,200",
        15: "($21,100)",
      }),
      wideRow({ 1: "gross" }),
      wideRow({ 1: "Customer", 7: "$51,200" }),
      wideRow({ 1: "Warranty", 7: "$20,500" }),
      wideRow({ 1: "Internal", 7: "$34,300" }),
      wideRow({ 1: "Total", 7: "$106,000" }),
      wideRow({ 1: "Accessories", 7: "$44,000" }),
      wideRow({ 1: "Tires", 7: "$38,500" }),
    ];

    const result = parsePartsSheet(sheet, "parts-tracker");
    expect(result.data.summary.sales.total).toBe(309900);
    expect(result.data.summary.upDown).toBe(-21100);
    expect(result.data.categoryBreakdown.length).toBe(2);
    expect(result.data.categoryBreakdown[0].category).toBe("Accessories");
    expect(result.data.categoryBreakdown[0].sales).toBe(44000);
    expect(result.data.categoryBreakdown[0].gross).toBe(44000);
  });
});
