import { ProfitEngineInput, ProfitLeak, ProjectedClose, RecommendedAction, SinceYesterdayChange } from "@/src/lib/profit-engine/types";

const defaultSinceYesterday = (input: ProfitEngineInput): SinceYesterdayChange[] => {
  const salesGap = Math.max(0, input.salesSummary.targetGross - input.salesSummary.totalGross);
  const serviceGap = Math.max(0, input.serviceSummary.forecastGross - input.serviceSummary.totalGross);
  return [
    { label: "Service gross", value: Math.round(Math.min(serviceGap, 12400)), direction: "up", impactArea: "gross" },
    { label: "Sales front gross", value: Math.round(Math.min(salesGap, 6200)), direction: "down", impactArea: "gross" },
    { label: "Units delivered", value: 3, direction: "up", impactArea: "volume" },
    { label: "Deals downgraded", value: 2, direction: "down", impactArea: "risk" },
  ];
};

export function projectClose(input: ProfitEngineInput): ProjectedClose {
  const combinedActual = input.salesSummary.totalGross + input.serviceSummary.totalGross + input.partsSummary.totalGross;
  const combinedTarget =
    input.salesSummary.targetGross + input.serviceSummary.forecastGross + input.partsSummary.forecastGross;
  const projectedGross = Math.round((combinedActual / Math.max(1, input.daysUsed)) * input.daysAvailable);
  const gapToTarget = projectedGross - combinedTarget;
  const daysRemaining = Math.max(0, input.daysAvailable - input.daysUsed);

  return {
    projectedGross,
    targetGross: combinedTarget,
    gapToTarget,
    daysRemaining,
    atRiskValue: Math.max(0, combinedTarget - projectedGross),
  };
}

export function buildSinceYesterdayChanges(input: ProfitEngineInput): SinceYesterdayChange[] {
  return input.sinceYesterday ?? defaultSinceYesterday(input);
}

export function buildRecommendedActions(input: {
  projectedClose: ProjectedClose;
  topSalesRiskCount: number;
  serviceElrBelowTargetCount: number;
  partsExposureHigh: boolean;
}): RecommendedAction[] {
  const actions: RecommendedAction[] = [];
  const targetGap = Math.abs(input.projectedClose.gapToTarget);

  actions.push({
    id: "sales-low-front-escalation",
    department: "Sales",
    priority: 1,
    title: "Escalate low-front deals before funding",
    rationale: `${input.topSalesRiskCount} deals are currently driving the largest gross risk concentration.`,
    expectedImpactValue: Math.max(32000, Math.round(targetGap * 0.5)),
    ownerRole: "Sales Managers",
  });

  actions.push({
    id: "service-load-rebalance",
    department: "Service",
    priority: 2,
    title: "Rebalance advisor load before noon",
    rationale: `${input.serviceElrBelowTargetCount} advisor(s) are below ELR objective, creating gross and CSI pressure.`,
    expectedImpactValue: Math.max(9000, Math.round(targetGap * 0.2)),
    ownerRole: "Service Manager",
  });

  actions.push({
    id: "parts-special-order-lock",
    department: "Parts",
    priority: 3,
    title: "Confirm top special-order commitments",
    rationale: input.partsExposureHigh
      ? "Current mix and fulfillment timing risk delaying high-value ROs."
      : "Locking commitments now protects close consistency.",
    expectedImpactValue: Math.max(6000, Math.round(targetGap * 0.12)),
    ownerRole: "Parts Manager",
  });

  return actions;
}

export type CloseProjectionScenario = {
  id: "current" | "recoverable" | "target";
  title: string;
  projectedMonthEndGross: number;
  gapToTarget: number;
  changeVsCurrentProjection: number;
  assumptions: string[];
};

export function buildCloseProjectionScenarios(input: {
  projection: ProjectedClose;
  profitLeaks: ProfitLeak[];
  dealRiskRecoverableGross: number;
  salesTargetGross: number;
  serviceTargetGross: number;
  partsTargetGross: number;
}): CloseProjectionScenario[] {
  const { projection, profitLeaks, dealRiskRecoverableGross, salesTargetGross, serviceTargetGross, partsTargetGross } = input;
  const targetGross = salesTargetGross + serviceTargetGross + partsTargetGross;

  const topActionableLeakRecovery = profitLeaks
    .filter((leak) => leak.severity !== "low")
    .slice(0, 4)
    .reduce((sum, leak) => sum + Math.round(leak.dollarImpact * 0.55), 0);

  const recoverableGrossLift = Math.round(topActionableLeakRecovery + dealRiskRecoverableGross * 0.45);
  const recoverableProjection = Math.min(targetGross, projection.projectedGross + recoverableGrossLift);

  const current: CloseProjectionScenario = {
    id: "current",
    title: "1. Current Projection",
    projectedMonthEndGross: projection.projectedGross,
    gapToTarget: projection.projectedGross - targetGross,
    changeVsCurrentProjection: 0,
    assumptions: [
      "Current run-rate continues with no structural corrections.",
      `Top leak exposure remains at ${profitLeaks.slice(0, 3).reduce((s, l) => s + l.dollarImpact, 0).toLocaleString()} dollars.`,
    ],
  };

  const recoverable: CloseProjectionScenario = {
    id: "recoverable",
    title: "2. Recoverable Projection",
    projectedMonthEndGross: recoverableProjection,
    gapToTarget: recoverableProjection - targetGross,
    changeVsCurrentProjection: recoverableProjection - projection.projectedGross,
    assumptions: [
      "Top actionable risks are addressed within current closing window.",
      "About 55 percent of top leak value and 45 percent of deal recoverables are captured.",
    ],
  };

  const target: CloseProjectionScenario = {
    id: "target",
    title: "3. Target Projection",
    projectedMonthEndGross: targetGross,
    gapToTarget: 0,
    changeVsCurrentProjection: targetGross - projection.projectedGross,
    assumptions: [
      "Department targets are achieved through disciplined daily execution.",
      "No additional leak expansion and no new quality degradation.",
    ],
  };

  return [current, recoverable, target];
}
