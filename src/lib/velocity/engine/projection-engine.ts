import { projectClose } from "@/src/lib/profit-engine/close-simulator";
import type { ProfitLeakDecision, ProjectedCloseDecision, VelocityAtRiskDeal, VelocityEngineInput } from "@/src/lib/velocity/engine/types";

export function evaluateProjection(
  input: VelocityEngineInput,
  atRiskDeals: VelocityAtRiskDeal[],
  profitLeaks: ProfitLeakDecision[],
): ProjectedCloseDecision {
  const projected = projectClose({
    salesDeals: input.salesDeals,
    salesSummary: input.salesSummary,
    serviceSummary: input.serviceSummary,
    serviceAdvisors: input.serviceAdvisors,
    partsSummary: input.partsSummary,
    daysUsed: input.daysUsed,
    daysAvailable: input.daysAvailable,
  });
  const recoverableByDeals = atRiskDeals.reduce((sum, d) => sum + Math.max(0, d.estimatedRecoverableGross), 0);
  const recoverableByLeaks = profitLeaks.reduce((sum, l) => sum + Math.max(0, l.dollarImpact ?? 0), 0);
  const grossAtRisk = Math.max(recoverableByDeals, recoverableByLeaks, projected.atRiskValue);

  return {
    department: "Store",
    severity: projected.gapToTarget < 0 ? "high" : "medium",
    dollarImpact: grossAtRisk,
    ownerRole: "Dealer Principal",
    recommendedAction:
      projected.gapToTarget < 0
        ? "Execute top action queue before noon and hold ownership checks by close."
        : "Protect execution discipline and prevent avoidable leak expansion.",
    reason:
      projected.gapToTarget < 0
        ? `Projected close is below target by $${Math.abs(Math.round(projected.gapToTarget)).toLocaleString()}.`
        : "Projected close is at or above target pace with active risks still present.",
    confidence: "high",
    projectedGross: projected.projectedGross,
    targetGross: projected.targetGross,
    gapToTarget: projected.gapToTarget,
    daysRemaining: projected.daysRemaining,
  };
}
