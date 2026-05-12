import type {
  DepartmentHealthDecision,
  MeetingBriefingDecision,
  ProfitLeakDecision,
  ProjectedCloseDecision,
  RankedActionQueueDecision,
} from "@/src/lib/velocity/engine/types";

const money = (value: number) => `$${Math.abs(Math.round(value)).toLocaleString()}`;

export function buildMeetingBriefing(input: {
  projectedClose: ProjectedCloseDecision;
  risks: ProfitLeakDecision[];
  opportunities: DepartmentHealthDecision[];
  actionQueue: RankedActionQueueDecision[];
}): MeetingBriefingDecision {
  const topRisk = input.risks[0];
  const headline = topRisk
    ? `${topRisk.department} is the primary threat with ${money(topRisk.dollarImpact ?? 0)} at risk.`
    : "No dominant leak surfaced; keep ownership pressure on execution discipline.";

  const currentStatus =
    input.projectedClose.gapToTarget < 0
      ? `Store projects ${money(input.projectedClose.gapToTarget)} below target with ${input.projectedClose.daysRemaining} day(s) remaining.`
      : `Store projects ${money(input.projectedClose.gapToTarget)} ahead of target with ${input.projectedClose.daysRemaining} day(s) remaining.`;

  return {
    headline,
    currentStatus,
    priorities: input.actionQueue.slice(0, 5),
    risks: input.risks.slice(0, 5),
    opportunities: input.opportunities
      .filter((d) => d.status !== "at-risk")
      .sort((a, b) => b.pacePercent - a.pacePercent)
      .slice(0, 3),
  };
}
