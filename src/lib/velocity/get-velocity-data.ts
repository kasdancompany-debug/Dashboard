import "server-only";

import { buildExpandedInsightsKeyActions, type ExpandedInsightsKeyAction } from "@/src/lib/dashboard/expanded-insights-key-actions";
import { getLiveDataset, type LiveDataset } from "@/src/lib/live/live-data";
import type { AccountabilityItem, AtRiskDeal, DepartmentHealth } from "@/src/lib/profit-engine/types";
import { runVelocityIntelligenceEngine } from "@/src/lib/velocity/engine";
import { buildMonthlyGrossTracking } from "@/src/lib/velocity/monthly-gross/monthly-gross-engine";
import type { MonthlyGrossTracking } from "@/src/lib/velocity/monthly-gross/types";
import { evaluateSourceHealth } from "@/src/lib/velocity/engine/source-health-engine";

type ActionItem = {
  id: string;
  rank: number;
  department: "Sales" | "Service" | "Parts" | "Store";
  title: string;
  owner: string;
  impact: number;
  whyItMatters: string;
  action: string;
  ctaLabel: string;
  ctaHref: string;
  severity: "low" | "medium" | "high";
};

type PrimaryThreat = {
  title: string;
  department: string;
  impact: number;
  owner: string;
  action: string;
} | null;

type TrendSignal = {
  label: string;
  detail: string;
  direction: "up" | "down" | "watch";
};

export type VelocityData = {
  lastSynced: string;
  timeline: {
    reportingMonth: string;
    daysUsed: number;
    daysAvailable: number;
    projectionBasis: string;
  };
  monthlyGrossTracking: MonthlyGrossTracking;
  sourceLineage: LiveDataset["pipeline"]["lineage"];
  sourceHealth: ReturnType<typeof evaluateSourceHealth>["sourceHealth"];
  dataConfidence: ReturnType<typeof evaluateSourceHealth>["dataConfidence"];
  storePulse: string;
  currentProjection: number;
  targetProjection: number;
  gapToTarget: number;
  recoverableToday: number;
  primaryThreat: PrimaryThreat;
  actionQueue: ActionItem[];
  atRiskDeals: AtRiskDeal[];
  accountability: AccountabilityItem[];
  departmentPulse: DepartmentHealth[];
  trendSignals: TrendSignal[];
  meetingBriefing: {
    headline: string;
    currentStatus: string;
    risks: string[];
    opportunities: string[];
    priorities: string[];
  };
  /** Prioritized actions grounded in deal Notes + live metrics (Expanded insights). */
  keyActions: ExpandedInsightsKeyAction[];
  normalized?: LiveDataset;
};

function toTrendSignals(input: VelocityData["meetingBriefing"]): TrendSignal[] {
  const riskSignals = (input.risks ?? []).slice(0, 2).map((detail) => ({
    label: "Risk",
    detail,
    direction: "down" as const,
  }));
  const opportunitySignals = (input.opportunities ?? []).slice(0, 2).map((detail) => ({
    label: "Opportunity",
    detail,
    direction: "up" as const,
  }));
  const prioritySignals = (input.priorities ?? []).slice(0, 2).map((detail) => ({
    label: "Priority",
    detail,
    direction: "watch" as const,
  }));
  return [...riskSignals, ...opportunitySignals, ...prioritySignals];
}

export async function getVelocityData(options?: { reportingMonth?: string | null; includeNormalized?: boolean }): Promise<VelocityData> {
  const normalized = await getLiveDataset(options);
  const engine = runVelocityIntelligenceEngine({
    salesDeals: normalized.salesDeals,
    salesSummary: normalized.salesSummary,
    serviceSummary: normalized.serviceSummary,
    serviceAdvisors: normalized.serviceAdvisorPerformance,
    partsSummary: normalized.partsSummary,
    daysUsed: normalized.daysUsed,
    daysAvailable: normalized.daysAvailable,
  });
  const sourceIntel = evaluateSourceHealth({
    sourceHealth: normalized.pipeline.sourceHealth,
    salesDeals: normalized.salesDeals,
    parserIssues: normalized.pipeline.sourceHealth.departments.flatMap((d) => d.formulaErrors),
    targets: {
      salesGross: normalized.forecastTargets.Sales,
      serviceGross: normalized.forecastTargets.Service,
      partsGross: normalized.forecastTargets.Parts,
      totalGross: normalized.forecastTargets.Sales + normalized.forecastTargets.Service + normalized.forecastTargets.Parts,
    },
    actuals: {
      salesGross: normalized.salesSummary.totalGross,
      serviceGross: normalized.serviceSummary.totalGross,
      partsGross: normalized.partsSummary.totalGross,
      monthToDateGross: normalized.salesSummary.totalGross + normalized.serviceSummary.totalGross + normalized.partsSummary.totalGross,
    },
  });

  const primaryThreat: PrimaryThreat = engine.primaryThreat
    ? {
        title: engine.primaryThreat.title,
        department: engine.primaryThreat.department,
        impact: engine.primaryThreat.dollarImpact ?? 0,
        owner: engine.primaryThreat.ownerRole,
        action: engine.primaryThreat.recommendedAction,
      }
    : null;

  const actionQueue: ActionItem[] = engine.actionQueue.map((item, idx) => ({
    id: `aq-${idx + 1}-${item.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    rank: idx + 1,
    department: item.department,
    title: item.title,
    owner: item.ownerRole,
    impact: item.dollarImpact ?? 0,
    whyItMatters: item.reason,
    action: item.recommendedAction,
    ctaLabel: "Open issue",
    ctaHref: "/dashboard/alerts",
    severity: item.severity,
  }));

  const atRiskDeals: AtRiskDeal[] = engine.atRiskDeals.map((deal) => ({
    dealId: deal.dealId,
    customer: deal.customer,
    vehicle: deal.vehicle,
    salesperson: deal.salesperson,
    manager: deal.manager,
    businessManager: deal.businessManager,
    frontGross: deal.frontGross,
    backGross: deal.backGross,
    totalGross: deal.totalGross,
    riskScore: deal.riskScore,
    riskLevel: deal.severity,
    reasons: [deal.reason],
    recommendedAction: deal.recommendedAction,
    estimatedRecoverableGross: deal.estimatedRecoverableGross,
  }));

  const accountability: AccountabilityItem[] = engine.accountabilityItems.map((item) => ({
    person: item.person,
    department: item.department === "Store" ? "Sales" : item.department,
    role: item.role,
    issueCount: item.issueCount,
    totalDollarImpact: item.dollarImpact ?? 0,
    topIssue: item.topIssue,
    recommendedCoachingAction: item.recommendedAction,
    severity: item.severity,
  }));

  const departmentPulse: DepartmentHealth[] = engine.departmentHealth.map((item) => ({
    department: item.department === "Store" ? "Sales" : item.department,
    status: item.status,
    score: item.score,
    summary: item.summary,
    actual: item.actual,
    target: item.target,
    pacePercent: item.pacePercent,
  }));

  const meetingBriefing: VelocityData["meetingBriefing"] = {
    headline: engine.meetingBriefing.headline,
    currentStatus: engine.meetingBriefing.currentStatus,
    risks: engine.meetingBriefing.risks.map((r) => `${r.department}: ${r.reason}`),
    opportunities: engine.meetingBriefing.opportunities.map((o) => `${o.department}: ${o.reason}`),
    priorities: engine.meetingBriefing.priorities.map((p) => `${p.title} - ${p.recommendedAction}`),
  };

  const [yearString, monthString] = normalized.pipeline.reportingMonth.split("-");
  const month = Number(monthString);
  const year = Number(yearString);
  const monthlyGrossTracking = buildMonthlyGrossTracking({
    sales: {
      data: normalized.salesDeals,
      summary: {
        actualGross: normalized.salesSummary.totalGross,
        trackingGross: normalized.salesSummary.trackingGross,
        targetGross: normalized.salesSummary.targetGross,
      },
    },
    service: {
      summary: {
        gross: {
          customer: normalized.serviceSummary.customerGross,
          warranty: normalized.serviceSummary.warrantyGross,
          internal: normalized.serviceSummary.internalGross,
          total: normalized.serviceSummary.totalGross,
        },
        actual: normalized.serviceSummary.cpLaborActual,
        tracking: normalized.serviceSummary.cpLaborTracking,
        forecast: normalized.serviceSummary.forecastGross,
      },
    },
    parts: {
      summary: {
        gross: {
          customer: normalized.partsSummary.customerGross,
          warranty: normalized.partsSummary.warrantyGross,
          internal: normalized.partsSummary.internalGross,
          total: normalized.partsSummary.totalGross,
        },
        actual: normalized.partsSummary.totalGross,
        tracking: normalized.partsSummary.trackingGross,
        forecast: normalized.partsSummary.forecastGross,
      },
      categoryBreakdown: [],
    },
    month,
    year,
    daysUsed: normalized.daysUsed,
    daysAvailable: normalized.daysAvailable,
    lastSynced: normalized.pipeline.sourceHealth.lastSynced,
    sourceHealth: sourceIntel.sourceHealth,
    sourceLineage: normalized.pipeline.lineage,
    targets: {
      Sales: normalized.forecastTargets.Sales,
      Service: normalized.forecastTargets.Service,
      Parts: normalized.forecastTargets.Parts,
    },
    forecastLineItems: normalized.forecastLineItems ?? undefined,
  });

  const keyActions = buildExpandedInsightsKeyActions({
    reportingMonthKey: normalized.pipeline.reportingMonth,
    salesDeals: normalized.salesDeals,
    monthly: monthlyGrossTracking,
    actionQueue: actionQueue.map((row) => ({
      id: row.id,
      rank: row.rank,
      title: row.title,
      action: row.action,
      whyItMatters: row.whyItMatters,
      severity: row.severity,
      department: row.department,
    })),
    primaryThreat,
    totalStoreGap: monthlyGrossTracking.totalGapToTarget,
    staleWarnings: sourceIntel.sourceHealth.staleDataWarnings ?? [],
  });

  return {
    lastSynced: normalized.pipeline.sourceHealth.lastSynced,
    timeline: {
      reportingMonth: normalized.pipeline.sourceHealth.reportingMonthLabel,
      daysUsed: normalized.daysUsed,
      daysAvailable: normalized.daysAvailable,
      projectionBasis: "Month-end run-rate projection from live MTD actuals",
    },
    monthlyGrossTracking,
    sourceLineage: normalized.pipeline.lineage,
    sourceHealth: sourceIntel.sourceHealth,
    dataConfidence: sourceIntel.dataConfidence,
    storePulse: engine.meetingBriefing.currentStatus,
    currentProjection: engine.projectedClose.projectedGross,
    targetProjection: engine.projectedClose.targetGross,
    gapToTarget: engine.projectedClose.gapToTarget,
    recoverableToday: engine.recoverableGrossEstimate,
    primaryThreat,
    actionQueue,
    atRiskDeals,
    accountability,
    departmentPulse,
    trendSignals: toTrendSignals(meetingBriefing),
    meetingBriefing,
    keyActions,
    ...(options?.includeNormalized ? { normalized } : {}),
  };
}
