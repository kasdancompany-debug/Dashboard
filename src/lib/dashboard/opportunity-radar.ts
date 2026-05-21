import { grossRecoveryRange } from "@/src/lib/dashboard/expanded-insights-key-actions";
import type {
  BestWorstTrackingLine,
  DepartmentGrossTracking,
  MonthlyGrossTracking,
} from "@/src/lib/velocity/monthly-gross/types";

export type OpportunityRadarConfidence = "High" | "Medium" | "Low";
export type OpportunityRadarRole = "dollar" | "operational" | "defensive";

export type OpportunityRadarItem = {
  id: string;
  role: OpportunityRadarRole;
  title: string;
  estimatedImpact: string;
  department: "Sales" | "Service" | "Parts" | "Store";
  confidence: OpportunityRadarConfidence;
  /** Where this recommendation was grounded (shown in UI). */
  source: string;
};

export type DepartmentRadarTakeaway = {
  department: "Sales" | "Service" | "Parts";
  focusLine: string | null;
  focusGap: string | null;
  strengthLine: string | null;
  strengthGap: string | null;
  source: string;
};

export type OpportunityRadarBundle = {
  items: OpportunityRadarItem[];
  departmentTakeaways: DepartmentRadarTakeaway[];
  /** One-line preview when the section is collapsed. */
  summaryLine: string;
};

export type AtRiskDealRadarInput = {
  customer: string;
  vehicle: string;
  reasons: string[];
  recommendedAction: string;
  estimatedRecoverableGross: number;
  riskLevel: "low" | "medium" | "high";
};

const ROLE_LABEL: Record<OpportunityRadarRole, string> = {
  dollar: "Highest $",
  operational: "Fastest fix",
  defensive: "Defend",
};

type RadarDept = OpportunityRadarItem["department"];

type Candidate = OpportunityRadarItem & {
  dollarScore: number;
  operationalScore: number;
  defensiveScore: number;
};

type ActionQueueRow = {
  id: string;
  title: string;
  department: string;
  impact?: number;
  severity: "low" | "medium" | "high";
};

const DEPT_SHEET_SOURCE: Record<"Sales" | "Service" | "Parts", string> = {
  Sales: "Daily Log (sales sheet)",
  Service: "Service daily tracking sheet",
  Parts: "Parts daily tracking sheet",
};

function compactImpactDollars(gapOrImpact: number): string {
  const abs = Math.abs(gapOrImpact);
  if (!Number.isFinite(abs) || abs < 500) return "Protects month-end gross pace";
  return grossRecoveryRange(-abs);
}

function queueImpactDollars(dollars: number): string {
  if (!Number.isFinite(dollars) || dollars <= 0) return "Strengthens execution reliability";
  if (dollars < 3000) return `~$${Math.round(dollars).toLocaleString()} recoverable`;
  const low = Math.round(dollars * 0.65);
  const high = Math.round(dollars * 1.15);
  return `$${low.toLocaleString()}–$${high.toLocaleString()} est.`;
}

function formatGap(gap: number | null | undefined): string | null {
  if (gap === null || gap === undefined || !Number.isFinite(gap)) return null;
  const abs = Math.round(Math.abs(gap));
  const sign = gap < 0 ? "behind" : gap > 0 ? "ahead" : "on";
  return `${sign === "on" ? "on plan" : `$${abs.toLocaleString()} ${sign}`}`;
}

function deptConfidence(dept: DepartmentGrossTracking | undefined, staleWarnings: boolean): OpportunityRadarConfidence {
  if (staleWarnings) return "Low";
  if (!dept || dept.trackingGross === null || dept.status === "insufficient-data") return "Medium";
  if (dept.warning) return "Medium";
  return "High";
}

function lineConfidence(line: BestWorstTrackingLine | null | undefined, staleWarnings: boolean): OpportunityRadarConfidence {
  if (staleWarnings) return "Low";
  if (!line || line.trackingGross === null) return "Medium";
  if (line.warning) return "Medium";
  return "High";
}

function normalizeDept(department: string): RadarDept {
  if (department === "Sales" || department === "Service" || department === "Parts") return department;
  return "Store";
}

function sheetSource(dept: "Sales" | "Service" | "Parts", detail: string): string {
  return `${DEPT_SHEET_SOURCE[dept]} · ${detail}`;
}

function addCandidate(pool: Candidate[], candidate: Candidate) {
  if (pool.some((c) => c.id === candidate.id)) return;
  pool.push(candidate);
}

function pickByRole(pool: Candidate[], role: OpportunityRadarRole, used: Set<string>): OpportunityRadarItem | null {
  const scoreKey =
    role === "dollar" ? "dollarScore" : role === "operational" ? "operationalScore" : "defensiveScore";
  const ranked = pool
    .filter((c) => c[scoreKey] > 0 && !used.has(c.id))
    .sort((a, b) => {
      const scoreDiff = b[scoreKey] - a[scoreKey];
      if (scoreDiff !== 0) return scoreDiff;
      const aSheet = a.source.includes("daily") || a.source.includes("Daily Log") ? 1 : 0;
      const bSheet = b.source.includes("daily") || b.source.includes("Daily Log") ? 1 : 0;
      return bSheet - aSheet || b.dollarScore - a.dollarScore;
    });
  const top = ranked[0];
  if (!top) return null;
  used.add(top.id);
  return {
    id: top.id,
    role,
    title: top.title,
    estimatedImpact: top.estimatedImpact,
    department: top.department,
    confidence: top.confidence,
    source: top.source,
  };
}

const FALLBACKS: Record<OpportunityRadarRole, OpportunityRadarItem> = {
  dollar: {
    id: "fallback-dollar",
    role: "dollar",
    title: "Close the largest department gross gap first",
    estimatedImpact: "Prioritize the dept with the biggest $ gap to target",
    department: "Store",
    confidence: "Low",
    source: "Store rollup · no strong signal",
  },
  operational: {
    id: "fallback-operational",
    role: "operational",
    title: "Run a same-day throughput stand-up",
    estimatedImpact: "Advisor hours and parts counter push — fastest levers",
    department: "Store",
    confidence: "Low",
    source: "Store rollup · no strong signal",
  },
  defensive: {
    id: "fallback-defensive",
    role: "defensive",
    title: "Protect lines already beating plan",
    estimatedImpact: "Hold discipline on strength lines while recovering gaps",
    department: "Store",
    confidence: "Medium",
    source: "Store rollup · no strong signal",
  },
};

function truncate(text: string, max: number): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function buildRadarSummaryLine(items: OpportunityRadarItem[]): string {
  if (!items.length) return "No recovery plays ranked for this month";
  return items
    .map((item) => {
      const short = truncate(item.title, 36);
      return `${ROLE_LABEL[item.role]}: ${short}`;
    })
    .join(" · ");
}

/** One specific desk play from the top flagged deal — not a store-wide recoverable total. */
function addTopAtRiskDealCandidate(pool: Candidate[], deals: AtRiskDealRadarInput[]) {
  const flagged = deals
    .filter((d) => d.estimatedRecoverableGross > 0)
    .slice()
    .sort((a, b) => b.estimatedRecoverableGross - a.estimatedRecoverableGross);
  if (!flagged.length) return;

  const top = flagged[0]!;
  const count = flagged.length;
  const reason = top.reasons.find((r) => r && !/no material/i.test(r)) ?? top.reasons[0] ?? "Deal structure risk";
  const vehicle = truncate(top.vehicle || "unit", 28);
  const customer = truncate(top.customer || "Customer", 24);

  const title =
    count === 1
      ? `Desk: ${customer} (${vehicle})`
      : `Desk: ${customer} (${vehicle}) — ${count - 1} more flagged`;

  const actionHint = truncate(
    top.recommendedAction.replace(/\.$/, "") || "Re-structure before funding",
    72,
  );

  const unitRecovery = Math.round(top.estimatedRecoverableGross);
  const estimatedImpact =
    unitRecovery >= 500
      ? `~$${unitRecovery.toLocaleString()} on this unit if ${actionHint.toLowerCase()}`
      : `Resolve ${truncate(reason, 48)} before delivery`;

  addCandidate(pool, {
    id: `at-risk-deal-${customer.toLowerCase().replace(/\s+/g, "-")}`,
    role: "operational",
    title,
    estimatedImpact,
    department: "Sales",
    confidence: top.riskLevel === "high" ? "Medium" : "Medium",
    source:
      count === 1
        ? `Daily Log · 1 at-risk deal (${truncate(reason, 40)})`
        : `Daily Log · ${count} at-risk deals (top: ${truncate(reason, 32)})`,
    dollarScore: unitRecovery * 0.25,
    operationalScore: unitRecovery + (top.riskLevel === "high" ? 2000 : 800),
    defensiveScore: 0,
  });
}

function buildDepartmentTakeaways(
  monthly: MonthlyGrossTracking,
  stale: boolean,
): DepartmentRadarTakeaway[] {
  const order: Array<"Sales" | "Service" | "Parts"> = ["Sales", "Service", "Parts"];
  return order.map((name) => {
    const dept = monthly.departments.find((d) => d.department === name);
    const worst = dept?.worstLine ?? null;
    const best = dept?.bestLine ?? null;
    return {
      department: name,
      focusLine: worst?.label ?? null,
      focusGap: formatGap(worst?.gapToTarget),
      strengthLine: best?.label ?? null,
      strengthGap: formatGap(best?.gapToTarget),
      source: stale ? `${DEPT_SHEET_SOURCE[name]} (verify tab month)` : DEPT_SHEET_SOURCE[name],
    };
  });
}

/** Top 3 store recovery plays + per-department focus/strength from workbook lines. */
export function buildOpportunityRadar(params: {
  monthly: MonthlyGrossTracking;
  actionQueue: ActionQueueRow[];
  primaryThreat: { title: string; department: string; impact?: number } | null;
  atRiskDeals: AtRiskDealRadarInput[];
  staleWarnings: string[];
}): OpportunityRadarBundle {
  const pool: Candidate[] = [];
  const stale = params.staleWarnings.length > 0;

  for (const dept of params.monthly.departments) {
    if (dept.department === "Forecast") continue;
    const radarDept = dept.department as RadarDept;
    if (radarDept === "Store") continue;
    const gap = dept.gapToTarget;
    const pace = dept.pacePercent;

    if (gap !== null && Number.isFinite(gap) && gap < -500) {
      const absGap = Math.abs(gap);
      let title = `${dept.department} department gross recovery`;
      let operationalScore = absGap * 0.35;

      if (dept.department === "Parts") {
        title = "Parts retail push to close the gap";
        operationalScore = absGap * 0.85;
      } else if (dept.department === "Service") {
        title = "Service billed hours and advisor throughput";
        operationalScore =
          pace !== null && Number.isFinite(pace) && pace >= 85 && pace < 100 ? absGap * 0.95 : absGap * 0.7;
      } else if (dept.department === "Sales") {
        title = "Sales gross — protect front while closing units";
        operationalScore = absGap * 0.4;
      }

      addCandidate(pool, {
        id: `dept-gap-${dept.department.toLowerCase()}`,
        role: "dollar",
        title,
        estimatedImpact: compactImpactDollars(gap),
        department: radarDept,
        confidence: deptConfidence(dept, stale),
        source: sheetSource(dept.department, "department total vs target"),
        dollarScore: absGap,
        operationalScore,
        defensiveScore: 0,
      });
    }

    if (gap !== null && Number.isFinite(gap) && gap > 3000) {
      addCandidate(pool, {
        id: `dept-defend-${dept.department.toLowerCase()}`,
        role: "defensive",
        title: `Hold ${dept.department} strength — already ahead of plan`,
        estimatedImpact: `~$${Math.round(gap).toLocaleString()} cushion to protect`,
        department: radarDept,
        confidence: deptConfidence(dept, stale),
        source: sheetSource(dept.department, "department total ahead of target"),
        dollarScore: 0,
        operationalScore: 0,
        defensiveScore: gap,
      });
    }

    const worst = dept.worstLine;
    if (worst && worst.gapToTarget !== null && Number.isFinite(worst.gapToTarget) && worst.gapToTarget < -1000) {
      const absGap = Math.abs(worst.gapToTarget);
      addCandidate(pool, {
        id: `dept-worst-line-${dept.department.toLowerCase()}-${worst.label.toLowerCase().replace(/\s+/g, "-")}`,
        role: "dollar",
        title: `Stabilize ${worst.label}`,
        estimatedImpact: compactImpactDollars(worst.gapToTarget),
        department: radarDept,
        confidence: lineConfidence(worst, stale),
        source: sheetSource(dept.department, `line: ${worst.label}`),
        dollarScore: absGap * 1.08,
        operationalScore: absGap * 0.5,
        defensiveScore: 0,
      });
    }

    const best = dept.bestLine;
    if (best && best.gapToTarget !== null && Number.isFinite(best.gapToTarget) && best.gapToTarget > 1500) {
      addCandidate(pool, {
        id: `dept-best-line-${dept.department.toLowerCase()}-${best.label.toLowerCase().replace(/\s+/g, "-")}`,
        role: "defensive",
        title: `Protect ${best.label} in ${dept.department}`,
        estimatedImpact: `~$${Math.round(best.gapToTarget).toLocaleString()} ahead on this line`,
        department: radarDept,
        confidence: lineConfidence(best, stale),
        source: sheetSource(dept.department, `line: ${best.label}`),
        dollarScore: 0,
        operationalScore: 0,
        defensiveScore: best.gapToTarget * 1.05,
      });
    }

    if (
      dept.department === "Service" &&
      pace !== null &&
      Number.isFinite(pace) &&
      pace >= 85 &&
      pace < 100 &&
      gap !== null &&
      Number.isFinite(gap) &&
      gap < 0
    ) {
      addCandidate(pool, {
        id: "service-throughput-fix",
        role: "operational",
        title: "Service advisor throughput — close the week",
        estimatedImpact: compactImpactDollars(gap),
        department: "Service",
        confidence: deptConfidence(dept, stale),
        source: sheetSource("Service", "pace 85–99% — throughput lever"),
        dollarScore: Math.abs(gap) * 0.45,
        operationalScore: Math.abs(gap) + (100 - pace) * 800,
        defensiveScore: 0,
      });
    }
  }

  const storeWorst = params.monthly.worstTrackingLine;
  if (storeWorst && storeWorst.gapToTarget !== null && Number.isFinite(storeWorst.gapToTarget) && storeWorst.gapToTarget < -1000) {
    const absGap = Math.abs(storeWorst.gapToTarget);
    const dept = normalizeDept(storeWorst.department);
    addCandidate(pool, {
      id: `store-worst-line-${storeWorst.label.toLowerCase().replace(/\s+/g, "-")}`,
      role: "dollar",
      title: `Store priority: stabilize ${storeWorst.label}`,
      estimatedImpact: compactImpactDollars(storeWorst.gapToTarget),
      department: dept,
      confidence: lineConfidence(storeWorst, stale),
      source:
        dept === "Store"
          ? "Store rollup · worst tracking line"
          : sheetSource(dept, `store-wide worst line: ${storeWorst.label}`),
      dollarScore: absGap * 1.1,
      operationalScore: absGap * 0.4,
      defensiveScore: 0,
    });
  }

  const storeBest = params.monthly.bestTrackingLine;
  if (storeBest && storeBest.gapToTarget !== null && Number.isFinite(storeBest.gapToTarget) && storeBest.gapToTarget > 1500) {
    const dept = normalizeDept(storeBest.department);
    addCandidate(pool, {
      id: `store-best-line-${storeBest.label.toLowerCase().replace(/\s+/g, "-")}`,
      role: "defensive",
      title: `Store strength: protect ${storeBest.label}`,
      estimatedImpact: `~$${Math.round(storeBest.gapToTarget).toLocaleString()} ahead on this line`,
      department: dept,
      confidence: lineConfidence(storeBest, stale),
      source:
        dept === "Store"
          ? "Store rollup · best tracking line"
          : sheetSource(dept, `store-wide best line: ${storeBest.label}`),
      dollarScore: 0,
      operationalScore: 0,
      defensiveScore: storeBest.gapToTarget * 1.1,
    });
  }

  if (params.primaryThreat?.title) {
    const impact = params.primaryThreat.impact ?? 0;
    addCandidate(pool, {
      id: "primary-threat",
      role: "dollar",
      title: params.primaryThreat.title,
      estimatedImpact: impact > 0 ? queueImpactDollars(impact) : compactImpactDollars(-8000),
      department: normalizeDept(params.primaryThreat.department),
      confidence: impact > 0 && !stale ? "High" : stale ? "Low" : "Medium",
      source: "Velocity engine · primary profit threat",
      dollarScore: Math.max(impact, 5000),
      operationalScore: impact > 0 && impact < 12_000 ? impact * 1.1 : impact * 0.35,
      defensiveScore: 0,
    });
  }

  for (const row of params.actionQueue.slice(0, 5)) {
    const impact = row.impact ?? 0;
    const dept = normalizeDept(row.department);
    const fast =
      /throughput|stip|funding|notes|advisor|counter|retail|handoff|pace|hours/i.test(row.title) ||
      row.severity === "high";
    addCandidate(pool, {
      id: `aq-${row.id}`,
      role: fast ? "operational" : "dollar",
      title: row.title,
      estimatedImpact: queueImpactDollars(impact),
      department: dept,
      confidence: impact > 0 && !stale ? "High" : stale ? "Low" : "Medium",
      source: "Velocity engine · ranked action queue",
      dollarScore: impact * 0.75,
      operationalScore: fast ? impact * 1.15 + (row.severity === "high" ? 2500 : 800) : impact * 0.2,
      defensiveScore: 0,
    });
  }

  addTopAtRiskDealCandidate(pool, params.atRiskDeals);

  const sales = params.monthly.departments.find((d) => d.department === "Sales");
  if (
    sales?.pacePercent !== null &&
    sales?.pacePercent !== undefined &&
    Number.isFinite(sales.pacePercent) &&
    sales.pacePercent >= 98 &&
    (sales.gapToTarget ?? 0) >= 0
  ) {
    addCandidate(pool, {
      id: "defend-sales-front",
      role: "defensive",
      title: "Protect front-end gross while Sales carries pace",
      estimatedImpact: "Hold desk minimums — don't buy rate with gross",
      department: "Sales",
      confidence: deptConfidence(sales, stale),
      source: sheetSource("Sales", "department at/above pace"),
      dollarScore: 0,
      operationalScore: 0,
      defensiveScore: (sales.gapToTarget ?? 0) > 0 ? (sales.gapToTarget ?? 0) + 4000 : 6000,
    });
  }

  const used = new Set<string>();
  const roles: OpportunityRadarRole[] = ["dollar", "operational", "defensive"];
  const items = roles.map((role) => pickByRole(pool, role, used) ?? { ...FALLBACKS[role] });

  return {
    items,
    departmentTakeaways: buildDepartmentTakeaways(params.monthly, stale),
    summaryLine: buildRadarSummaryLine(items),
  };
}
