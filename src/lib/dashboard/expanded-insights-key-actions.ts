import type { SalesDeal } from "@/src/lib/types/dealership";
import type { MonthlyGrossTracking } from "@/src/lib/velocity/monthly-gross/types";

export type KeyActionStatus = "open" | "in_progress" | "done";

export type ExpandedInsightsKeyAction = {
  id: string;
  priority: "critical" | "high" | "medium";
  headline: string;
  action: string;
  evidence: string;
  expectedImpact: string;
  /** Where this insight was grounded (Notes = sales sheet Notes column, etc.) */
  sources: string[];
  owner?: string;
  dueLabel?: string;
  status?: KeyActionStatus;
};

type ActionQueueRow = {
  id: string;
  rank: number;
  title: string;
  action: string;
  whyItMatters: string;
  severity: "low" | "medium" | "high";
  department: string;
  impact?: number;
  owner?: string;
};

const DEPT_OWNER: Record<string, string> = {
  Sales: "Sales Manager",
  Service: "Service Manager",
  Parts: "Parts Manager",
  Store: "General Manager",
};

function dueLabelForPriority(priority: ExpandedInsightsKeyAction["priority"]): string {
  if (priority === "critical") return "Today";
  if (priority === "high") return "This week";
  return "This month";
}

function ownerForDepartment(department: string | undefined): string | undefined {
  if (!department) return undefined;
  return DEPT_OWNER[department] ?? undefined;
}

function compactMoney(n: number) {
  const abs = Math.round(Math.abs(n));
  if (abs >= 1000) {
    const k = abs / 1000;
    return k >= 10 ? `${Math.round(k)}k` : `${k.toFixed(1).replace(/\.0$/, "")}k`;
  }
  return abs.toLocaleString();
}

/** Executive-style gross recovery band from a negative gap or dollar impact. */
export function grossRecoveryRange(gapOrImpactDollars: number): string {
  const abs = Math.abs(gapOrImpactDollars);
  if (!Number.isFinite(abs) || abs < 500) return "Protects month-end gross pace";
  const low = Math.max(1000, Math.round(abs * 0.06));
  const high = Math.max(low + 500, Math.round(abs * 0.2));
  return `Could recover $${compactMoney(low)}–$${compactMoney(high)} gross`;
}

function impactFromQueueDollars(dollars: number): string {
  if (!Number.isFinite(dollars) || dollars <= 0) return "Protects gross quality and execution reliability";
  if (dollars < 3000) return `Could recover ~${moneyAbs(dollars)} gross`;
  const low = Math.round(dollars * 0.65);
  const high = Math.round(dollars * 1.15);
  return `Could recover $${compactMoney(low)}–$${compactMoney(high)} gross`;
}

function inferExpectedImpact(action: ExpandedInsightsKeyAction): string {
  if (action.expectedImpact?.trim()) return action.expectedImpact.trim();

  const id = action.id;
  if (id.startsWith("notes-funding") || id.startsWith("notes-blank")) return "Improves funding handoff reliability";
  if (id.startsWith("notes-pricing") || id.includes("negative-front")) return "Protects front-end gross quality";
  if (id.startsWith("notes-logistics")) return "Reduces unwind and delivery risk";
  if (id.startsWith("notes-tbd") || id.startsWith("metrics-zero")) return "Protects forecast and reporting accuracy";
  if (id.startsWith("data-warnings")) return "Unlocks reliable line-level decisions";

  const moneyMatch = action.evidence.match(/\$[\d,]+/g);
  if (moneyMatch?.length) {
    const parsed = Number(moneyMatch[0].replace(/[$,]/g, ""));
    if (Number.isFinite(parsed) && parsed >= 500) return grossRecoveryRange(parsed);
  }

  return "Strengthens month-end gross execution";
}

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
  const add = (
    a: Omit<ExpandedInsightsKeyAction, "expectedImpact" | "dueLabel" | "status"> & {
      expectedImpact?: string;
      dueLabel?: string;
      status?: KeyActionStatus;
    },
  ) => {
    const k = dedupeKey(a.headline, a.action);
    if (seen.has(k)) return;
    seen.add(k);
    const row: ExpandedInsightsKeyAction = {
      ...a,
      expectedImpact: a.expectedImpact ?? inferExpectedImpact({ ...a, expectedImpact: "" }),
      dueLabel: a.dueLabel ?? dueLabelForPriority(a.priority),
      status: a.status ?? "open",
    };
    out.push(row);
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
        "Require Notes on every open deal before the first pencil tomorrow (stip, lender, or clean funded path). Clear backlog by manager lane in huddle.",
      evidence: `${blankNotes.length} of ${n} deals have empty Notes.`,
      expectedImpact: "Improves funding handoff reliability",
      owner: "Sales Manager",
      sources: ["Notes"],
    });
  }

  if (tbdFields.length > 0) {
    add({
      id: "notes-tbd-nt",
      priority: "high",
      headline: "Clear TBD / NT on stock, BM, or Notes",
      action:
        "48-hour GSM scrub: resolve every TBD/NT to a name, number, or date. Hold those units out of bonusable forecast until fixed.",
      evidence: `${tbdFields.length} deal(s) still show TBD/NT in Notes or key fields.`,
      expectedImpact: "Protects forecast accuracy and desk control",
      owner: "General Manager",
      sources: ["Notes", "Pipeline"],
    });
  }

  if (fundingFriction.length >= 2 || (fundingFriction.length === 1 && deals.some((d) => d.status === "pending" || d.status === "issue"))) {
    add({
      id: "notes-funding-lane",
      priority: "high",
      headline: "Funding / stip work showing up in customer Notes",
      action:
        "Run one stip lane stand-up with BM: batch lender calls, log outcomes in Notes, set hard follow-up times.",
      evidence: `${fundingFriction.length} deal(s) flag stips, lender, or approval risk in Notes.`,
      expectedImpact: "Improves funding handoff reliability",
      owner: "Business Manager",
      dueLabel: "Today",
      sources: ["Notes"],
    });
  }

  if (logisticsNotes.length >= 2) {
    add({
      id: "notes-logistics",
      priority: "medium",
      headline: "Delivery or allocation risk called out in Notes",
      action:
        "Confirm ETA bands with GM, prep swap options, and document gross impact before customer contact.",
      evidence: `${logisticsNotes.length} notes cite transit, allocation, or VIN timing risk.`,
      expectedImpact: "Reduces unwind risk and CSI exposure",
      sources: ["Notes"],
    });
  }

  if (pricingPressure.length >= 2) {
    add({
      id: "notes-pricing",
      priority: "medium",
      headline: "Pricing or credit pressure language in Notes",
      action:
        "Desk audit flagged deals: verify reserve, rate, and product mix; hold minimum front before rate buy-down.",
      evidence: `${pricingPressure.length} notes show aggressive pricing or discount pressure.`,
      expectedImpact: "Protects front-end gross quality",
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
        "Same-day GSM review on each unit: validate pack, trade, and F&I. Require manager Notes on every negative-front approval.",
      evidence: `${negativeFront.length} deal(s) below $0 front; drag ≈ ${moneyAbs(drag)}.`,
      expectedImpact: grossRecoveryRange(drag),
      owner: "Sales Manager",
      dueLabel: "Today",
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
        "Hold $0-gross deals out of reporting until populated or marked unwind/dead.",
      evidence: `${zeroTotal.length} deal(s) show $0 total gross in the month view.`,
      expectedImpact: "Protects forecast credibility",
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
        "Pair line owner with GSM: confirm forecast row definition, then track one daily leading indicator until the gap closes.",
      evidence: `${worst.label} is ≈ ${moneyAbs(worst.gapToTarget)} behind line target.`,
      expectedImpact: grossRecoveryRange(worst.gapToTarget),
      owner: ownerForDepartment(worst.department),
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
        "Prioritize high-labor RO closes, protect weekend maintenance capacity, escalate warranty blocks.",
      evidence: `Service at ${Math.round(dept.pacePercent)}% pace vs target.`,
      expectedImpact: dept.gapToTarget ? grossRecoveryRange(dept.gapToTarget) : "Could recover $2k–$8k gross",
      owner: "Service Manager",
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
        "Push retail counter bundles, review chargebacks, lock wholesale only when retail is covered.",
      evidence: `Parts gap ≈ ${moneyAbs(dept.gapToTarget)} vs target.`,
      expectedImpact: grossRecoveryRange(dept.gapToTarget),
      owner: "Parts Manager",
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
        "25-minute tri-dept stand-up: Sales protects front, Service recovers CP hours, Parts defends retail — one owner list with dates.",
      evidence: `Store tracking ≈ ${moneyAbs(params.totalStoreGap)} behind plan.`,
      expectedImpact: grossRecoveryRange(params.totalStoreGap),
      owner: "General Manager",
      dueLabel: "Today",
      sources: ["Metrics"],
    });
  }

  if (params.primaryThreat) {
    add({
      id: "velocity-primary-threat",
      priority: "high",
      headline: params.primaryThreat.title || "Primary profit threat",
      action: params.primaryThreat.action,
      evidence: `${params.primaryThreat.department} · leadership focus.`,
      expectedImpact: "Could recover $3k–$8k gross",
      owner: params.primaryThreat.owner || ownerForDepartment(params.primaryThreat.department),
      dueLabel: "Today",
      sources: ["Velocity"],
    });
  }

  for (const row of params.actionQueue.slice(0, 3)) {
    if (/front\s*(end)?\s*gross\s+below\s+target/i.test(row.title)) continue;
    add({
      id: `velocity-aq-${row.id}`,
      priority: row.severity === "high" ? "critical" : row.severity === "medium" ? "high" : "medium",
      headline: row.title,
      action: row.action,
      evidence: row.whyItMatters.length > 120 ? `${row.whyItMatters.slice(0, 117)}…` : row.whyItMatters,
      expectedImpact: impactFromQueueDollars(row.impact ?? 0),
      owner: row.owner?.trim() || ownerForDepartment(row.department),
      dueLabel: row.severity === "high" ? "Today" : undefined,
      sources: ["Velocity"],
    });
  }

  if (params.staleWarnings.length > 0) {
    add({
      id: "data-warnings",
      priority: "high",
      headline: "Resolve data warnings before acting on fine-grained lines",
      action:
        "Open Source Lineage, align month tabs and parsers, then refresh before line-level decisions.",
      evidence: params.staleWarnings[0] ?? "Source health reported warnings.",
      expectedImpact: "Unlocks reliable line-level decisions",
      sources: ["Metrics"],
    });
  }

  const rank: Record<ExpandedInsightsKeyAction["priority"], number> = { critical: 0, high: 1, medium: 2 };
  out.sort((a, b) => rank[a.priority] - rank[b.priority] || a.headline.localeCompare(b.headline));

  return out.slice(0, 8);
}
