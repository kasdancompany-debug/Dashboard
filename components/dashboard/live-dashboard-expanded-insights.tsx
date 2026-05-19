/**
 * Expanded insights panel — primary surface for live-dashboard UX iteration.
 * Header through department scorecards live in `live-dashboard-locked-top.tsx` (locked).
 */
"use client";

import { useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  Clock3,
  Eye,
  Target,
  TrendingDown,
  TrendingUp,
  Zap,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { VelocityData } from "@/src/lib/velocity/get-velocity-data";
import type { BestWorstTrackingLine, DepartmentGrossTracking, MonthlyGrossDepartment } from "@/src/lib/velocity/monthly-gross/types";
import type { ExpandedInsightsKeyAction } from "@/src/lib/dashboard/expanded-insights-key-actions";
import {
  ExecSection,
  gapTone,
  money,
  paceTone,
  signedMoney,
  type SignalDot,
} from "@/components/dashboard/live-dashboard-shared";

const DEPT_PILL: Record<MonthlyGrossDepartment, string> = {
  Sales: "bg-emerald-500/30 text-emerald-50 ring-emerald-400/50",
  Service: "bg-amber-500/30 text-amber-50 ring-amber-400/50",
  Parts: "bg-rose-500/30 text-rose-50 ring-rose-400/50",
  Forecast: "bg-violet-500/30 text-violet-50 ring-violet-400/50",
};

const PRIORITY_THEME = {
  critical: {
    label: "Do today",
    Icon: Zap,
    rail: "border-l-rose-500",
    glow: "shadow-[inset_4px_0_0_0_rgb(244,63,94),0_0_40px_-12px_rgba(244,63,94,0.45)]",
    surface: "border-rose-500/40 bg-gradient-to-br from-rose-950/90 via-rose-950/50 to-slate-950/80",
    badge: "bg-rose-500 text-white shadow-[0_0_20px_-4px_rgba(244,63,94,0.8)]",
    number: "bg-rose-500 text-white ring-rose-300/50",
    actionBox: "border-emerald-500/35 bg-emerald-950/40",
    actionLabel: "text-emerald-300",
    evidenceBox: "border-rose-400/30 bg-rose-950/50",
    evidenceLabel: "text-rose-200",
    metric: "border-rose-400/40 bg-rose-500/15 text-rose-100",
  },
  high: {
    label: "This week",
    Icon: Clock3,
    rail: "border-l-amber-400",
    glow: "shadow-[inset_4px_0_0_0_rgb(251,191,36),0_0_36px_-14px_rgba(251,191,36,0.35)]",
    surface: "border-amber-500/35 bg-gradient-to-br from-amber-950/85 via-amber-950/40 to-slate-950/80",
    badge: "bg-amber-500 text-amber-950 shadow-[0_0_18px_-4px_rgba(251,191,36,0.7)]",
    number: "bg-amber-500 text-amber-950 ring-amber-200/50",
    actionBox: "border-emerald-500/30 bg-emerald-950/35",
    actionLabel: "text-emerald-300",
    evidenceBox: "border-amber-400/30 bg-amber-950/45",
    evidenceLabel: "text-amber-200",
    metric: "border-amber-400/40 bg-amber-500/15 text-amber-100",
  },
  medium: {
    label: "Watch",
    Icon: Eye,
    rail: "border-l-sky-400",
    glow: "shadow-[inset_4px_0_0_0_rgb(56,189,248),0_0_32px_-16px_rgba(56,189,248,0.3)]",
    surface: "border-sky-500/30 bg-gradient-to-br from-sky-950/80 via-sky-950/35 to-slate-950/80",
    badge: "bg-sky-500 text-sky-950 shadow-[0_0_16px_-4px_rgba(56,189,248,0.6)]",
    number: "bg-sky-500 text-sky-950 ring-sky-200/50",
    actionBox: "border-emerald-500/25 bg-emerald-950/30",
    actionLabel: "text-emerald-300",
    evidenceBox: "border-sky-400/25 bg-sky-950/40",
    evidenceLabel: "text-sky-200",
    metric: "border-sky-400/35 bg-sky-500/12 text-sky-100",
  },
} as const;

function deptLineSurface(department: MonthlyGrossDepartment | undefined, kind: "focus" | "strength") {
  if (kind === "strength") {
    return "border-emerald-500/50 bg-gradient-to-br from-emerald-950/90 via-emerald-950/40 to-slate-950/90 shadow-[0_0_48px_-16px_rgba(52,211,153,0.35)]";
  }
  if (department === "Sales") return "border-rose-500/40 bg-gradient-to-br from-emerald-950/50 via-rose-950/70 to-slate-950/90";
  if (department === "Service") return "border-rose-500/40 bg-gradient-to-br from-amber-950/50 via-rose-950/70 to-slate-950/90";
  if (department === "Parts") return "border-rose-500/45 bg-gradient-to-br from-rose-950/80 via-rose-950/50 to-slate-950/90 shadow-[0_0_48px_-16px_rgba(244,63,94,0.35)]";
  if (department === "Forecast") return "border-violet-500/40 bg-gradient-to-br from-violet-950/70 via-rose-950/50 to-slate-950/90";
  return "border-rose-500/40 bg-gradient-to-br from-rose-950/80 to-slate-950/90 shadow-[0_0_48px_-16px_rgba(244,63,94,0.3)]";
}

function gapMeterPercent(tracking: number | null, target: number) {
  if (tracking === null || !Number.isFinite(tracking) || target <= 0) return null;
  return Math.min(130, Math.max(0, (tracking / target) * 100));
}

function parseEvidenceMetrics(evidence: string): string[] {
  const metrics: string[] = [];
  const moneyMatches = evidence.match(/(?:≈\s*)?\$[\d,]+(?:\.\d+)?[kKmM]?/g);
  if (moneyMatches) metrics.push(...moneyMatches.slice(0, 2));
  const pctMatches = evidence.match(/\d{1,3}%/g);
  if (pctMatches) metrics.push(...pctMatches.slice(0, 1));
  if (metrics.length < 2 && /behind|under|below|gap/i.test(evidence)) {
    const short = evidence.length > 72 ? `${evidence.slice(0, 69)}…` : evidence;
    if (!metrics.some((m) => short.includes(m))) metrics.push(short);
  }
  return metrics.slice(0, 3);
}

function LineFocusCard({ kind, line }: { kind: "focus" | "strength"; line: BestWorstTrackingLine | null }) {
  const isFocus = kind === "focus";
  const Icon = isFocus ? TrendingDown : TrendingUp;
  const meter = line ? gapMeterPercent(line.trackingGross, line.targetGross) : null;

  return (
    <article
      className={cn(
        "relative overflow-hidden rounded-2xl border border-l-[5px] p-5 ring-1 ring-inset ring-white/[0.06]",
        line ? deptLineSurface(line.department, kind) : "border-l-slate-600 bg-slate-950/80",
      )}
    >
      <div className="pointer-events-none absolute -right-6 -top-6 h-28 w-28 rounded-full bg-white/[0.04] blur-2xl" />
      <div className="relative flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-xl ring-2 ring-inset",
              isFocus ? "bg-rose-500/25 text-rose-300 ring-rose-400/40" : "bg-emerald-500/25 text-emerald-300 ring-emerald-400/40",
            )}
          >
            <Icon className="h-5 w-5" aria-hidden />
          </span>
          <p className={cn("text-[11px] font-bold uppercase tracking-[0.16em]", isFocus ? "text-rose-200" : "text-emerald-200")}>
            {isFocus ? "Worst tracking line" : "Best tracking line"}
          </p>
        </div>
        {line ? (
          <span className={cn("rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em] ring-1 ring-inset", DEPT_PILL[line.department])}>
            {line.department}
          </span>
        ) : null}
      </div>

      {line ? (
        <>
          <h3 className="relative mt-3 text-[18px] font-semibold leading-snug text-white">{line.label}</h3>
          <p className={cn("relative mt-2 font-mono text-[26px] font-bold tabular-nums leading-none", gapTone(line.gapToTarget))}>
            {line.gapToTarget === null || line.gapToTarget === undefined ? "—" : signedMoney(line.gapToTarget)}
          </p>
          <p className="relative text-[12px] font-medium text-slate-400">vs line target this month</p>

          {meter !== null ? (
            <div className="relative mt-4">
              <div className="mb-1 flex justify-between text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500">
                <span>Tracking pace</span>
                <span className={paceTone(line.pacePercent)}>{Math.round(meter)}% of target</span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-black/50 ring-1 ring-inset ring-white/10">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    meter >= 100 ? "bg-emerald-400" : meter >= 90 ? "bg-amber-400" : "bg-rose-500",
                  )}
                  style={{ width: `${Math.min(100, meter)}%` }}
                />
              </div>
            </div>
          ) : null}

          <dl className="relative mt-4 grid grid-cols-3 gap-2">
            {[
              { label: "Tracking", value: money(line.trackingGross), tone: "text-white" },
              { label: "Target", value: money(line.targetGross), tone: "text-white" },
              {
                label: "Pace",
                value: line.pacePercent === null || line.pacePercent === undefined ? "—" : `${Math.round(line.pacePercent)}%`,
                tone: paceTone(line.pacePercent),
              },
            ].map((cell) => (
              <div key={cell.label} className="rounded-lg border border-white/10 bg-black/35 px-2 py-2.5 text-center">
                <dt className="text-[9px] font-bold uppercase tracking-[0.1em] text-slate-500">{cell.label}</dt>
                <dd className={cn("mt-1 font-mono text-[15px] font-bold tabular-nums", cell.tone)}>{cell.value}</dd>
              </div>
            ))}
          </dl>
        </>
      ) : (
        <p className="relative mt-3 text-[14px] text-slate-500">No line data for this month.</p>
      )}
    </article>
  );
}

const SIGNAL_ICON: Record<SignalDot, typeof CheckCircle2> = {
  ok: CheckCircle2,
  warn: AlertTriangle,
  bad: CircleAlert,
  neutral: Target,
};

function SignalChips({ items }: { items: { text: string; dot: SignalDot }[] }) {
  if (!items.length) {
    return <p className="text-[14px] text-slate-500">No signals from current month data.</p>;
  }
  const tone: Record<SignalDot, string> = {
    ok: "border-emerald-400/50 bg-emerald-500/15 text-emerald-50 shadow-[0_0_24px_-12px_rgba(52,211,153,0.4)]",
    warn: "border-amber-400/50 bg-amber-500/15 text-amber-50 shadow-[0_0_24px_-12px_rgba(251,191,36,0.35)]",
    bad: "border-rose-400/50 bg-rose-500/15 text-rose-50 shadow-[0_0_24px_-12px_rgba(244,63,94,0.4)]",
    neutral: "border-slate-500/40 bg-slate-800/60 text-slate-200",
  };
  return (
    <ul className="flex flex-wrap gap-2.5">
      {items.map((item, i) => {
        const Icon = SIGNAL_ICON[item.dot];
        return (
          <li
            key={`${i}-${item.text}`}
            className={cn(
              "flex max-w-full items-center gap-2 rounded-xl border px-3.5 py-2 text-[13px] font-semibold leading-snug",
              tone[item.dot],
            )}
          >
            <Icon className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
            <span>{item.text}</span>
          </li>
        );
      })}
    </ul>
  );
}

function ActionCard({ item, index }: { item: ExpandedInsightsKeyAction; index: number }) {
  const theme = PRIORITY_THEME[item.priority];
  const PriorityIcon = theme.Icon;
  const metrics = parseEvidenceMetrics(item.evidence);
  const [showFullEvidence, setShowFullEvidence] = useState(false);
  const evidenceLong = item.evidence.length > 100;

  return (
    <li
      className={cn(
        "overflow-hidden rounded-2xl border border-l-[6px] ring-1 ring-inset ring-white/[0.06]",
        theme.rail,
        theme.glow,
        theme.surface,
      )}
    >
      <div className="flex flex-col gap-4 p-4 md:flex-row md:gap-5 md:p-5">
        <div className="flex shrink-0 flex-col items-center gap-2 md:w-14">
          <span className={cn("flex h-10 w-10 items-center justify-center rounded-xl text-[15px] font-bold ring-2", theme.number)}>
            {index + 1}
          </span>
          <PriorityIcon className="h-5 w-5 opacity-80" aria-hidden />
        </div>

        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em]", theme.badge)}>
              <PriorityIcon className="h-3 w-3" aria-hidden />
              {theme.label}
            </span>
            <span className="rounded-md bg-black/30 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
              {item.sources.join(" · ")}
            </span>
          </div>

          <h3 className="text-[17px] font-bold leading-snug text-white md:text-[18px]">{item.headline}</h3>

          <div className="grid gap-3 md:grid-cols-2">
            <div className={cn("rounded-xl border p-3.5", theme.actionBox)}>
              <p className={cn("flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em]", theme.actionLabel)}>
                <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                Your move
              </p>
              <p className="mt-2 text-[14px] font-medium leading-relaxed text-slate-100">{item.action}</p>
            </div>

            <div className={cn("rounded-xl border p-3.5", theme.evidenceBox)}>
              <p className={cn("flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em]", theme.evidenceLabel)}>
                <BarChart3 className="h-3.5 w-3.5" aria-hidden />
                Why it matters
              </p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {metrics.map((m) => (
                  <li key={m} className={cn("rounded-lg border px-2.5 py-1 font-mono text-[13px] font-bold tabular-nums", theme.metric)}>
                    {m}
                  </li>
                ))}
              </ul>
              {(evidenceLong && !showFullEvidence) || !evidenceLong ? (
                <p className={cn("mt-2 text-[12px] leading-relaxed text-slate-300/90", evidenceLong && !showFullEvidence && "line-clamp-2")}>
                  {item.evidence}
                </p>
              ) : null}
              {evidenceLong ? (
                <button
                  type="button"
                  className="mt-2 flex items-center gap-1 text-[11px] font-semibold text-slate-400 hover:text-white"
                  onClick={() => setShowFullEvidence((v) => !v)}
                >
                  {showFullEvidence ? "Show less" : "Full detail"}
                  <ChevronDown className={cn("h-3.5 w-3.5 transition", showFullEvidence && "rotate-180")} aria-hidden />
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </li>
  );
}

function KeyActionsDigest({ items }: { items: VelocityData["keyActions"] }) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? items : items.slice(0, 4);

  const counts = items.reduce(
    (acc, item) => {
      acc[item.priority] += 1;
      return acc;
    },
    { critical: 0, high: 0, medium: 0 },
  );

  if (!items.length) {
    return (
      <p className="text-[14px] leading-relaxed text-slate-500">
        No leadership actions flagged — Notes and pacing look stable for this snapshot.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        {(
          [
            { key: "critical" as const, label: "Do today", count: counts.critical, className: "border-rose-500/50 bg-rose-500/20 text-rose-100" },
            { key: "high" as const, label: "This week", count: counts.high, className: "border-amber-500/50 bg-amber-500/20 text-amber-100" },
            { key: "medium" as const, label: "Watch", count: counts.medium, className: "border-sky-500/50 bg-sky-500/20 text-sky-100" },
          ] as const
        ).map((row) => (
          <div
            key={row.key}
            className={cn("rounded-xl border px-3 py-2.5 text-center ring-1 ring-inset ring-white/[0.06]", row.className)}
          >
            <p className="font-mono text-[22px] font-bold tabular-nums leading-none">{row.count}</p>
            <p className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.12em] opacity-90">{row.label}</p>
          </div>
        ))}
      </div>

      <ol className="space-y-4">
        {visible.map((item, index) => (
          <ActionCard key={item.id} item={item} index={index} />
        ))}
      </ol>

      {items.length > 4 ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full border-white/15 bg-white/[0.06] text-[12px] font-semibold text-slate-200 hover:bg-white/10"
          onClick={() => setShowAll((v) => !v)}
        >
          {showAll ? "Show fewer actions" : `Show all ${items.length} actions`}
        </Button>
      ) : null}
    </div>
  );
}

export type LiveDashboardExpandedInsightsProps = {
  worst: BestWorstTrackingLine | null;
  best: BestWorstTrackingLine | null;
  operationalSignals: { text: string; dot: SignalDot }[];
  keyActions: VelocityData["keyActions"];
  sourceLineage: VelocityData["sourceLineage"];
  departmentByName: Map<string, DepartmentGrossTracking | undefined>;
};

export function LiveDashboardExpandedInsights({
  worst,
  best,
  operationalSignals,
  keyActions,
  sourceLineage,
  departmentByName,
}: LiveDashboardExpandedInsightsProps) {
  const items = keyActions ?? [];
  const criticalCount = items.filter((i) => i.priority === "critical").length;

  return (
    <div className="space-y-5 scroll-mt-4 pb-10">
      {criticalCount > 0 ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-2.5 text-[13px] font-semibold text-rose-100">
          <Zap className="h-4 w-4 shrink-0 text-rose-300" aria-hidden />
          {criticalCount} item{criticalCount === 1 ? "" : "s"} need attention today
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <LineFocusCard kind="focus" line={worst} />
        <LineFocusCard kind="strength" line={best} />
      </div>

      <ExecSection>
        <p className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
          <Target className="h-3.5 w-3.5" aria-hidden />
          Today&apos;s signals
        </p>
        <SignalChips items={operationalSignals} />
      </ExecSection>

      <ExecSection>
        <p className="mb-1 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
          <Zap className="h-3.5 w-3.5 text-rose-400/90" aria-hidden />
          Key actions
        </p>
        <p className="mb-4 text-[13px] text-slate-400">
          Scan the color band: <span className="font-semibold text-rose-300">red = today</span>,{" "}
          <span className="font-semibold text-amber-300">amber = this week</span>,{" "}
          <span className="font-semibold text-sky-300">blue = watch</span>. Green box = what to do; tinted box = the numbers.
        </p>
        <KeyActionsDigest items={items} />
      </ExecSection>

      <ExecSection className="bg-black/25" padded>
        <details>
          <summary className="cursor-pointer text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500 hover:text-slate-300">
            Source lineage (technical)
          </summary>
          <div className="mt-3 space-y-2 text-[12px] text-slate-400">
            {sourceLineage.map((line) => {
              const department = departmentByName.get(line.source);
              return (
                <div key={line.source} className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                  <p className="font-semibold text-slate-200">{line.source.toUpperCase()}</p>
                  <p className="mt-1">
                    Tab: {line.resolvedTabName ?? "Unknown"} · Range: {line.resolvedRange}
                  </p>
                  <p className="mt-0.5">
                    Actual {money(department?.actualGross ?? 0)} · Tracking {money(department?.trackingGross ?? 0)} · Target{" "}
                    {money(department?.targetGross ?? 0)}
                  </p>
                  <p className={line.excluded ? "mt-1 text-rose-300" : "mt-1 text-emerald-300/90"}>
                    {line.excluded ? line.exclusionReason : "Included."}
                  </p>
                  {line.warnings.map((warning: string) => (
                    <p key={warning} className="mt-0.5 text-amber-200/90">
                      {warning}
                    </p>
                  ))}
                </div>
              );
            })}
          </div>
        </details>
      </ExecSection>
    </div>
  );
}
