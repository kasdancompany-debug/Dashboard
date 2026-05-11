import { buildPartsHealth, buildPartsLeakSignals } from "@/src/lib/profit-engine/parts-risk-engine";
import type { DepartmentHealthDecision, ProfitLeakDecision, VelocityEngineInput } from "@/src/lib/velocity/engine/types";

export function evaluatePartsRiskSignals(input: VelocityEngineInput): ProfitLeakDecision[] {
  return buildPartsLeakSignals(input.partsSummary).map((signal) => ({
    department: signal.department,
    severity: signal.severity,
    dollarImpact: signal.dollarImpact,
    ownerRole: signal.ownerRole,
    recommendedAction: signal.recommendedAction,
    reason: signal.cause,
    confidence: signal.confidence,
    title: signal.title,
  }));
}

export function evaluatePartsHealth(input: VelocityEngineInput): DepartmentHealthDecision {
  const health = buildPartsHealth(input.partsSummary);
  return {
    department: "Parts",
    severity: health.status === "at-risk" ? "high" : health.status === "on-track" ? "medium" : "low",
    dollarImpact: Math.max(0, health.target - health.actual),
    ownerRole: "Parts Manager",
    recommendedAction:
      health.status === "at-risk"
        ? "Lock high-value commitments and rebalance retail mix."
        : "Sustain retail pull-through and margin discipline.",
    reason: health.summary,
    confidence: health.status === "ahead" ? "high" : "medium",
    status: health.status,
    score: health.score,
    summary: health.summary,
    actual: health.actual,
    target: health.target,
    pacePercent: health.pacePercent,
  };
}
