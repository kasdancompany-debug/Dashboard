import { generateProfitLeaks } from "@/src/lib/profit-engine/profit-leak-engine";
import type { ProfitLeakDecision, VelocityEngineInput } from "@/src/lib/velocity/engine/types";

export function evaluateProfitLeaks(input: VelocityEngineInput): ProfitLeakDecision[] {
  return generateProfitLeaks({
    salesDeals: input.salesDeals,
    salesSummary: input.salesSummary,
    serviceSummary: input.serviceSummary,
    serviceAdvisors: input.serviceAdvisors,
    partsSummary: input.partsSummary,
    daysUsed: input.daysUsed,
    daysAvailable: input.daysAvailable,
  }).map((leak) => ({
    department: leak.department,
    severity: leak.severity,
    dollarImpact: leak.dollarImpact,
    ownerRole: leak.ownerRole,
    recommendedAction: leak.recommendedAction,
    reason: leak.cause,
    confidence: leak.confidence,
    title: leak.title,
  }));
}
