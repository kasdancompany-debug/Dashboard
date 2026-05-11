import "server-only";

import {
  buildDepartmentMetricTrace,
  buildSourceHealthPayload,
  departmentRowFromFetch,
  reportingMonthLabelFromKey,
  resolveReportingMonthKey,
  validateDepartmentSource,
  type LivePipelineMeta,
} from "@/src/lib/data-pipeline/source-trace";
import { fetchSheetRows, isLiveDataEnabled } from "@/src/lib/google/sheets-client";
import { parsePartsSheetForMonth } from "@/src/lib/parsers/parts-parser";
import { parseSalesSheetForMonth } from "@/src/lib/parsers/sales-parser";
import { parseServiceSheetForMonth } from "@/src/lib/parsers/service-parser";
import { partitionFormulaDiagnostics } from "@/src/lib/parsers/parse-utils";
import { PartsSummary, SalesSummary, ServiceAdvisorPerformance, ServiceSummary } from "@/src/lib/types/dealership";
import { sources } from "@/src/lib/velocity/source-config";

function safeNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function parseSelectedMonthKey(key: string) {
  const [year, month] = key.split("-").map(Number);
  return { year, month };
}

function parseNumericCell(cell: unknown) {
  const cleaned = String(cell ?? "").replace(/[,$\s]/g, "");
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function findNumericByLabel(
  rows: string[][],
  label: string,
  options?: { min?: number; max?: number; maxRowIndex?: number },
) {
  const needle = label.toLowerCase();
  const min = options?.min ?? Number.NEGATIVE_INFINITY;
  const max = options?.max ?? Number.POSITIVE_INFINITY;
  const maxRowIndex = options?.maxRowIndex ?? rows.length - 1;
  const inRange = (value: number) => value >= min && value <= max;

  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    if (rowIndex > maxRowIndex) break;
    const row = rows[rowIndex];
    const rowLower = row.map((cell) => String(cell ?? "").toLowerCase());
    const labelIndex = rowLower.findIndex((cell) => cell.includes(needle));
    if (labelIndex === -1) continue;

    // Prefer values immediately to the right of the matched label cell.
    for (let offset = 1; offset <= 4; offset += 1) {
      const idx = labelIndex + offset;
      if (idx >= row.length) break;
      const parsed = parseNumericCell(row[idx]);
      if (parsed !== null && inRange(parsed)) return parsed;
    }

    // Fallback: nearby values to the left if label/value order is reversed.
    for (let offset = 1; offset <= 2; offset += 1) {
      const idx = labelIndex - offset;
      if (idx < 0) break;
      const parsed = parseNumericCell(row[idx]);
      if (parsed !== null && inRange(parsed)) return parsed;
    }

    // Final fallback: any in-range numeric cell in the row.
    for (const cell of row) {
      const parsed = parseNumericCell(cell);
      if (parsed !== null && inRange(parsed)) return parsed;
    }
  }
  return null;
}

function deriveDaysFromRows(rows: string[][], fallbackYear: number, fallbackMonth: number) {
  const daysUsed = findNumericByLabel(rows, "days used");
  const daysAvailable = findNumericByLabel(rows, "days in month");
  if (daysUsed !== null && daysAvailable !== null) {
    return { daysUsed: Math.max(0, Math.min(daysUsed, daysAvailable)), daysAvailable: Math.max(1, daysAvailable) };
  }
  const now = new Date();
  const isCurrent = now.getFullYear() === fallbackYear && now.getMonth() + 1 === fallbackMonth;
  const daysInMonth = new Date(fallbackYear, fallbackMonth, 0).getDate();
  return { daysUsed: isCurrent ? now.getDate() : daysInMonth, daysAvailable: daysInMonth };
}

function deriveSalesTopSummary(rows: string[][]) {
  const topSummaryScanLimit = 35;
  return {
    totalGross:
      findNumericByLabel(rows, "total new & used gross", { min: 1, maxRowIndex: topSummaryScanLimit }) ??
      findNumericByLabel(rows, "total gross", { min: 1, maxRowIndex: topSummaryScanLimit }),
    trackingGross: findNumericByLabel(rows, "tracking gross", { min: 1, maxRowIndex: topSummaryScanLimit }),
    targetGross: findNumericByLabel(rows, "target gross", { min: 1, maxRowIndex: topSummaryScanLimit }),
    daysUsed: findNumericByLabel(rows, "days used", { min: 1, max: 31, maxRowIndex: topSummaryScanLimit }),
    daysAvailable:
      findNumericByLabel(rows, "days available", { min: 1, max: 31, maxRowIndex: topSummaryScanLimit }) ??
      findNumericByLabel(rows, "days in month", { min: 1, max: 31, maxRowIndex: topSummaryScanLimit }),
  };
}

function exclusionMessage(extractedMonthKey: string | null, selectedMonthKey: string) {
  const selectedLabel = reportingMonthLabelFromKey(selectedMonthKey);
  if (extractedMonthKey) {
    const extracted = reportingMonthLabelFromKey(extractedMonthKey).split(" ")[0];
    const selected = selectedLabel.split(" ")[0];
    return `Source excluded: ${extracted} data does not match selected ${selected} view. Missing ${selectedLabel} data.`;
  }
  return `Source excluded: source month does not match selected ${selectedLabel} view. Missing ${selectedLabel} data.`;
}

export type LiveDataset = {
  salesDeals: ReturnType<typeof parseSalesSheetForMonth>["rows"];
  salesSummary: SalesSummary;
  serviceSummary: ServiceSummary;
  serviceAdvisorPerformance: ServiceAdvisorPerformance[];
  partsSummary: PartsSummary;
  daysUsed: number;
  daysAvailable: number;
  forecastTargets: { Sales: number; Service: number; Parts: number };
  pipeline: LivePipelineMeta;
};

export async function getLiveDataset(options?: { reportingMonth?: string | null }): Promise<LiveDataset> {
  if (!isLiveDataEnabled()) {
    throw new Error("LIVE_DATA_ENABLED must be true.");
  }

  const reportingMonth = resolveReportingMonthKey(options?.reportingMonth ?? null);
  const { year, month } = parseSelectedMonthKey(reportingMonth);
  const [sales, service, parts, forecast] = await Promise.all([
    fetchSheetRows("sales", "A1:Z1000", { reportingMonth }),
    fetchSheetRows("service", "A1:Z1000", { reportingMonth }),
    fetchSheetRows("parts", "A1:Z1000", { reportingMonth }),
    fetchSheetRows("forecast", "A1:Z1000", { reportingMonth }),
  ]);
  const salesParsed = parseSalesSheetForMonth(sales.rows, "sales", month, year);
  const salesTopSummary = deriveSalesTopSummary(sales.rows);
  const serviceParsed = parseServiceSheetForMonth(service.rows, "service", month, year, {
    resolvedTabName: service.tabName,
    selectedMonthKey: reportingMonth,
  });
  const partsParsed = parsePartsSheetForMonth(parts.rows, "parts", month, year, {
    resolvedTabName: parts.tabName,
    selectedMonthKey: reportingMonth,
  });
  const salesIssues = [...salesParsed.warnings, sales.resolutionNote];
  const serviceIssues = [...serviceParsed.warnings, service.resolutionNote];
  const partsIssues = [...partsParsed.warnings, parts.resolutionNote];
  const salesSplit = partitionFormulaDiagnostics(salesIssues);
  const serviceSplit = partitionFormulaDiagnostics(serviceIssues);
  const partsSplit = partitionFormulaDiagnostics(partsIssues);
  const salesRow = departmentRowFromFetch(sales, salesSplit.formulaErrors, salesSplit.otherIssues);
  const serviceRow = departmentRowFromFetch(service, serviceSplit.formulaErrors, serviceSplit.otherIssues);
  const partsRow = departmentRowFromFetch(parts, partsSplit.formulaErrors, partsSplit.otherIssues);
  const salesValidation = validateDepartmentSource(reportingMonth, { department: "sales", sheetTab: sales.tabName });
  const serviceValidation = validateDepartmentSource(reportingMonth, { department: "service", sheetTab: service.tabName });
  const partsValidation = validateDepartmentSource(reportingMonth, { department: "parts", sheetTab: parts.tabName });
  const forecastValidation = validateDepartmentSource(reportingMonth, { department: "forecast", sheetTab: forecast.tabName });

  const excludedReasons: string[] = [];
  const salesExcluded = !salesValidation.monthAligned;
  const serviceExcluded = !serviceValidation.monthAligned;
  const partsExcluded = !partsValidation.monthAligned;
  const forecastExcluded = !forecastValidation.monthAligned;
  const selectedMonthLabel = reportingMonthLabelFromKey(reportingMonth);
  if (salesExcluded) excludedReasons.push(`Sales excluded from totals: missing ${selectedMonthLabel} source data.`);
  if (serviceExcluded) excludedReasons.push(`Service excluded from totals: missing ${selectedMonthLabel} source data.`);
  if (partsExcluded) excludedReasons.push(`Parts excluded from totals: missing ${selectedMonthLabel} source data.`);
  if (forecastExcluded && sources.forecast.required) {
    excludedReasons.push(`Forecast excluded from totals: missing ${selectedMonthLabel} source data.`);
  }

  const sourceHealth = buildSourceHealthPayload(
    reportingMonth,
    [salesRow, serviceRow, partsRow],
    [salesValidation, serviceValidation, partsValidation],
  );
  const sourceLineage: LivePipelineMeta["lineage"] = [
    {
      source: "sales",
      connectionStatus: salesExcluded ? "excluded" : "connected",
      sheetTitle: sales.workbookTitle,
      attemptedTabNames: sales.attemptedTabNames,
      availableTabNames: sales.availableTabNames,
      selectedMonth: reportingMonth,
      matchedMonthTab: salesValidation.monthAligned ? sales.tabName : null,
      normalizedMatchedMonth: salesValidation.extractedSheetMonthKey ?? null,
      sourceSheetId: sales.sheetId,
      selectedGid: sales.selectedGid,
      resolvedTabName: sales.tabName,
      resolvedRange: sales.range,
      rowsFetched: sales.rows.length,
      firstRowsPreview: sales.rows.slice(0, 5),
      monthDetectedFromSource: salesValidation.extractedSheetMonthKey ?? null,
      monthAligned: Boolean(salesValidation.monthAligned),
      excluded: salesExcluded,
      exclusionReason: salesExcluded ? exclusionMessage(salesValidation.extractedSheetMonthKey ?? null, reportingMonth) : null,
      rawParsedTotals: {
        totalUnits: salesParsed.summaries.totalUnits,
        newUnits: salesParsed.rows.filter((deal) => deal.dealType === "new").length,
        usedUnits: salesParsed.rows.filter((deal) => deal.dealType === "used").length,
        totalGross: salesTopSummary.totalGross ?? salesParsed.summaries.totalGross,
        trackingGross: salesTopSummary.trackingGross,
        targetGross: salesTopSummary.targetGross,
        daysUsed: salesTopSummary.daysUsed,
        daysAvailable: salesTopSummary.daysAvailable,
        frontGross: salesParsed.summaries.frontGross,
        backGross: salesParsed.summaries.backGross,
      },
      warnings: [...salesSplit.formulaErrors, ...salesSplit.otherIssues, ...(salesValidation.warning ? [salesValidation.warning] : [])],
    },
    {
      source: "service",
      connectionStatus: serviceExcluded ? "excluded" : "connected",
      sheetTitle: service.workbookTitle,
      attemptedTabNames: service.attemptedTabNames,
      availableTabNames: service.availableTabNames,
      selectedMonth: reportingMonth,
      matchedMonthTab: serviceValidation.monthAligned ? service.tabName : null,
      normalizedMatchedMonth: serviceValidation.extractedSheetMonthKey ?? null,
      sourceSheetId: service.sheetId,
      selectedGid: service.selectedGid,
      resolvedTabName: service.tabName,
      resolvedRange: service.range,
      rowsFetched: service.rows.length,
      firstRowsPreview: service.rows.slice(0, 5),
      monthDetectedFromSource: serviceValidation.extractedSheetMonthKey ?? null,
      monthAligned: serviceValidation.monthAligned,
      excluded: serviceExcluded,
      exclusionReason: serviceExcluded ? exclusionMessage(serviceValidation.extractedSheetMonthKey ?? null, reportingMonth) : null,
      rawParsedTotals: {
        totalGross: serviceParsed.summaries.gross.total,
        cpLabour: serviceParsed.summaries.actual,
        internalGross: serviceParsed.summaries.gross.internal,
        warrantyGross: serviceParsed.summaries.gross.warranty,
        customerPayGross: serviceParsed.summaries.gross.customer,
      },
      warnings: [...serviceSplit.formulaErrors, ...serviceSplit.otherIssues, ...(serviceValidation.warning ? [serviceValidation.warning] : [])],
    },
    {
      source: "parts",
      connectionStatus: partsExcluded ? "excluded" : "connected",
      sheetTitle: parts.workbookTitle,
      attemptedTabNames: parts.attemptedTabNames,
      availableTabNames: parts.availableTabNames,
      selectedMonth: reportingMonth,
      matchedMonthTab: partsValidation.monthAligned ? parts.tabName : null,
      normalizedMatchedMonth: partsValidation.extractedSheetMonthKey ?? null,
      sourceSheetId: parts.sheetId,
      selectedGid: parts.selectedGid,
      resolvedTabName: parts.tabName,
      resolvedRange: parts.range,
      rowsFetched: parts.rows.length,
      firstRowsPreview: parts.rows.slice(0, 5),
      monthDetectedFromSource: partsValidation.extractedSheetMonthKey ?? null,
      monthAligned: partsValidation.monthAligned,
      excluded: partsExcluded,
      exclusionReason: partsExcluded ? exclusionMessage(partsValidation.extractedSheetMonthKey ?? null, reportingMonth) : null,
      rawParsedTotals: {
        totalGross: partsParsed.summaries.gross.total,
        cpLabour: null,
        internalGross: partsParsed.summaries.gross.internal,
        warrantyGross: partsParsed.summaries.gross.warranty,
        customerPayGross: partsParsed.summaries.gross.customer,
      },
      warnings: [
        ...partsSplit.formulaErrors,
        ...partsSplit.otherIssues,
        ...(partsValidation.warning ? [partsValidation.warning] : []),
        "CP labour is not present in Parts sheet schema; returned as null.",
      ],
    },
    {
      source: "forecast",
      connectionStatus: "excluded",
      sheetTitle: forecast.workbookTitle,
      attemptedTabNames: forecast.attemptedTabNames,
      availableTabNames: forecast.availableTabNames,
      selectedMonth: reportingMonth,
      matchedMonthTab: forecastValidation.monthAligned ? forecast.tabName : null,
      normalizedMatchedMonth: forecastValidation.extractedSheetMonthKey ?? null,
      sourceSheetId: forecast.sheetId,
      selectedGid: null,
      resolvedTabName: forecast.tabName,
      resolvedRange: forecast.range,
      rowsFetched: forecast.rows.length,
      firstRowsPreview: forecast.rows.slice(0, 5),
      monthDetectedFromSource: forecastValidation.extractedSheetMonthKey ?? null,
      monthAligned: forecastValidation.monthAligned,
      excluded: forecastExcluded,
      exclusionReason: forecastExcluded ? exclusionMessage(forecastValidation.extractedSheetMonthKey ?? null, reportingMonth) : null,
      rawParsedTotals: {
        totalActual: null,
        totalForecast: null,
        variance: null,
      },
      warnings: forecastValidation.warning ? [forecastValidation.warning] : [],
    },
  ];

  const pipeline: LivePipelineMeta = {
    reportingMonth,
    reportingMonthLabel: reportingMonthLabelFromKey(reportingMonth),
    sourceHealth,
    lineage: sourceLineage,
    metricTraces: {
      sales: buildDepartmentMetricTrace(
        salesRow,
        salesValidation,
        reportingMonth,
        sales.range,
      ),
      service: buildDepartmentMetricTrace(
        serviceRow,
        serviceValidation,
        reportingMonth,
        service.range,
      ),
      parts: buildDepartmentMetricTrace(
        partsRow,
        partsValidation,
        reportingMonth,
        parts.range,
      ),
    },
  };
  const effectiveSalesRows = salesExcluded ? [] : salesParsed.rows;
  const effectiveServiceSummary = serviceExcluded
    ? { ...serviceParsed.summaries, gross: { customer: 0, warranty: 0, internal: 0, total: 0 }, actual: 0 }
    : serviceParsed.summaries;
  const effectivePartsSummary = partsExcluded
    ? { ...partsParsed.summaries, gross: { customer: 0, warranty: 0, internal: 0, total: 0 } }
    : partsParsed.summaries;
  const forecastTargets = {
    Sales: salesTopSummary.targetGross ?? 0,
    Service: safeNumber(serviceParsed.summaries.forecast),
    Parts: safeNumber(partsParsed.summaries.forecast),
  };
  sourceHealth.staleDataWarnings = [...new Set([...sourceHealth.staleDataWarnings, ...excludedReasons])];

  if (!effectiveSalesRows.length) sourceHealth.staleDataWarnings.push(`Missing ${selectedMonthLabel} Sales data: tracking disabled for Sales.`);
  if (!effectiveServiceSummary.gross.total && !serviceExcluded) {
    sourceHealth.staleDataWarnings.push(`Service parsing warning: unable to confidently identify total gross for ${selectedMonthLabel}.`);
  }
  if (!effectiveServiceSummary.actual && !serviceExcluded) {
    sourceHealth.staleDataWarnings.push(`Service parsing warning: unable to confidently identify CP labour for ${selectedMonthLabel}.`);
  }
  if (!effectiveServiceSummary.gross.internal && !serviceExcluded) {
    sourceHealth.staleDataWarnings.push(`Service parsing warning: unable to confidently identify internal gross for ${selectedMonthLabel}.`);
  }
  if (!effectiveServiceSummary.gross.warranty && !serviceExcluded) {
    sourceHealth.staleDataWarnings.push(`Service parsing warning: unable to confidently identify warranty gross for ${selectedMonthLabel}.`);
  }
  if (!effectiveServiceSummary.gross.customer && !serviceExcluded) {
    sourceHealth.staleDataWarnings.push(`Service parsing warning: unable to confidently identify customer pay gross for ${selectedMonthLabel}.`);
  }
  if (!effectivePartsSummary.gross.total && !partsExcluded) {
    sourceHealth.staleDataWarnings.push(`Parts parsing warning: unable to confidently identify total gross for ${selectedMonthLabel}.`);
  }
  if (!effectivePartsSummary.gross.internal && !partsExcluded) {
    sourceHealth.staleDataWarnings.push(`Parts parsing warning: unable to confidently identify internal gross for ${selectedMonthLabel}.`);
  }
  if (!effectivePartsSummary.gross.warranty && !partsExcluded) {
    sourceHealth.staleDataWarnings.push(`Parts parsing warning: unable to confidently identify warranty gross for ${selectedMonthLabel}.`);
  }
  if (!effectivePartsSummary.gross.customer && !partsExcluded) {
    sourceHealth.staleDataWarnings.push(`Parts parsing warning: unable to confidently identify customer pay gross for ${selectedMonthLabel}.`);
  }
  if (forecastExcluded && sources.forecast.required) {
    sourceHealth.staleDataWarnings.push(`Missing ${selectedMonthLabel} Forecast data: tracking disabled for Forecast.`);
  }

  const totalUnits = effectiveSalesRows.length;
  const newUnits = effectiveSalesRows.filter((d) => d.dealType === "new").length;
  const usedUnits = effectiveSalesRows.filter((d) => d.dealType === "used").length;
  const frontGross = effectiveSalesRows.reduce((acc, d) => acc + safeNumber(d.frontGross), 0);
  const backGross = effectiveSalesRows.reduce((acc, d) => acc + safeNumber(d.backGross), 0);
  const totalSalesGrossFromDeals = effectiveSalesRows.reduce((acc, d) => acc + safeNumber(d.totalGross), 0);
  const totalSalesGross = salesTopSummary.totalGross ?? totalSalesGrossFromDeals;
  const salesTrackingGross = salesTopSummary.trackingGross ?? totalSalesGross;

  const salesTargetGross = forecastTargets.Sales;

  const salesSummary: SalesSummary = {
    totalUnits,
    newUnits,
    usedUnits,
    frontGross,
    backGross,
    totalGross: totalSalesGross,
    frontAverage: totalUnits > 0 ? frontGross / totalUnits : 0,
    backAverage: totalUnits > 0 ? backGross / totalUnits : 0,
    perCopy: totalUnits > 0 ? totalSalesGross / totalUnits : 0,
    trackingVolume: totalUnits,
    trackingGross: salesTrackingGross,
    targetUnits: totalUnits,
    targetGross: salesTargetGross,
    paceStatus: "on-track",
  };

  const serviceSummary: ServiceSummary = {
    customerSales: safeNumber(effectiveServiceSummary.sales.customer),
    warrantySales: safeNumber(effectiveServiceSummary.sales.warranty),
    internalSales: safeNumber(effectiveServiceSummary.sales.internal),
    totalSales: safeNumber(effectiveServiceSummary.sales.total),
    customerGross: safeNumber(effectiveServiceSummary.gross.customer),
    warrantyGross: safeNumber(effectiveServiceSummary.gross.warranty),
    internalGross: safeNumber(effectiveServiceSummary.gross.internal),
    totalGross: safeNumber(effectiveServiceSummary.gross.total),
    cpLaborActual: safeNumber(effectiveServiceSummary.actual),
    cpLaborTracking: safeNumber(effectiveServiceSummary.tracking),
    dailyCpLaborGoal: 0,
    forecastSales: safeNumber(effectiveServiceSummary.forecast),
    forecastGross: forecastTargets.Service,
    previousYearSales: 0,
    previousYearGross: 0,
    paceStatus: "on-track",
  };

  const partsSummary: PartsSummary = {
    customerSales: safeNumber(effectivePartsSummary.sales.customer),
    warrantySales: safeNumber(effectivePartsSummary.sales.warranty),
    internalSales: safeNumber(effectivePartsSummary.sales.internal),
    totalSales: safeNumber(effectivePartsSummary.sales.total),
    customerGross: safeNumber(effectivePartsSummary.gross.customer),
    warrantyGross: safeNumber(effectivePartsSummary.gross.warranty),
    internalGross: safeNumber(effectivePartsSummary.gross.internal),
    totalGross: safeNumber(effectivePartsSummary.gross.total),
    trackingGross: safeNumber(effectivePartsSummary.tracking),
    forecastSales: safeNumber(effectivePartsSummary.forecast),
    forecastGross: forecastTargets.Parts,
    paceStatus: "on-track",
  };

  const advisors: ServiceAdvisorPerformance[] = [];

  return {
    salesDeals: effectiveSalesRows,
    salesSummary,
    serviceSummary,
    serviceAdvisorPerformance: advisors,
    partsSummary,
    ...(() => {
      if (salesTopSummary.daysUsed !== null && salesTopSummary.daysAvailable !== null) {
        const daysAvailable = Math.max(1, salesTopSummary.daysAvailable);
        const daysUsed = Math.max(0, Math.min(salesTopSummary.daysUsed, daysAvailable));
        return { daysUsed, daysAvailable };
      }
      return deriveDaysFromRows(sales.rows, year, month);
    })(),
    forecastTargets,
    pipeline,
  };
}
