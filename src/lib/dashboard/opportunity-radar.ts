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

function addCandidate(pool: Candidate[], candidate: Candidate) {
  if (pool.some((c) => c.id === candidate.id)) return;
  pool.push(candidate);
}

function pickByRole(pool: Candidate[], role: OpportunityRadarRole, used: Set<string>): OpportunityRadarItem | null {
  const scoreKey =
    role === "dollar" ? "dollarScore" : role === "operational" ? "operationalScore" : "defensiveScore";
  const ranked = pool
    .filter((c) => c[scoreKey] > 0 && !used.has(c.id))
    .sort((a, b) => b[scoreKey] - a[scoreKey] || b.dollarScore - a.dollarScore);
  const top = ranked[0];
  if (!top) return null;
  used.add(top.id);
  return { id: top.id, role, title: top.title, estimatedImpact: top.estimatedImpact, department: top.department, confidence: top.confidence };
}

const FALLBACKS: Record<OpportunityRadarRole, OpportunityRadarItem> = {
  dollar: {
    id: "fallback-dollar",
    role: "dollar",
    title: "Close the largest department gross gap first",
    estimatedImpact: "Prioritize the dept with the biggest $ gap to target",
    department: "Store",
    confidence: "Low",
  },
  operational: {
    id: "fallback-operational",
    role: "operational",
    title: "Run a same-day throughput stand-up",
    estimatedImpact: "Advisor hours and parts counter push — fastest levers",
    department: "Store",
    confidence: "Low",
  },
  defensive: {
    id: "fallback-defensive",
    role: "defensive",
    title: "Protect lines already beating plan",
    estimatedImpact: "Hold discipline on strength lines while recovering gaps",
    department: "Store",
    confidence: "Medium",
  },
};

/** Top 3 recovery opportunities for Expanded insights — ranked by role, not a single sort. */
export function buildOpportunityRadar(params: {
  monthly: MonthlyGrossTracking;
  actionQueue: ActionQueueRow[];
  primaryThreat: { title: string; department: string; impact?: number } | null;
  recoverableToday: number;
  staleWarnings: string[];
}): OpportunityRadarItem[] {
  const pool: Candidate[] = [];
  const stale = params.staleWarnings.length > 0;

  for (const dept of params.monthly.departments) {
    if (dept.department === "Forecast") continue;
    const radarDept = dept.department as RadarDept;
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
        dollarScore: 0,
        operationalScore: 0,
        defensiveScore: gap,
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
        dollarScore: Math.abs(gap) * 0.5,
        operationalScore: Math.abs(gap) + (100 - pace) * 800,
        defensiveScore: 0,
      });
    }
  }

  const worst = params.monthly.worstTrackingLine;
  if (worst && worst.gapToTarget !== null && Number.isFinite(worst.gapToTarget) && worst.gapToTarget < -1000) {
    const absGap = Math.abs(worst.gapToTarget);
    const isUsed = /used/i.test(worst.label);
    addCandidate(pool, {
      id: `line-worst-${worst.label.toLowerCase().replace(/\s+/g, "-")}`,
      role: "dollar",
      title: isUsed ? "Used gross quality — stabilize the line" : `Stabilize ${worst.label}`,
      estimatedImpact: compactImpactDollars(worst.gapToTarget),
      department: normalizeDept(worst.department),
      confidence: lineConfidence(worst, stale),
      dollarScore: absGap * 1.05,
      operationalScore: isUsed ? absGap * 0.55 : absGap * 0.35,
      defensiveScore: 0,
    });
  }

  const best = params.monthly.bestTrackingLine;
  if (best && best.gapToTarget !== null && Number.isFinite(best.gapToTarget) && best.gapToTarget > 1500) {
    addCandidate(pool, {
      id: `line-best-${best.label.toLowerCase().replace(/\s+/g, "-")}`,
      role: "defensive",
      title: `Protect ${best.label} — replicate the discipline`,
      estimatedImpact: `~$${Math.round(best.gapToTarget).toLocaleString()} ahead on this line`,
      department: normalizeDept(best.department),
      confidence: lineConfidence(best, stale),
      dollarScore: 0,
      operationalScore: 0,
      defensiveScore: best.gapToTarget * 1.1,
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
      dollarScore: Math.max(impact, 6000),
      operationalScore: impact > 0 && impact < 12_000 ? impact * 1.2 : impact * 0.4,
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
      dollarScore: impact,
      operationalScore: fast ? impact * 1.15 + (row.severity === "high" ? 2500 : 800) : impact * 0.25,
      defensiveScore: 0,
    });
  }

  if (params.recoverableToday > 1500) {
    addCandidate(pool, {
      id: "recoverable-today",
      role: "dollar",
      title: "Capture recoverable gross in the closing window",
      estimatedImpact: queueImpactDollars(params.recoverableToday),
      department: "Store",
      confidence: stale ? "Medium" : "High",
      dollarScore: params.recoverableToday,
      operationalScore: params.recoverableToday * 0.6,
      defensiveScore: 0,
    });
  }

  const sales = params.monthly.departments.find((d) => d.department === "Sales");
  if (sales?.pacePercent !== null && sales?.pacePercent !== undefined && Number.isFinite(sales.pacePercent) && sales.pacePercent >= 98) {
    addCandidate(pool, {
      id: "defend-sales-front",
      role: "defensive",
      title: "Protect front-end gross while Sales carries pace",
      estimatedImpact: "Hold desk minimums — don't buy rate with gross",
      department: "Sales",
      confidence: deptConfidence(sales, stale),
      dollarScore: 0,
      operationalScore: 0,
      defensiveScore: (sales.gapToTarget ?? 0) > 0 ? (sales.gapToTarget ?? 0) + 4000 : 7500,
    });
  }

  const used = new Set<string>();
  const roles: OpportunityRadarRole[] = ["dollar", "operational", "defensive"];
  return roles.map((role) => pickByRole(pool, role, used) ?? { ...FALLBACKS[role] });
}
