import { generateManagerAccountability } from "@/src/lib/profit-engine/accountability-engine";
import type { AccountabilityDecision, VelocityAtRiskDeal, VelocityEngineInput } from "@/src/lib/velocity/engine/types";

export function evaluateAccountability(
  input: VelocityEngineInput,
  atRiskDeals: VelocityAtRiskDeal[],
): AccountabilityDecision[] {
  const legacyDeals = atRiskDeals.map((deal) => ({
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

  return generateManagerAccountability({
    salesDeals: input.salesDeals,
    salesSummary: input.salesSummary,
    serviceSummary: input.serviceSummary,
    serviceAdvisors: input.serviceAdvisors,
    partsSummary: input.partsSummary,
    daysUsed: input.daysUsed,
    daysAvailable: input.daysAvailable,
    dealRisks: legacyDeals,
  }).all.map((item) => ({
    department: item.department,
    severity: item.severity,
    dollarImpact: item.totalDollarImpact,
    ownerRole: item.role,
    recommendedAction: item.recommendedCoachingAction,
    reason: item.topIssue,
    confidence: item.severity === "high" ? "high" : "medium",
    person: item.person,
    role: item.role,
    issueCount: item.issueCount,
    topIssue: item.topIssue,
  }));
}
