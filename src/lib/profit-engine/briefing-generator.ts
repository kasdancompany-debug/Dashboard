import {
  AtRiskDeal,
  DepartmentHealth,
  GmBriefing,
  ProfitEngineInput,
  ProfitEngineOutput,
  ProfitLeak,
  ProjectedClose,
  RecommendedAction,
} from "@/src/lib/profit-engine/types";
import {
  buildRecommendedActions,
  buildSinceYesterdayChanges,
  projectClose,
} from "@/src/lib/profit-engine/close-simulator";
import { generateManagerAccountability } from "@/src/lib/profit-engine/accountability-engine";
import { buildPartsHealth } from "@/src/lib/profit-engine/parts-risk-engine";
import { generateProfitLeaks } from "@/src/lib/profit-engine/profit-leak-engine";
import { buildSalesAtRiskDeals, buildSalesHealth } from "@/src/lib/profit-engine/sales-risk-engine";
import { buildServiceHealth } from "@/src/lib/profit-engine/service-risk-engine";

const money = (value: number) => `$${Math.abs(Math.round(value)).toLocaleString()}`;

export function generateDailyGmBriefing(input: {
  projectedClose: ProjectedClose;
  departmentHealth: DepartmentHealth[];
  profitLeaks: ProfitLeak[];
  recommendedActions: RecommendedAction[];
}): GmBriefing {
  const { projectedClose, departmentHealth, profitLeaks, recommendedActions } = input;
  const topLeak = profitLeaks[0];
  const topHealthRisk = departmentHealth
    .filter((h) => h.status === "at-risk")
    .sort((a, b) => a.score - b.score)[0];

  const headline = topLeak
    ? `${topLeak.department} is the primary profit risk; ${money(topLeak.dollarImpact)} is exposed and requires action today.`
    : "Store is tracking stable with no major leak signals today.";

  const currentStatus =
    projectedClose.gapToTarget >= 0
      ? `Projected close is ${money(projectedClose.projectedGross)} vs ${money(
          projectedClose.targetGross,
        )} target, currently ahead by ${money(projectedClose.gapToTarget)}.`
      : `Projected close is ${money(projectedClose.projectedGross)} vs ${money(
          projectedClose.targetGross,
        )} target, short by ${money(projectedClose.gapToTarget)} with ${projectedClose.daysRemaining} day(s) remaining.`;

  const risks = profitLeaks.slice(0, 3).map((leak) => `${leak.department}: ${leak.title} (${money(leak.dollarImpact)}).`);
  if (topHealthRisk) {
    risks.push(`${topHealthRisk.department} health is at-risk at ${topHealthRisk.pacePercent}% pace.`);
  }

  const opportunities = departmentHealth
    .filter((h) => h.status !== "at-risk")
    .map((h) => `${h.department} is ${h.status} with ${h.pacePercent}% pace.`)
    .slice(0, 3);

  const priorities = recommendedActions
    .sort((a, b) => a.priority - b.priority)
    .slice(0, 3)
    .map((action) => `${action.priority}) ${action.title} (${money(action.expectedImpactValue)} impact).`);

  return {
    headline,
    currentStatus,
    risks,
    opportunities,
    priorities,
  };
}

export function generateProfitEngineOutput(input: ProfitEngineInput): ProfitEngineOutput {
  const departmentHealth: DepartmentHealth[] = [
    buildSalesHealth(input.salesSummary),
    buildServiceHealth(input.serviceSummary),
    buildPartsHealth(input.partsSummary),
  ];

  const atRiskDeals: AtRiskDeal[] = buildSalesAtRiskDeals({
    salesDeals: input.salesDeals,
    salesSummary: input.salesSummary,
    limit: 10,
  });

  const profitLeaks: ProfitLeak[] = generateProfitLeaks(input);
  const accountability = generateManagerAccountability(input);
  const projectedClose: ProjectedClose = projectClose(input);
  const sinceYesterdayChanges = buildSinceYesterdayChanges(input);

  const serviceElrBelowTargetCount = input.serviceAdvisors.filter((a) => a.elr < 140).length;
  const partsExposureHigh = input.partsSummary.internalSales / Math.max(1, input.partsSummary.totalSales) > 0.3;

  const recommendedActions: RecommendedAction[] = buildRecommendedActions({
    projectedClose,
    topSalesRiskCount: atRiskDeals.length,
    serviceElrBelowTargetCount,
    partsExposureHigh,
  });

  const dailyGmBriefing = generateDailyGmBriefing({
    projectedClose,
    departmentHealth,
    profitLeaks,
    recommendedActions,
  });

  return {
    departmentHealth,
    atRiskDeals,
    profitLeaks,
    accountability,
    projectedClose,
    sinceYesterdayChanges,
    recommendedActions,
    dailyGmBriefing,
  };
}
