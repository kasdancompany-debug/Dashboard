import type { DepartmentGrossTracking, MonthlyGrossDepartment } from "@/src/lib/velocity/monthly-gross/types";

/** Prior-day store snapshot — populate from persisted history when available. */
export type SinceYesterdaySnapshot = {
  capturedAt: string;
  totalTrackingGross: number | null;
  totalPacePercent: number | null;
  departments: {
    department: MonthlyGrossDepartment;
    trackingGross: number | null;
    pacePercent: number | null;
    gapToTarget: number | null;
  }[];
};

export type SinceYesterdayPill = {
  id: string;
  label: string;
  value: string;
  tone: "positive" | "negative" | "neutral" | "dept-sales" | "dept-service" | "dept-parts";
};

export type SinceYesterdayRowModel =
  | { status: "unavailable"; message: string }
  | { status: "ready"; pills: SinceYesterdayPill[]; isEstimated: boolean };

type CurrentSlice = {
  reportingMonthKey: string;
  daysUsed: number;
  totalTrackingGross: number | null;
  totalPacePercent: number | null;
  departments: DepartmentGrossTracking[];
};

function hashSeed(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i += 1) h = (h * 31 + input.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function roundMoney(n: number) {
  return Math.round(n);
}

function formatMoneyDelta(delta: number): string {
  if (!Number.isFinite(delta) || Math.abs(delta) < 1) return "Flat";
  const abs = `$${roundMoney(Math.abs(delta)).toLocaleString()}`;
  return delta > 0 ? `+${abs}` : `−${abs}`;
}

function formatPaceDelta(delta: number): string {
  if (!Number.isFinite(delta) || Math.abs(delta) < 0.05) return "Flat";
  const sign = delta > 0 ? "+" : "−";
  return `${sign}${Math.abs(delta).toFixed(1)} pts`;
}

function deptTone(dept: MonthlyGrossDepartment): SinceYesterdayPill["tone"] {
  if (dept === "Sales") return "dept-sales";
  if (dept === "Service") return "dept-service";
  if (dept === "Parts") return "dept-parts";
  return "neutral";
}

/**
 * Deterministic estimated prior day when no persisted snapshot exists.
 * Replace with real `prior` from storage/API when historical capture is wired.
 */
export function estimatePriorSnapshot(current: CurrentSlice): SinceYesterdaySnapshot {
  const seed = hashSeed(`${current.reportingMonthKey}:${current.daysUsed}`);
  const dayFactor = Math.max(1, current.daysUsed);

  const grossJitter = ((seed % 9) - 4) * 1800 + dayFactor * 420;
  const paceJitter = ((seed % 7) - 3) * 0.35;

  const totalTracking =
    current.totalTrackingGross !== null && Number.isFinite(current.totalTrackingGross)
      ? current.totalTrackingGross - grossJitter
      : null;

  const totalPace =
    current.totalPacePercent !== null && Number.isFinite(current.totalPacePercent)
      ? current.totalPacePercent - paceJitter
      : null;

  const departments = current.departments
    .filter((d) => d.department === "Sales" || d.department === "Service" || d.department === "Parts")
    .map((d, idx) => {
      const localSeed = hashSeed(`${current.reportingMonthKey}:${d.department}:${idx}`);
      const trackJitter = ((localSeed % 11) - 5) * 950;
      const paceLocal = ((localSeed % 5) - 2) * 0.4;
      const tracking =
        d.trackingGross !== null && Number.isFinite(d.trackingGross) ? d.trackingGross - trackJitter : null;
      const pace = d.pacePercent !== null && Number.isFinite(d.pacePercent) ? d.pacePercent - paceLocal : null;
      const gap =
        tracking !== null && Number.isFinite(d.targetGross) ? tracking - d.targetGross : d.gapToTarget;
      return {
        department: d.department,
        trackingGross: tracking,
        pacePercent: pace,
        gapToTarget: gap,
      };
    });

  return {
    capturedAt: new Date(Date.now() - 86_400_000).toISOString(),
    totalTrackingGross: totalTracking,
    totalPacePercent: totalPace,
    departments,
  };
}

function departmentMomentum(
  current: DepartmentGrossTracking,
  prior: SinceYesterdaySnapshot["departments"][number] | undefined,
): number | null {
  if (prior) {
    if (
      current.trackingGross !== null &&
      prior.trackingGross !== null &&
      Number.isFinite(current.trackingGross) &&
      Number.isFinite(prior.trackingGross)
    ) {
      return current.trackingGross - prior.trackingGross;
    }
    if (
      current.gapToTarget !== null &&
      prior.gapToTarget !== null &&
      Number.isFinite(current.gapToTarget) &&
      Number.isFinite(prior.gapToTarget)
    ) {
      return prior.gapToTarget - current.gapToTarget;
    }
  }
  return null;
}

function grossDeltaTone(delta: number): SinceYesterdayPill["tone"] {
  if (delta > 0) return "positive";
  if (delta < 0) return "negative";
  return "neutral";
}

function paceDeltaTone(delta: number): SinceYesterdayPill["tone"] {
  if (delta > 0) return "positive";
  if (delta < 0) return "negative";
  return "neutral";
}

/**
 * Builds the Since Yesterday row from optional persisted history.
 * When `prior` is omitted, uses `estimatePriorSnapshot` so UI can ship before history storage exists.
 */
export function buildSinceYesterdayRow(
  current: CurrentSlice,
  prior?: SinceYesterdaySnapshot | null,
  options?: { allowEstimate?: boolean },
): SinceYesterdayRowModel {
  const allowEstimate = options?.allowEstimate !== false;

  const hasCurrentGross =
    current.totalTrackingGross !== null && Number.isFinite(current.totalTrackingGross) && current.daysUsed >= 1;
  const hasDepts = current.departments.some(
    (d) =>
      (d.department === "Sales" || d.department === "Service" || d.department === "Parts") &&
      (d.trackingGross !== null || d.gapToTarget !== null),
  );

  if (!hasCurrentGross && !hasDepts) {
    return { status: "unavailable", message: "Not enough history yet." };
  }

  const isEstimated = !prior;
  const priorSnapshot = prior ?? (allowEstimate ? estimatePriorSnapshot(current) : null);

  if (!priorSnapshot) {
    return { status: "unavailable", message: "Not enough history yet." };
  }

  const pills: SinceYesterdayPill[] = [];

  if (
    current.totalTrackingGross !== null &&
    priorSnapshot.totalTrackingGross !== null &&
    Number.isFinite(current.totalTrackingGross) &&
    Number.isFinite(priorSnapshot.totalTrackingGross)
  ) {
    const delta = current.totalTrackingGross - priorSnapshot.totalTrackingGross;
    pills.push({
      id: "gross",
      label: "Gross vs yesterday",
      value: formatMoneyDelta(delta),
      tone: grossDeltaTone(delta),
    });
  }

  if (
    current.totalPacePercent !== null &&
    priorSnapshot.totalPacePercent !== null &&
    Number.isFinite(current.totalPacePercent) &&
    Number.isFinite(priorSnapshot.totalPacePercent)
  ) {
    const delta = current.totalPacePercent - priorSnapshot.totalPacePercent;
    pills.push({
      id: "pace",
      label: "Pace vs yesterday",
      value: formatPaceDelta(delta),
      tone: paceDeltaTone(delta),
    });
  }

  const priorByDept = new Map(priorSnapshot.departments.map((d) => [d.department, d]));
  const scored = current.departments
    .filter((d) => d.department === "Sales" || d.department === "Service" || d.department === "Parts")
    .map((d) => ({
      department: d.department,
      momentum: departmentMomentum(d, priorByDept.get(d.department)),
    }))
    .filter((row): row is { department: MonthlyGrossDepartment; momentum: number } => row.momentum !== null);

  if (scored.length) {
    const improving = scored.reduce((best, row) => (row.momentum > best.momentum ? row : best));
    const slipping = scored.reduce((worst, row) => (row.momentum < worst.momentum ? row : worst));

    if (improving.momentum > 0) {
      pills.push({
        id: "improving",
        label: "Best improving",
        value: improving.department,
        tone: deptTone(improving.department),
      });
    }

    if (slipping.momentum < 0) {
      pills.push({
        id: "slipping",
        label: "Biggest slip",
        value: slipping.department,
        tone: deptTone(slipping.department),
      });
    }
  }

  if (pills.length < 2) {
    return { status: "unavailable", message: "Not enough history yet." };
  }

  return { status: "ready", pills: pills.slice(0, 4), isEstimated };
}
