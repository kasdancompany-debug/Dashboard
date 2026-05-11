import { buildSalesAtRiskDeals, buildSalesHealth } from "@/src/lib/profit-engine/sales-risk-engine";
import type { VelocityAtRiskDeal, DepartmentHealthDecision, VelocityEngineInput } from "@/src/lib/velocity/engine/types";

export function evaluateSalesRisk(input: VelocityEngineInput): VelocityAtRiskDeal[] {
  return buildSalesAtRiskDeals({
    salesDeals: input.salesDeals,
    salesSummary: input.salesSummary,
    limit: 12,
  }).map((deal) => ({
    department: "Sales",
    severity: deal.riskLevel,
    dollarImpact: deal.estimatedRecoverableGross,
    ownerRole: deal.manager || "Sales Manager",
    recommendedAction: deal.recommendedAction,
    reason: deal.reasons[0] ?? "Deal structure risk detected.",
    confidence: deal.riskLevel,
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
    estimatedRecoverableGross: deal.estimatedRecoverableGross,
  }));
}

export function evaluateSalesHealth(input: VelocityEngineInput): DepartmentHealthDecision {
  const health = buildSalesHealth(input.salesSummary);
  return {
    department: "Sales",
    severity: health.status === "at-risk" ? "high" : health.status === "on-track" ? "medium" : "low",
    dollarImpact: Math.max(0, health.target - health.actual),
    ownerRole: "Sales Managers",
    recommendedAction:
      health.status === "at-risk"
        ? "Escalate weak front-end structures before funding."
        : "Maintain desk discipline on front-end quality.",
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
