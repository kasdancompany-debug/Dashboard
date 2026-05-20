import type { BestWorstTrackingLine, DepartmentGrossTracking, MonthlyGrossTracking } from "@/src/lib/velocity/monthly-gross/types";

export type MeetingScriptInput = {
  monthly: MonthlyGrossTracking;
  totalPace: number | null;
  salesDisplay: DepartmentGrossTracking | null | undefined;
  service: DepartmentGrossTracking | null | undefined;
  parts: DepartmentGrossTracking | null | undefined;
  worst: BestWorstTrackingLine | null;
  best: BestWorstTrackingLine | null;
  worstDepartmentTotal: DepartmentGrossTracking | null;
  operationalSignals: { text: string }[];
};

export type MeetingScriptSet = {
  storeOverview: string;
  departmentHealth: string;
  opportunitiesRisks: string;
  actionFocus: string;
};

function listPhrase(items: string[]): string {
  const unique = [...new Set(items.filter(Boolean))];
  if (unique.length === 0) return "";
  if (unique.length === 1) return unique[0]!;
  if (unique.length === 2) return `${unique[0]} and ${unique[1]}`;
  return `${unique.slice(0, -1).join(", ")}, and ${unique.at(-1)}`;
}

function recoveryOpportunities(input: MeetingScriptInput): string[] {
  const out: string[] = [];
  const { parts, salesDisplay, service, worst } = input;

  if (parts?.gapToTarget !== null && parts?.gapToTarget !== undefined && Number.isFinite(parts.gapToTarget) && parts.gapToTarget < 0) {
    out.push("Parts");
  }
  if (service?.pacePercent !== null && service?.pacePercent !== undefined && Number.isFinite(service.pacePercent) && service.pacePercent < 90) {
    out.push("Service throughput");
  }
  if (
    salesDisplay?.gapToTarget !== null &&
    salesDisplay?.gapToTarget !== undefined &&
    Number.isFinite(salesDisplay.gapToTarget) &&
    salesDisplay.gapToTarget < 0
  ) {
    out.push("Sales gross");
  }
  if (worst?.label && /used/i.test(worst.label)) {
    out.push("used gross quality");
  } else if (worst?.label && /front/i.test(worst.label)) {
    out.push("front-end gross quality");
  } else if (worst?.department === "Parts" && !out.includes("Parts")) {
    out.push("Parts retail mix");
  }

  return out;
}

function buildStoreOverviewScript(input: MeetingScriptInput): string {
  const pace = input.totalPace;
  const pacePhrase =
    pace !== null && Number.isFinite(pace) ? `Store is pacing ${Math.round(pace)}%` : "Store pacing is still settling";

  const recovery = recoveryOpportunities(input);
  if (recovery.length) {
    return `${pacePhrase}, with the main recovery opportunity sitting in ${listPhrase(recovery)}.`;
  }

  const gap = input.monthly.totalGapToTarget;
  if (gap !== null && Number.isFinite(gap) && gap >= 0) {
    return `${pacePhrase} — we're ahead of plan; keep discipline on the departments carrying the month.`;
  }

  return `${pacePhrase} to month-end targets — focus the room on the largest gaps first.`;
}

function buildDepartmentHealthScript(input: MeetingScriptInput): string {
  const { service, parts, salesDisplay } = input;
  const servicePace = service?.pacePercent ?? null;
  const partsGap = parts?.gapToTarget ?? null;
  const salesPace = salesDisplay?.pacePercent ?? null;

  if (
    partsGap !== null &&
    Number.isFinite(partsGap) &&
    partsGap < 0 &&
    servicePace !== null &&
    Number.isFinite(servicePace) &&
    servicePace >= 88 &&
    servicePace < 100
  ) {
    return "Service is close to target, but advisor throughput needs attention this week.";
  }

  if (partsGap !== null && Number.isFinite(partsGap) && partsGap < 0) {
    return "Parts needs a retail push to close the remaining gap.";
  }

  if (servicePace !== null && Number.isFinite(servicePace) && servicePace < 90) {
    return `Service is pacing ${Math.round(servicePace)}% — we need more billed hours through the weekend.`;
  }

  if (salesPace !== null && Number.isFinite(salesPace) && salesPace >= 100) {
    return `Sales is carrying pace at ${Math.round(salesPace)}% — protect front quality while we close the month.`;
  }

  return "Each department owns one lever this week — pace, gap, and daily recovery.";
}

function buildOpportunitiesRisksScript(input: MeetingScriptInput): string {
  const { best, worst } = input;

  if (best?.label && worst?.label) {
    const strength = best.label;
    const concern = worst.label;
    return `We're strongest on ${strength}, but ${concern} is where we need the room aligned today.`;
  }

  if (worst?.label) {
    return `${worst.label} is the line to stabilize — that's where the month turns if we act now.`;
  }

  if (best?.label) {
    return `${best.label} is our clearest strength — replicate that discipline elsewhere.`;
  }

  return "Compare strength and exposure side by side, then pick one owner per concern.";
}

function buildActionFocusScript(input: MeetingScriptInput): string {
  const { operationalSignals, worstDepartmentTotal, worst } = input;
  const topSignal = operationalSignals[0]?.text;

  if (topSignal) {
    const trimmed = topSignal.replace(/\.$/, "");
    return `Before we break, land three owners: start with ${trimmed.toLowerCase()}.`;
  }

  if (worst?.label) {
    return `Today we close the loop on ${worst.label.toLowerCase()} — one owner, one check-in before noon.`;
  }

  if (
    worstDepartmentTotal?.department &&
    worstDepartmentTotal.gapToTarget !== null &&
    Number.isFinite(worstDepartmentTotal.gapToTarget) &&
    worstDepartmentTotal.gapToTarget < 0
  ) {
    return `${worstDepartmentTotal.department} owns the recovery push — retail and throughput this week.`;
  }

  return "Assign one priority per department and confirm it in Notes before end of day.";
}

/** One spoken sentence per meeting slide — GM tone, derived from live payload. */
export function buildMeetingScripts(input: MeetingScriptInput): MeetingScriptSet {
  return {
    storeOverview: buildStoreOverviewScript(input),
    departmentHealth: buildDepartmentHealthScript(input),
    opportunitiesRisks: buildOpportunitiesRisksScript(input),
    actionFocus: buildActionFocusScript(input),
  };
}
