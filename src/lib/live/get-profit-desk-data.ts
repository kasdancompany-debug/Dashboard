import "server-only";

import { evaluateDataTrust } from "@/src/lib/data-pipeline/data-trust";
import {
  buildSourceHealthPayload,
  departmentRowFromFetch,
  resolveReportingMonthKey,
  validateDepartmentSource,
} from "@/src/lib/data-pipeline/source-trace";
import type { FetchedSheetRows, SheetKind } from "@/src/lib/google/sheets-client";
import { fetchSheetRows, isLiveDataEnabled } from "@/src/lib/google/sheets-client";
import { parseForecastSheet } from "@/src/lib/parsers/forecast-parser";
import { parsePartsSheet } from "@/src/lib/parsers/parts-parser";
import { partitionFormulaDiagnostics } from "@/src/lib/parsers/parse-utils";
import { parseSalesSheet } from "@/src/lib/parsers/sales-parser";
import { parseServiceSheet } from "@/src/lib/parsers/service-parser";
import { generateProfitEngineOutput } from "@/src/lib/profit-engine/briefing-generator";
import type { AccountabilityItem, AtRiskDeal, DepartmentHealth, ProfitLeak } from "@/src/lib/profit-engine/types";
import type { PartsSummary, SalesSummary, ServiceAdvisorPerformance, ServiceSummary } from "@/src/lib/types/dealership";

export type ProfitDeskData = {
  lastSynced: string;
  dataConfidence: {
    score: number;
    classification: "healthy" | "warning" | "unreliable";
    label: "High confidence" | "Medium confidence" | "Low confidence";
    estimated: boolean;
    estimationReason: string | null;
  };
  currentProjection: number;
  target: number;
  gapToTarget: number;
  recoverableGross: number;
  topProfitLeaks: ProfitLeak[];
  topAtRiskDeals: AtRiskDeal[];
  accountabilityItems: AccountabilityItem[];
  departmentHealth: DepartmentHealth[];
  meetingScript: {
    headline: string;
    currentStatus: string;
    risks: string[];
    opportunities: string[];
    priorities: string[];
  };
  sourceStatus: {
    connectionLabel: "Live data connected" | "Live data partially connected";
    reportingMonth: string;
    reportingMonthLabel: string;
    overallFreshness: "fresh" | "stale" | "error" | "unknown";
    sources: Array<{
      source: "sales" | "service" | "parts" | "forecast";
      enabled: boolean;
      connected: boolean;
      rowCount: number;
      lastFetched: string | null;
      parserConfidence: number;
      errors: string[];
      warningCount: number;
    }>;
    departments: Array<{
      department: "sales" | "service" | "parts";
      workbookTitle: string | null;
      workbookId: string;
      sheetTab: string | null;
      range: string;
      freshnessStatus: "fresh" | "stale" | "error" | "unknown";
      monthAligned: boolean;
      extractedSheetMonthKey: string | null;
    }>;
    staleDataWarnings: string[];
    fallbackNotices: string[];
  };
};

function safeNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function asPace(actual: number, target: number): "ahead" | "on-track" | "at-risk" {
  if (target <= 0) return "on-track";
  const ratio = actual / target;
  if (ratio >= 1) return "ahead";
  if (ratio >= 0.92) return "on-track";
  return "at-risk";
}

function buildServiceAdvisors(advisors: ReturnType<typeof parseServiceSheet>["data"]["advisorPerformance"]): ServiceAdvisorPerformance[] {
  return advisors.map((a) => ({
    name: a.name,
    csiResponses: 0,
    csiPerfect: 0,
    csiScore: a.csiScore,
    elr: a.elr,
    hpro: a.hpro,
    soldWildcards: a.soldWildcards,
    cpRo: a.cpRo,
    cpLabor: a.cpLabor,
    totalSales: a.cpLabor,
    trackingCpLabor: a.cpLabor,
  }));
}

function hasForecastEnabled() {
  return Boolean(process.env.FORECAST_SHEET_ID?.trim());
}

function emptyFetch(kind: SheetKind): FetchedSheetRows {
  return {
    source: "google-sheets",
    kind,
    sheetId: "unavailable",
    selectedGid: null,
    workbookTitle: null,
    availableTabNames: [],
    attemptedTabNames: [],
    range: "A1:Z1000",
    tabName: null,
    resolutionNote: "Live fetch unavailable.",
    rows: [],
    lastSynced: new Date().toISOString(),
  };
}

function parserConfidence(rowCount: number, errors: string[], warnings: string[]) {
  const rowPenalty = rowCount === 0 ? 45 : Math.min(20, Math.floor(rowCount / 500));
  const errorPenalty = errors.length * 18;
  const warningPenalty = warnings.length * 4;
  return Math.max(0, Math.min(100, 100 - rowPenalty - errorPenalty - warningPenalty));
}

async function fetchSource(kind: SheetKind, enabled: boolean): Promise<{ enabled: boolean; connected: boolean; fetched: FetchedSheetRows; errors: string[] }> {
  if (!enabled) {
    return {
      enabled: false,
      connected: false,
      fetched: emptyFetch(kind),
      errors: [],
    };
  }

  try {
    const fetched = await fetchSheetRows(kind);
    return { enabled: true, connected: true, fetched, errors: [] };
  } catch (error) {
    const msg = error instanceof Error ? error.message : `Failed to fetch ${kind} sheet.`;
    return {
      enabled: true,
      connected: false,
      fetched: emptyFetch(kind),
      errors: [msg],
    };
  }
}

export async function getProfitDeskData(options?: { reportingMonth?: string | null }): Promise<ProfitDeskData> {
  if (!isLiveDataEnabled()) {
    throw new Error("LIVE_DATA_ENABLED must be true.");
  }

  const reportingMonth = resolveReportingMonthKey(options?.reportingMonth ?? null);
  const forecastEnabled = hasForecastEnabled();
  const [salesSource, serviceSource, partsSource, forecastSource] = await Promise.all([
    fetchSource("sales", true),
    fetchSource("service", true),
    fetchSource("parts", true),
    fetchSource("forecast", forecastEnabled),
  ]);

  const sales = salesSource.fetched;
  const service = serviceSource.fetched;
  const parts = partsSource.fetched;
  const forecast = forecastSource.fetched;

  const salesParsed = parseSalesSheet(sales.rows, "sales");
  const serviceParsed = parseServiceSheet(service.rows, "service");
  const partsParsed = parsePartsSheet(parts.rows, "parts");
  const forecastParsed = forecastEnabled ? parseForecastSheet(forecast.rows, "forecast") : null;

  const normalizedSalesDeals = salesParsed.data.filter((d) => d.customer && d.vehicle);

  const salesPart = partitionFormulaDiagnostics(salesParsed.dataQualityIssues);
  const servicePart = partitionFormulaDiagnostics(serviceParsed.dataQualityIssues);
  const partsPart = partitionFormulaDiagnostics(partsParsed.dataQualityIssues);

  const salesRow = departmentRowFromFetch(sales, salesPart.formulaErrors, salesPart.otherIssues);
  const serviceRow = departmentRowFromFetch(service, servicePart.formulaErrors, servicePart.otherIssues);
  const partsRow = departmentRowFromFetch(parts, partsPart.formulaErrors, partsPart.otherIssues);
  const validations = [
    validateDepartmentSource(reportingMonth, { department: "sales", sheetTab: sales.tabName }),
    validateDepartmentSource(reportingMonth, { department: "service", sheetTab: service.tabName }),
    validateDepartmentSource(reportingMonth, { department: "parts", sheetTab: parts.tabName }),
  ];
  const sourceHealth = buildSourceHealthPayload(reportingMonth, [salesRow, serviceRow, partsRow], validations);

  const totalUnits = normalizedSalesDeals.length;
  const newUnits = normalizedSalesDeals.filter((d) => d.dealType === "new").length;
  const usedUnits = normalizedSalesDeals.filter((d) => d.dealType === "used").length;
  const frontGross = normalizedSalesDeals.reduce((acc, d) => acc + safeNumber(d.frontGross), 0);
  const backGross = normalizedSalesDeals.reduce((acc, d) => acc + safeNumber(d.backGross), 0);
  const salesGross = normalizedSalesDeals.reduce((acc, d) => acc + safeNumber(d.totalGross), 0);
  const serviceGross = safeNumber(serviceParsed.data.summary.gross.total);
  const partsGross = safeNumber(partsParsed.data.summary.gross.total);

  const salesSummary: SalesSummary = {
    totalUnits,
    newUnits,
    usedUnits,
    frontGross,
    backGross,
    totalGross: salesGross,
    frontAverage: totalUnits > 0 ? frontGross / totalUnits : 0,
    backAverage: totalUnits > 0 ? backGross / totalUnits : 0,
    perCopy: totalUnits > 0 ? salesGross / totalUnits : 0,
    trackingVolume: totalUnits,
    trackingGross: salesGross,
    targetUnits: totalUnits,
    targetGross: salesGross,
    paceStatus: asPace(salesGross, salesGross),
  };

  const serviceSummary: ServiceSummary = {
    customerSales: safeNumber(serviceParsed.data.summary.sales.customer),
    warrantySales: safeNumber(serviceParsed.data.summary.sales.warranty),
    internalSales: safeNumber(serviceParsed.data.summary.sales.internal),
    totalSales: safeNumber(serviceParsed.data.summary.sales.total),
    customerGross: safeNumber(serviceParsed.data.summary.gross.customer),
    warrantyGross: safeNumber(serviceParsed.data.summary.gross.warranty),
    internalGross: safeNumber(serviceParsed.data.summary.gross.internal),
    totalGross: serviceGross,
    cpLaborActual: safeNumber(serviceParsed.data.summary.actual),
    cpLaborTracking: safeNumber(serviceParsed.data.summary.tracking),
    dailyCpLaborGoal: safeNumber(serviceParsed.data.summary.dailyCpLaborGoal),
    forecastSales: safeNumber(serviceParsed.data.summary.forecast),
    forecastGross: safeNumber(serviceParsed.data.summary.forecast),
    previousYearSales: safeNumber(serviceParsed.data.summary.previousYear),
    previousYearGross: 0,
    paceStatus: asPace(serviceGross, safeNumber(serviceParsed.data.summary.forecast, serviceGross)),
  };

  const partsSummary: PartsSummary = {
    customerSales: safeNumber(partsParsed.data.summary.sales.customer),
    warrantySales: safeNumber(partsParsed.data.summary.sales.warranty),
    internalSales: safeNumber(partsParsed.data.summary.sales.internal),
    totalSales: safeNumber(partsParsed.data.summary.sales.total),
    customerGross: safeNumber(partsParsed.data.summary.gross.customer),
    warrantyGross: safeNumber(partsParsed.data.summary.gross.warranty),
    internalGross: safeNumber(partsParsed.data.summary.gross.internal),
    totalGross: partsGross,
    trackingGross: safeNumber(partsParsed.data.summary.tracking),
    forecastSales: safeNumber(partsParsed.data.summary.forecast),
    forecastGross: safeNumber(partsParsed.data.summary.forecast),
    paceStatus: asPace(partsGross, safeNumber(partsParsed.data.summary.forecast, partsGross)),
  };

  const now = new Date();
  const daysUsed = now.getDate();
  const daysAvailable = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const serviceAdvisors = buildServiceAdvisors(serviceParsed.data.advisorPerformance);

  const profitEngine = generateProfitEngineOutput({
    salesDeals: normalizedSalesDeals,
    salesSummary,
    serviceSummary,
    serviceAdvisors,
    partsSummary,
    daysUsed,
    daysAvailable,
  });

  const dataTrust = evaluateDataTrust({
    sourceHealth,
    salesDeals: normalizedSalesDeals,
    forecastSummary: {
      totalActual: salesGross + serviceGross + partsGross,
      totalForecast: profitEngine.projectedClose.targetGross,
      variance: salesGross + serviceGross + partsGross - profitEngine.projectedClose.targetGross,
    },
    targets: {
      salesGross: salesSummary.targetGross,
      serviceGross: serviceSummary.forecastGross,
      partsGross: partsSummary.forecastGross,
      totalGross: profitEngine.projectedClose.targetGross,
    },
    actuals: {
      salesGross,
      serviceGross,
      partsGross,
      monthToDateGross: salesGross + serviceGross + partsGross,
    },
    parserIssues: [...salesParsed.dataQualityIssues, ...serviceParsed.dataQualityIssues, ...partsParsed.dataQualityIssues],
  });

  const recoverableFromDeals = profitEngine.atRiskDeals.reduce((sum, d) => sum + Math.max(0, d.estimatedRecoverableGross), 0);
  const recoverableFromLeaks = profitEngine.profitLeaks.reduce((sum, l) => sum + Math.max(0, l.dollarImpact), 0);
  const recoverableFromAccountability = profitEngine.accountability.all.reduce((sum, i) => sum + Math.max(0, i.totalDollarImpact), 0);

  const salesConfidence = parserConfidence(sales.rows.length, salesSource.errors, salesParsed.dataQualityIssues);
  const serviceConfidence = parserConfidence(service.rows.length, serviceSource.errors, serviceParsed.dataQualityIssues);
  const partsConfidence = parserConfidence(parts.rows.length, partsSource.errors, partsParsed.dataQualityIssues);
  const forecastConfidence = forecastEnabled
    ? parserConfidence(forecast.rows.length, forecastSource.errors, forecastParsed?.dataQualityIssues ?? [])
    : 0;

  const sourceEntries: ProfitDeskData["sourceStatus"]["sources"] = [
    {
      source: "sales",
      enabled: true,
      connected: salesSource.connected,
      rowCount: sales.rows.length,
      lastFetched: salesSource.connected ? sales.lastSynced : null,
      parserConfidence: salesConfidence,
      errors: [...salesSource.errors],
      warningCount: salesParsed.dataQualityIssues.length,
    },
    {
      source: "service",
      enabled: true,
      connected: serviceSource.connected,
      rowCount: service.rows.length,
      lastFetched: serviceSource.connected ? service.lastSynced : null,
      parserConfidence: serviceConfidence,
      errors: [...serviceSource.errors],
      warningCount: serviceParsed.dataQualityIssues.length,
    },
    {
      source: "parts",
      enabled: true,
      connected: partsSource.connected,
      rowCount: parts.rows.length,
      lastFetched: partsSource.connected ? parts.lastSynced : null,
      parserConfidence: partsConfidence,
      errors: [...partsSource.errors],
      warningCount: partsParsed.dataQualityIssues.length,
    },
  ];
  if (forecastEnabled) {
    sourceEntries.push({
      source: "forecast",
      enabled: true,
      connected: forecastSource.connected,
      rowCount: forecast.rows.length,
      lastFetched: forecastSource.connected ? forecast.lastSynced : null,
      parserConfidence: forecastConfidence,
      errors: [...forecastSource.errors],
      warningCount: forecastParsed?.dataQualityIssues.length ?? 0,
    });
  }

  const hasWeakOrMissingSource = sourceEntries.some((s) => !s.connected || s.parserConfidence < 70 || s.warningCount > 0);
  const connectionLabel: ProfitDeskData["sourceStatus"]["connectionLabel"] = hasWeakOrMissingSource
    ? "Live data partially connected"
    : "Live data connected";

  return {
    lastSynced: sourceHealth.lastSynced,
    dataConfidence: {
      score: dataTrust.confidenceScore,
      classification: dataTrust.classification,
      label: dataTrust.confidenceLabel,
      estimated: dataTrust.estimated,
      estimationReason: dataTrust.estimationReason,
    },
    currentProjection: profitEngine.projectedClose.projectedGross,
    target: profitEngine.projectedClose.targetGross,
    gapToTarget: profitEngine.projectedClose.gapToTarget,
    recoverableGross: Math.max(recoverableFromDeals, recoverableFromLeaks, recoverableFromAccountability),
    topProfitLeaks: profitEngine.profitLeaks.slice(0, 6),
    topAtRiskDeals: profitEngine.atRiskDeals.slice(0, 8),
    accountabilityItems: profitEngine.accountability.all.slice(0, 8),
    departmentHealth: profitEngine.departmentHealth,
    meetingScript: profitEngine.dailyGmBriefing,
    sourceStatus: {
      connectionLabel,
      reportingMonth: sourceHealth.reportingMonth,
      reportingMonthLabel: sourceHealth.reportingMonthLabel,
      overallFreshness: sourceHealth.overallFreshness,
      sources: sourceEntries,
      departments: sourceHealth.departments.map((d) => ({
        department: d.department as "sales" | "service" | "parts",
        workbookTitle: d.workbookTitle,
        workbookId: d.workbookId,
        sheetTab: d.sheetTab,
        range: d.range,
        freshnessStatus: d.freshnessStatus,
        monthAligned: d.monthAligned,
        extractedSheetMonthKey: d.extractedSheetMonthKey,
      })),
      staleDataWarnings: sourceHealth.staleDataWarnings,
      fallbackNotices: sourceHealth.fallbackNotices,
    },
  };
}
