/**
 * LOCKED LIVE DASHBOARD SURFACE (header → department scorecards).
 * Do not change layout, colours, or scorecard structure here unless the product owner explicitly unlocks it.
 * Day-to-day iterations belong in `live-dashboard-expanded-insights.tsx` and `meeting-mode-overlay.tsx`.
 */
"use client";

import { Activity, Presentation, RefreshCcw } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MonthSelector } from "@/src/components/velocity/MonthSelector";
import type { DepartmentGrossTracking } from "@/src/lib/velocity/monthly-gross/types";
import {
  ExecSection,
  departmentHealthFromPace,
  gapTone,
  money,
  paceTone,
  signedMoney,
} from "@/components/dashboard/live-dashboard-shared";

export type DeptKey = "Sales" | "Service" | "Parts";

/** Department identity: rail + surface tint — premium, scannable, no heavy glow. */
const DEPT_THEME: Record<
  DeptKey,
  {
    rail: string;
    surface: string;
    topWash: string;
    label: string;
  }
> = {
  Sales: {
    rail: "border-l-[5px] border-l-emerald-400",
    surface: "bg-[linear-gradient(135deg,rgba(6,78,59,0.35)_0%,rgba(15,23,42,0.92)_48%,rgba(15,23,42,0.98)_100%)]",
    topWash: "from-emerald-500/[0.14] via-transparent to-transparent",
    label: "text-emerald-200/95",
  },
  Service: {
    rail: "border-l-[5px] border-l-amber-400",
    surface: "bg-[linear-gradient(135deg,rgba(120,53,15,0.28)_0%,rgba(15,23,42,0.92)_48%,rgba(15,23,42,0.98)_100%)]",
    topWash: "from-amber-400/[0.14] via-transparent to-transparent",
    label: "text-amber-200/95",
  },
  Parts: {
    rail: "border-l-[5px] border-l-rose-500",
    surface: "bg-[linear-gradient(135deg,rgba(136,19,55,0.32)_0%,rgba(15,23,42,0.92)_48%,rgba(15,23,42,0.98)_100%)]",
    topWash: "from-rose-500/[0.12] via-fuchsia-600/[0.06] to-transparent",
    label: "text-rose-200/95",
  },
};

function DepartmentCommandCard({ dept, deptKey }: { dept: DepartmentGrossTracking | null | undefined; deptKey: DeptKey }) {
  const theme = DEPT_THEME[deptKey];
  const name = dept?.department ?? "Needs Setup";
  const pace = dept?.pacePercent ?? null;
  const paceLabel =
    pace === null || pace === undefined || !Number.isFinite(pace) ? "—" : `${Math.round(pace)}%`;

  return (
    <article
      className={cn(
        "relative min-w-0 overflow-hidden rounded-2xl border border-white/[0.08] p-5 md:p-6",
        theme.rail,
        theme.surface,
      )}
    >
      <div className={cn("pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b to-transparent", theme.topWash)} />
      <div className="relative">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className={cn("text-[10px] font-bold uppercase tracking-[0.18em]", theme.label)}>{name}</p>
            <p className="mt-1.5 font-mono text-[clamp(1.65rem,3.2vw,2.1rem)] font-semibold leading-[1.02] tracking-tight text-white tabular-nums">
              {money(dept?.trackingGross ?? null)}
            </p>
            <p className="mt-0.5 text-[12px] text-slate-400">Tracking gross</p>
          </div>
          {(() => {
            const health = departmentHealthFromPace(pace);
            return (
              <div className="flex shrink-0 flex-col items-end gap-2 sm:flex-row sm:items-center sm:gap-2.5">
                <span className={cn("font-mono text-[13px] font-semibold tabular-nums", paceTone(pace))} title="Pace to month">
                  {paceLabel}
                  <span className="ml-1 text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500">pace</span>
                </span>
                <span className={cn("rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em]", health.pill)}>
                  {health.label}
                </span>
              </div>
            );
          })()}
        </div>

        <div className="mt-4 border-t border-white/10 pt-4">
          <div className="w-full min-w-0 space-y-3 rounded-xl bg-black/30 p-3.5 ring-1 ring-inset ring-white/[0.06] md:p-4">
            <div>
              <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-slate-500">Actual</p>
              <p className="mt-1 break-words font-mono text-[15px] font-semibold leading-snug tabular-nums text-white md:text-[16px]">
                {money(dept?.actualGross ?? null)}
              </p>
            </div>
            <div className="grid grid-cols-1 gap-4 border-t border-white/[0.08] pt-3 sm:grid-cols-2 sm:gap-5 sm:pt-3.5">
              <div className="min-w-0">
                <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-slate-500">Target</p>
                <p className="mt-1 break-words font-mono text-[15px] font-semibold leading-snug tabular-nums text-white md:text-[16px]">
                  {money(dept?.targetGross ?? null)}
                </p>
              </div>
              <div className="min-w-0 border-t border-white/[0.08] pt-3 sm:border-t-0 sm:border-l sm:pl-5 sm:pt-0">
                <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-slate-500">Gap vs target</p>
                <p
                  className={cn(
                    "mt-1 font-mono text-[clamp(1.05rem,2.8vw,1.25rem)] font-semibold leading-snug tabular-nums",
                    gapTone(dept?.gapToTarget ?? null),
                  )}
                >
                  {signedMoney(dept?.gapToTarget ?? null)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

export type LiveDashboardLockedTopProps = {
  monthPeriodLabel: string;
  selectedMonthKey: string;
  onMonthChange: (key: string) => void;
  lastSyncedLabel: string;
  onRefresh: () => void;
  onOpenMeetingMode: () => void;
  unresolvedWarnings: string[];
  missingDepartmentMessages: string[];
  headline: string;
  totalGap: number | null;
  monthly: {
    totalTrackingGross: number | null;
    totalTargetGross: number | null;
    totalGapToTarget: number | null;
    totalPacePercent: number | null;
    daysUsed: number;
    daysAvailable: number;
  };
  deptCards: { dept: DepartmentGrossTracking | null | undefined; key: DeptKey }[];
};

export function LiveDashboardLockedTop({
  monthPeriodLabel,
  selectedMonthKey,
  onMonthChange,
  lastSyncedLabel,
  onRefresh,
  onOpenMeetingMode,
  unresolvedWarnings,
  missingDepartmentMessages,
  headline,
  totalGap,
  monthly,
  deptCards,
}: LiveDashboardLockedTopProps) {
  const totalPace = monthly.totalPacePercent;

  return (
    <div className="space-y-3 md:space-y-4">
      <ExecSection>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="velocity-metadata font-semibold uppercase tracking-[0.18em] text-slate-500">Sault Nissan</p>
            <h1 className="mt-1 text-[clamp(1.25rem,2vw,1.65rem)] font-semibold tracking-tight text-white">{monthPeriodLabel}</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <MonthSelector selectedMonthKey={selectedMonthKey} onChange={onMonthChange} />
            <div className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-[11px] font-medium text-slate-300">
              <Activity className="h-3 w-3 text-slate-500" aria-hidden />
              {lastSyncedLabel}
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-8 border-white/12 bg-white/[0.04] px-2 text-[11px] text-slate-200 hover:bg-white/[0.07]"
              onClick={onRefresh}
            >
              <RefreshCcw className="mr-1 h-3 w-3" />
              Refresh
            </Button>
            <Link
              href={`/dashboard/source-lineage?reportingMonth=${selectedMonthKey}`}
              className="inline-flex h-8 items-center rounded-lg border border-white/12 bg-white/[0.04] px-2 text-[11px] font-medium text-slate-200 hover:bg-white/[0.07]"
            >
              Lineage
            </Link>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 border-sky-400/25 bg-sky-500/10 px-2.5 text-[11px] font-medium text-sky-100 hover:bg-sky-500/[0.18]"
              onClick={onOpenMeetingMode}
            >
              <Presentation className="mr-1.5 h-3.5 w-3.5 shrink-0 opacity-90" aria-hidden />
              Meeting Mode
            </Button>
          </div>
        </div>
      </ExecSection>

      {unresolvedWarnings.length || missingDepartmentMessages.length ? (
        <ExecSection className="border-amber-500/20 bg-amber-950/20" padded>
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-amber-200/90">Data warnings</p>
          <div className="mt-1.5 space-y-1 text-[13px] leading-snug text-amber-50/95">
            {missingDepartmentMessages.map((message) => (
              <p key={message}>{message}</p>
            ))}
            {unresolvedWarnings.map((warning: string) => (
              <p key={warning}>{warning}</p>
            ))}
          </div>
        </ExecSection>
      ) : null}

      <ExecSection>
        <p className={cn("text-[clamp(1rem,1.75vw,1.2rem)] font-semibold leading-snug", gapTone(totalGap))}>{headline}</p>
        <p className="mt-2 font-mono text-[clamp(2rem,4.5vw,2.65rem)] font-semibold leading-[1.03] tracking-tight text-white tabular-nums">
          {money(monthly.totalTrackingGross)} projected gross
        </p>
        <div className="mt-4 grid gap-2 border-t border-white/10 pt-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Target", value: money(monthly.totalTargetGross), tone: "text-white" },
            { label: "Gap", value: signedMoney(monthly.totalGapToTarget), tone: gapTone(monthly.totalGapToTarget) },
            {
              label: "Pace %",
              value: totalPace === null || totalPace === undefined ? "—" : `${Math.round(totalPace)}%`,
              tone: paceTone(totalPace),
            },
            { label: "Days", value: `${monthly.daysUsed}/${monthly.daysAvailable}`, tone: "text-white" },
          ].map((item) => (
            <article
              key={item.label}
              className="rounded-lg border border-white/[0.06] bg-black/25 px-3 py-2.5 ring-1 ring-inset ring-white/[0.04]"
            >
              <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-slate-500">{item.label}</p>
              <p className={cn("mt-1 font-mono text-[clamp(1rem,1.9vw,1.25rem)] font-semibold tabular-nums leading-none", item.tone)}>
                {item.value}
              </p>
            </article>
          ))}
        </div>
      </ExecSection>

      <ExecSection>
        <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Department scorecards</p>
        <div className="grid gap-3 lg:grid-cols-3">
          {deptCards.map(({ dept, key }) => (
            <DepartmentCommandCard key={key} dept={dept} deptKey={key} />
          ))}
        </div>
      </ExecSection>
    </div>
  );
}
