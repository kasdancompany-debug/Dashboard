import { SalesDeal } from "@/src/lib/types/dealership";
import {
  SheetMatrix,
  cleanCell,
  collectFormulaErrorDiagnostics,
  compactRow,
  findHeaderRow,
  hasAnyKeyword,
  isEmptyRow,
  nowIso,
  parseCurrency,
  parseDateLike,
  parseNumber,
  rowObjectFromHeader,
} from "@/src/lib/parsers/parse-utils";

export function parseSalesSheet(rows: SheetMatrix, sourceSheet: string) {
  const issues: string[] = [...collectFormulaErrorDiagnostics(rows)];
  const parsed: SalesDeal[] = [];
  let currentSectionDealType: "new" | "used" | null = null;

  const headerIdx = findHeaderRow(rows, ["date", "customer", "salesperson", "manager", "front", "back", "total"]);
  if (headerIdx < 0) {
    return {
      data: [],
      dataQualityIssues: [...issues, "Unable to find sales header row."],
      parsedAt: nowIso(),
      sourceSheet,
    };
  }

  const header = compactRow(rows[headerIdx]);
  for (let i = headerIdx + 1; i < rows.length; i += 1) {
    const row = compactRow(rows[i]);
    if (isEmptyRow(row)) continue;

    const joined = row.join(" ");
    const joinedLower = joined.toLowerCase();
    if (joinedLower.includes("new vehicles")) {
      currentSectionDealType = "new";
      continue;
    }
    if (joinedLower.includes("used vehicles")) {
      currentSectionDealType = "used";
      continue;
    }
    if (hasAnyKeyword(joined, ["section", "summary", "totals", "sales log"])) continue;

    const cells = rowObjectFromHeader(header, row);
    const dateRaw = cells.get("date") ?? row[1] ?? row[0];
    const customer = cells.get("customer") ?? row[2] ?? row[1];
    if (!customer || hasAnyKeyword(customer, ["customer", "total", "target units"])) continue;

    const id = cleanCell(cells.get("id") ?? `sales-${i + 1}`);
    const parsedDate = parseDateLike(dateRaw) ?? nowIso().slice(0, 10);
    const manager = cleanCell(cells.get("manager") ?? row[3] ?? row[2]);
    const salesperson = cleanCell(cells.get("salesperson") ?? row[4] ?? row[3]);
    if (!salesperson || hasAnyKeyword(salesperson, ["target gross", "salesperson"])) continue;
    const vehicle = cleanCell(cells.get("vehicle") ?? row[5] ?? row[4]);
    const stockNumber = cleanCell(cells.get("stocknumber") ?? cells.get("stock #") ?? cells.get("stock") ?? row[6] ?? row[5]);
    const dealTypeRaw = cleanCell(cells.get("dealtype") ?? cells.get("deal type")).toLowerCase();
    const classCodeRaw = cleanCell(cells.get("1 2 3 4") ?? cells.get("1234") ?? row[7]).toLowerCase();
    const stockLower = stockNumber.toLowerCase();
    const vehicleLower = vehicle.toLowerCase();
    const dealType: SalesDeal["dealType"] =
      dealTypeRaw.includes("new")
        ? "new"
        : dealTypeRaw.includes("used")
          ? "used"
          : currentSectionDealType
            ? currentSectionDealType
            : classCodeRaw === "3"
              ? "new"
              : classCodeRaw === "4"
                ? "used"
                : stockLower.includes("a")
                  ? "used"
                  : vehicleLower.match(/\b(20|19|18|17|16|15)\d\b/)
                    ? "used"
                    : "unknown";
    const tradeVehicle = cleanCell(cells.get("trade") ?? cells.get("tradevehicle") ?? row[8] ?? row[7]) || null;
    const acv = parseCurrency(cells.get("acv") ?? row[9] ?? row[8]) ?? 0;
    const tradeRetail = parseCurrency(cells.get("traderetail") ?? cells.get("trade retail") ?? row[10] ?? row[9]) ?? 0;
    const businessManager = cleanCell(cells.get("businessmanager") ?? cells.get("business manager") ?? row[11] ?? row[10]);
    const estimatedTerm =
      parseNumber(cells.get("estimatedterm") ?? cells.get("est term") ?? cells.get("est. term") ?? cells.get("term") ?? row[12] ?? row[11]) ?? 0;
    const frontGross =
      parseCurrency(cells.get("frontgross") ?? cells.get("front gross") ?? cells.get("front") ?? row[13] ?? row[12]) ?? 0;
    const backGross =
      parseCurrency(cells.get("backgross") ?? cells.get("back gross") ?? cells.get("back") ?? row[14] ?? row[13]) ?? 0;
    const totalGross =
      parseCurrency(cells.get("totalgross") ?? cells.get("total gross") ?? cells.get("total") ?? row[15] ?? row[14]) ??
      frontGross + backGross;

    const statusRaw = cleanCell(cells.get("status") ?? row[20] ?? row[15]);
    const notes = cleanCell(cells.get("notes") ?? row[18] ?? row[16]);
    // Classify from Status column only — Notes often contain words like "pending" that are not deal status.
    const statusOnly = statusRaw.toLowerCase();
    const status: SalesDeal["status"] = /\blost\b|\bunwind\b|\bdead\b|\bcancel/.test(statusOnly)
      ? "issue"
      : /\brollover\b/.test(statusOnly)
        ? "pending"
        : /\bincoming\b/.test(statusOnly)
          ? "incoming"
          : /\bpreorder\b/.test(statusOnly)
            ? "preorder"
            : /\bpending\b/.test(statusOnly)
              ? "pending"
              : /\bissue\b/.test(statusOnly)
                ? "issue"
                : "delivered";

    if (!manager || !salesperson || !vehicle) {
      issues.push(`Row ${i + 1}: missing manager/salesperson/vehicle.`);
    }
    if (["tbd", "nt"].includes(stockNumber.toLowerCase()) || ["tbd", "nt"].includes(businessManager.toLowerCase())) {
      issues.push(`Row ${i + 1}: contains TBD/NT key fields.`);
    }

    parsed.push({
      id,
      date: parsedDate,
      customer,
      salesperson,
      manager,
      vehicle,
      stockNumber,
      dealType,
      tradeVehicle,
      acv,
      tradeRetail,
      businessManager,
      estimatedTerm,
      frontGross,
      backGross,
      totalGross,
      status,
      notes,
    });
  }

  return {
    data: parsed,
    dataQualityIssues: [...new Set(issues)],
    parsedAt: nowIso(),
    sourceSheet,
  };
}

export function parseSalesSheetForMonth(
  rows: SheetMatrix,
  sourceSheet: string,
  month: number,
  year: number,
) {
  // Rows are already loaded from the resolved month tab (e.g. JULY 2026).
  // Trust the tab as source of truth — every real deal row on the tab counts for the leaderboard.
  const base = parseSalesSheet(rows, sourceSheet);
  const tabRows = base.data;
  const closedRows = tabRows.filter((deal) => deal.status === "delivered");
  const warnings = [...base.dataQualityIssues];
  if (!tabRows.length) {
    warnings.push(`No sales rows found on selected month tab ${year}-${String(month).padStart(2, "0")}.`);
  }
  if (tabRows.length && !closedRows.length) {
    warnings.push(`No closed (posted/sold/delivered) sales deals found on selected month tab ${year}-${String(month).padStart(2, "0")}.`);
  }
  const frontGross = closedRows.reduce((sum, d) => sum + d.frontGross, 0);
  const backGross = closedRows.reduce((sum, d) => sum + d.backGross, 0);
  const totalGross = closedRows.reduce((sum, d) => sum + d.totalGross, 0);
  const units = closedRows.length;
  const lines = [
    { label: "New Vehicle Gross", value: closedRows.filter((d) => d.dealType === "new").reduce((s, d) => s + d.totalGross, 0) },
    { label: "Used Vehicle Gross", value: closedRows.filter((d) => d.dealType === "used").reduce((s, d) => s + d.totalGross, 0) },
    { label: "Front Gross", value: frontGross },
    { label: "Back Gross", value: backGross },
    { label: "Total Gross", value: totalGross },
    ...(units > 0 ? [{ label: "Gross Per Copy", value: totalGross / units }] : []),
  ];
  const confidence = Math.max(0, Math.min(100, 100 - warnings.length * 8));
  return {
    month,
    year,
    /** Every real deal row on the month tab (any Status) — use for salesperson leaderboard. */
    rows: tabRows,
    /** Posted/sold/delivered only — use for gross KPIs. */
    closedRows,
    summaries: {
      totalUnits: units,
      totalGross,
      frontGross,
      backGross,
    },
    lines,
    warnings,
    confidence,
    parsedAt: base.parsedAt,
    sourceSheet: base.sourceSheet,
  };
}
