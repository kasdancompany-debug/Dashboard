import { buildServiceHealth, buildServiceLeakSignals } from "@/src/lib/profit-engine/service-risk-engine";
import type { DepartmentHealthDecision, ProfitLeakDecision, VelocityEngineInput } from "@/src/lib/velocity/engine/types";

export function evaluateServiceRiskSignals(input: VelocityEngineInput): ProfitLeakDecision[] {
  return buildServiceLeakSignals({
    serviceSummary: input.serviceSummary,
    serviceAdvisors: input.serviceAdvisors,
  }).map((signal) => ({
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

export function evaluateServiceHealth(input: VelocityEngineInput): DepartmentHealthDecision {
  const health = buildServiceHealth(input.serviceSummary);
  return {
    department: "Service",
    severity: health.status === "at-risk" ? "high" : health.status === "on-track" ? "medium" : "low",
    dollarImpact: Math.max(0, health.target - health.actual),
    ownerRole: "Service Manager",
    recommendedAction:
      health.status === "at-risk"
        ? "Rebalance advisors and push high-value maintenance closes."
        : "Protect advisor throughput and CP mix quality.",
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
