import { evaluateAccountability } from "@/src/lib/velocity/engine/accountability-engine";
import { buildMeetingBriefing } from "@/src/lib/velocity/engine/briefing-engine";
import { evaluatePartsHealth, evaluatePartsRiskSignals } from "@/src/lib/velocity/engine/parts-risk-engine";
import { evaluateProfitLeaks } from "@/src/lib/velocity/engine/profit-leak-engine";
import { evaluateProjection } from "@/src/lib/velocity/engine/projection-engine";
import { evaluateSalesHealth, evaluateSalesRisk } from "@/src/lib/velocity/engine/sales-risk-engine";
import { evaluateServiceHealth, evaluateServiceRiskSignals } from "@/src/lib/velocity/engine/service-risk-engine";
import type { ActionQueueDecision, PrimaryThreatDecision, VelocityEngineInput, VelocityEngineOutput } from "@/src/lib/velocity/engine/types";

const severityRank = { low: 1, medium: 2, high: 3 } as const;

export * from "@/src/lib/velocity/engine/types";

export function runVelocityIntelligenceEngine(input: VelocityEngineInput): VelocityEngineOutput {
  const atRiskDeals = evaluateSalesRisk(input);
  const profitLeaks = evaluateProfitLeaks(input);
  const serviceSignals = evaluateServiceRiskSignals(input);
  const partsSignals = evaluatePartsRiskSignals(input);
  const departmentHealth = [evaluateSalesHealth(input), evaluateServiceHealth(input), evaluatePartsHealth(input)];
  const accountabilityItems = evaluateAccountability(input, atRiskDeals);
  const projectedClose = evaluateProjection(input, atRiskDeals, profitLeaks);

  const actionQueue: ActionQueueDecision[] = [...profitLeaks, ...serviceSignals, ...partsSignals, ...accountabilityItems]
    .map((item, idx) => ({
      ...item,
      title: "title" in item ? item.title : `${item.department} ownership correction`,
      priority: idx + 1,
    }))
    .sort((a, b) => {
      if (severityRank[b.severity] !== severityRank[a.severity]) return severityRank[b.severity] - severityRank[a.severity];
      return (b.dollarImpact ?? 0) - (a.dollarImpact ?? 0);
    })
    .slice(0, 10)
    .map((item, idx) => ({ ...item, priority: idx + 1 }));

  const primaryThreat: PrimaryThreatDecision | null = actionQueue[0]
    ? {
        department: actionQueue[0].department,
        severity: actionQueue[0].severity,
        dollarImpact: actionQueue[0].dollarImpact,
        ownerRole: actionQueue[0].ownerRole,
        recommendedAction: actionQueue[0].recommendedAction,
        reason: actionQueue[0].reason,
        confidence: actionQueue[0].confidence,
        title: actionQueue[0].title,
      }
    : null;

  const recoverableGrossEstimate = Math.max(
    atRiskDeals.reduce((sum, d) => sum + d.estimatedRecoverableGross, 0),
    profitLeaks.reduce((sum, d) => sum + (d.dollarImpact ?? 0), 0),
    accountabilityItems.reduce((sum, d) => sum + (d.dollarImpact ?? 0), 0),
  );

  const meetingBriefing = buildMeetingBriefing({
    projectedClose,
    risks: profitLeaks,
    opportunities: departmentHealth,
    actionQueue,
  });

  return {
    primaryThreat,
    actionQueue,
    atRiskDeals,
    profitLeaks,
    recoverableGrossEstimate,
    accountabilityItems,
    projectedClose,
    departmentHealth,
    meetingBriefing,
  };
}
