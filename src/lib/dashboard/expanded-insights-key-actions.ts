import type { SalesDeal } from "@/src/lib/types/dealership";
import type { MonthlyGrossTracking } from "@/src/lib/velocity/monthly-gross/types";

export type ExpandedInsightsKeyAction = {
  id: string;
  priority: "critical" | "high" | "medium";
  headline: string;
  action: string;
  evidence: string;
  /** Where this insight was grounded (Notes = sales sheet Notes column, etc.) */
  sources: string[];
};

type ActionQueueRow = {
  id: string;
  rank: number;
  title: string;
  action: string;
  whyItMatters: string;
  severity: "low" | "medium" | "high";
  department: string;
};

function parseMonthKey(key: string): { year: number; month: number } | null {
  const [y, m] = key.split("-").map(Number);
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) return null;
  return { year: y, month: m };
}

function dealsForMonth(deals: SalesDeal[], reportingMonthKey: string): SalesDeal[] {
  const parsed = parseMonthKey(reportingMonthKey);
  if (!parsed) return deals;
  const { year, month } = parsed;
  return deals.filter((d) => {
    const dt = new Date(d.date);
    return Number.isFinite(dt.getTime()) && dt.getFullYear() === year && dt.getMonth() + 1 === month;
  });
}

function moneyAbs(n: number) {
  return `$${Math.round(Math.abs(n)).toLocaleString()}`;
}

function dedupeKey(headline: string, action: string) {
  return `${headline.toLowerCase().slice(0, 64)}|${action.toLowerCase().slice(0, 64)}`;
}

/**
 * Builds prioritized, actionable guidance for the Expanded insights panel.
 * Grounds recommendations in **sales deal Notes** (sheet column) plus gross pacing, forecast gaps, and velocity engine output.
 */
export function buildExpandedInsightsKeyActions(params: {
  reportingMonthKey: string;
  salesDeals: SalesDeal[];
  monthly: MonthlyGrossTracking;
  actionQueue: ActionQueueRow[];
  primaryThreat: { title: string; department: string; action: string; owner: string } | null;
  totalStoreGap: number | null;
  staleWarnings: string[];
}): ExpandedInsightsKeyAction[] {
  const out: ExpandedInsightsKeyAction[] = [];
  const seen = new Set<string>();
  const add = (a: ExpandedInsightsKeyAction) => {
    const k = dedupeKey(a.headline, a.action);
    if (seen.has(k)) return;
    seen.add(k);
    out.push(a);
  };

  const deals = dealsForMonth(params.salesDeals, params.reportingMonthKey);
  const n = deals.length;

  const blankNotes = deals.filter((d) => !(d.notes ?? "").trim());
  const tbdFields = deals.filter((d) => {
    const bundle = `${d.notes ?? ""} ${d.stockNumber} ${d.businessManager}`;
    return /\bTBD\b|\bNT\b|T\.B\.D\./i.test(bundle);
  });

  const fundingFriction = deals.filter((d) =>
    /\bstip|stipulation|lender|underwriter|binder|insurance|co-?\s*signer|approval\s+pending|pending\s+lender/i.test(d.notes ?? ""),
  );
  const logisticsNotes = deals.filter((d) =>
    /\btransit|allocation|\beta\b|in\s+transit|factory|port\b|vin\s+pending|allocation/i.test(d.notes ?? ""),
  );
  const pricingPressure = deals.filter((d) =>
    /\baggressive|subprime|discount|price\s+match|below\s+invoice|skinny/i.test(d.notes ?? ""),
  );

  if (n >= 5 && blankNotes.length >= Math.max(4, Math.ceil(n * 0.18))) {
    add({
      id: "notes-blank-density",
      priority: "high",
      headline: "Notes column is too thin for reliable funding handoff",
      action:
        "Before tomorrow's first pencil: require every open deal to carry Notes (stip status, lender, accessories, or 'clean / funded path'). Use the sales huddle to clear the backlog top-down by manager lane.",
      evidence: `${blankNotes.length} of ${n} month deals have empty Notes — examples: ${blankNotes
        .slice(0, 3)
        .map((d) => d.customer)
        .join("; ")}`,
      sources: ["Notes"],
    });
  }

  if (tbdFields.length > 0) {
    add({
      id: "notes-tbd-nt",
      priority: "high",
      headline: "Clear TBD / NT on stock, BM, or Notes",
      action:
        "Assign GSM + office manager a 48-hour scrub: every TBD/NT must resolve to a name, number, or date. Until then, exclude those units from bonusable forecast and protect the desk from surprise unwind.",
      evidence: `${tbdFields.length} deal(s) still show TBD/NT in Notes or key fields`,
      sources: ["Notes", "Pipeline"],
    });
  }

  if (fundingFriction.length >= 2 || (fundingFriction.length === 1 && deals.some((d) => d.status === "pending" || d.status === "issue"))) {
    add({
      id: "notes-funding-lane",
      priority: "high",
      headline: "Funding / stip work showing up in customer Notes",
      action:
        "Open a single 'stip lane' stand-up with BM lead: batch lender calls, document outcomes in Notes, and set hard follow-up times so F&I can protect back gross without delaying CIT.",
      evidence: `${fundingFriction.length} deal(s) reference stipulations, lender, insurance, or approvals in Notes`,
      sources: ["Notes"],
    });
  }

  if (logisticsNotes.length >= 2) {
    add({
      id: "notes-logistics",
      priority: "medium",
      headline: "Delivery or allocation risk called out in Notes",
      action:
        "Sync sales promises with inventory: confirm ETA bands with GM, prep swap options, and document any gross impact before customer contact — reduces last-minute unwind and CSI hits.",
      evidence: `${logisticsNotes.length} notes mention transit, allocation, ETA, or VIN timing`,
      sources: ["Notes"],
    });
  }

  if (pricingPressure.length >= 2) {
    add({
      id: "notes-pricing",
      priority: "medium",
      headline: "Pricing or credit pressure language in Notes",
      action:
        "Desk audit on flagged deals: verify reserve, rate, and product mix; coach negotiators on minimum acceptable front before rate buy-down so back can still carry the month.",
      evidence: `${pricingPressure.length} notes suggest aggressive pricing, subprime, or deep discounting language`,
      sources: ["Notes"],
    });
  }

  const negativeFront = deals.filter((d) => d.frontGross < 0);
  if (negativeFront.length > 0) {
    const drag = negativeFront.reduce((s, d) => s + d.frontGross, 0);
    add({
      id: "metrics-negative-front",
      priority: "critical",
      headline: "Negative front gross deals need same-day desk resolution",
      action:
        "Review each unit with GSM: validate pack, trade, and F&I structure. Require manager commentary in Notes on every negative-front approval so audits and lenders see intent.",
      evidence: `${negativeFront.length} deal(s) below $0 front; combined front drag ≈ ${moneyAbs(drag)}`,
      sources: ["Metrics"],
    });
  }

  const zeroTotal = deals.filter((d) => d.totalGross === 0);
  if (zeroTotal.length >= 2) {
    add({
      id: "metrics-zero-gross",
      priority: "high",
      headline: "Zero gross deals still in the month pipeline",
      action:
        "Hold deals out of reporting until gross is populated or explicitly marked 'unwind / dead'. Otherwise forecast pacing looks artificially strong.",
      evidence: `${zeroTotal.length} deal(s) show $0 total gross for the month view`,
      sources: ["Metrics"],
    });
  }

  const worst = params.monthly.worstTrackingLine;
  if (worst && worst.gapToTarget !== null && Number.isFinite(worst.gapToTarget) && worst.gapToTarget < -20_000) {
    add({
      id: "line-worst-gap",
      priority: "high",
      headline: `Stabilize ${worst.label} (${worst.department})`,
      action:
        "Pair the line owner with GSM: confirm forecast row matches the log definition, then assign a daily leading indicator (appointments, RO count, or counter tickets) until the gap narrows materially.",
      evidence: `${worst.label} is ≈ ${moneyAbs(worst.gapToTarget)} behind its line target for the month`,
      sources: ["Forecast desk", "Metrics"],
    });
  }

  for (const dept of params.monthly.departments) {
    if (dept.department === "Service" && dept.pacePercent !== null && Number.isFinite(dept.pacePercent) && dept.pacePercent < 88) {
      add({
        id: "dept-service-pace",
        priority: "high",
        headline: "Service gross pace is below plan",
        action:
          "Focus advisor WIP and CP ELR: prioritize high-labor RO closes, protect maintenance capacity through the weekend, and escalate warranty delays that block billing.",
        evidence: `Service at ${Math.round(dept.pacePercent)}% pace vs department target`,
        sources: ["Metrics"],
      });
      break;
    }
  }

  for (const dept of params.monthly.departments) {
    if (
      dept.department === "Parts" &&
      dept.gapToTarget !== null &&
      Number.isFinite(dept.gapToTarget) &&
      dept.gapToTarget < -8000
    ) {
      add({
        id: "dept-parts-gap",
        priority: "high",
        headline: "Parts is materially under department gross target",
        action:
          "Retail pull-through push: counter bundle on high-margin categories, review internal chargebacks, and lock wholesale only when retail is covered.",
        evidence: `Parts gap ≈ ${moneyAbs(dept.gapToTarget)} vs target`,
        sources: ["Metrics"],
      });
      break;
    }
  }

  if (params.totalStoreGap !== null && Number.isFinite(params.totalStoreGap) && params.totalStoreGap < -5000) {
    add({
      id: "store-total-gap",
      priority: "critical",
      headline: "Store consolidated gross is behind the month plan",
      action:
        "Run a tight tri-dept stand-up (≤25 min): Sales protects front quality, Service recovers CP hours, Parts defends retail margin — one shared action list with owners and dates.",
      evidence: `Combined tracking vs targets ≈ ${moneyAbs(params.totalStoreGap)} behind`,
      sources: ["Metrics"],
    });
  }

  if (params.primaryThreat) {
    add({
      id: "velocity-primary-threat",
      priority: "high",
      headline: params.primaryThreat.title || "Primary profit threat",
      action: params.primaryThreat.action,
      evidence: `${params.primaryThreat.department} · owner focus: ${params.primaryThreat.owner}`,
      sources: ["Velocity"],
    });
  }

  for (const row of params.actionQueue.slice(0, 3)) {
    add({
      id: `velocity-aq-${row.id}`,
      priority: row.severity === "high" ? "critical" : row.severity === "medium" ? "high" : "medium",
      headline: row.title,
      action: row.action,
      evidence: row.whyItMatters.length > 160 ? `${row.whyItMatters.slice(0, 157)}…` : row.whyItMatters,
      sources: ["Velocity"],
    });
  }

  if (params.staleWarnings.length > 0) {
    add({
      id: "data-warnings",
      priority: "high",
      headline: "Resolve data warnings before acting on fine-grained lines",
      action:
        "Open Source Lineage, align month tabs and parsers, then refresh. Leadership decisions on sub-lines should wait until warnings are cleared or explicitly accepted.",
      evidence: params.staleWarnings[0] ?? "Source health reported warnings",
      sources: ["Metrics"],
    });
  }

  const rank: Record<ExpandedInsightsKeyAction["priority"], number> = { critical: 0, high: 1, medium: 2 };
  out.sort((a, b) => rank[a.priority] - rank[b.priority] || a.headline.localeCompare(b.headline));

  return out.slice(0, 8);
}
