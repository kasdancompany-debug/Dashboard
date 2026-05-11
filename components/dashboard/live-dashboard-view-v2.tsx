"use client";

import { useCallback, useMemo, useState, type ReactNode } from "react";
import useSWR from "swr";
import { format } from "date-fns";
import { Activity, Presentation, RefreshCcw } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MeetingModeOverlay, type MeetingModePayload } from "@/components/dashboard/meeting-mode-overlay";
import { MonthSelector } from "@/src/components/velocity/MonthSelector";
import type { VelocityData } from "@/src/lib/velocity/get-velocity-data";
import type { DepartmentGrossTracking, MonthlyGrossDepartment } from "@/src/lib/velocity/monthly-gross/types";

type LiveSummaryResponse = VelocityData;

const fetcher = async (url: string): Promise<LiveSummaryResponse> => {
  const response = await fetch(url);
  if (!response.ok) {
    let details = "Live summary unavailable.";
    try {
      const body = (await response.json()) as { error?: string };
      if (body?.error) details = body.error;
    } catch {
      // Ignore JSON parse errors and keep fallback message.
    }
    throw new Error(details);
  }
  return response.json();
};

function money(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "Needs Setup";
  return `$${Math.round(value).toLocaleString()}`;
}

function signedMoney(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "Needs Setup";
  const abs = `$${Math.round(Math.abs(value)).toLocaleString()}`;
  return value >= 0 ? `+${abs}` : `-${abs}`;
}

function gapTone(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "text-[#A1A1AA]";
  return value >= 0 ? "text-[#34D399]" : "text-[#FB7185]";
}

function paceTone(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "text-[#A1A1AA]";
  if (value < 95) return "text-[#FBBF24]";
  return "text-[#34D399]";
}

function departmentHealthFromPace(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return { label: "Needs Setup", tone: "text-[#A1A1AA]", pill: "bg-white/10 text-[#CBD5E1]" };
  }
  if (value >= 100) {
    return { label: "Ahead", tone: "text-[#34D399]", pill: "bg-emerald-500/20 text-emerald-100 ring-1 ring-emerald-400/25" };
  }
  if (value >= 90) {
    return { label: "Watch", tone: "text-[#FBBF24]", pill: "bg-amber-500/20 text-amber-100 ring-1 ring-amber-400/30" };
  }
  return { label: "At Risk", tone: "text-[#FB7185]", pill: "bg-rose-500/20 text-rose-100 ring-1 ring-rose-400/25" };
}

type DeptKey = "Sales" | "Service" | "Parts";

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

function deptLineSignalTheme(department: MonthlyGrossDepartment | undefined): {
  rail: string;
  surface: string;
} {
  if (department === "Sales") {
    return {
      rail: "border-l-[4px] border-l-emerald-500/85",
      surface: "bg-emerald-950/20",
    };
  }
  if (department === "Service") {
    return {
      rail: "border-l-[4px] border-l-amber-500/85",
      surface: "bg-amber-950/20",
    };
  }
  if (department === "Parts") {
    return {
      rail: "border-l-[4px] border-l-rose-500/85",
      surface: "bg-rose-950/25",
    };
  }
  return { rail: "border-l-[4px] border-l-slate-600", surface: "bg-slate-950/30" };
}

const SECTION_SHELL =
  "rounded-3xl border border-white/[0.07] bg-[linear-gradient(165deg,rgba(255,255,255,0.04)_0%,rgba(255,255,255,0.015)_40%,rgba(15,23,42,0.96)_100%)] shadow-[0_20px_50px_-36px_rgba(0,0,0,0.65)]";

function ExecSection({
  children,
  className,
  padded = true,
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return <div className={cn(SECTION_SHELL, padded && "p-5 md:p-6", className)}>{children}</div>;
}

function SectionHeader({ kicker, title, subtitle }: { kicker?: string; title: string; subtitle?: string }) {
  return (
    <header className="mb-4 max-w-4xl border-b border-white/10 pb-3">
      {kicker ? <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">{kicker}</p> : null}
      <h2 className="mt-0.5 text-[clamp(1rem,1.5vw,1.2rem)] font-semibold tracking-tight text-white">{title}</h2>
      {subtitle ? <p className="mt-1 text-[13px] leading-snug text-slate-400">{subtitle}</p> : null}
    </header>
  );
}

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

type SignalDot = "ok" | "warn" | "bad" | "neutral";

function OperationalSignalsList({ items }: { items: { text: string; dot: SignalDot }[] }) {
  if (!items.length) {
    return <p className="text-[13px] text-slate-500">No signals from current month data.</p>;
  }
  const dotClass: Record<SignalDot, string> = {
    ok: "bg-emerald-400/70",
    warn: "bg-amber-400/70",
    bad: "bg-rose-400/75",
    neutral: "bg-slate-500/70",
  };
  return (
    <ul className="space-y-2">
      {items.map((item, i) => (
        <li key={`${i}-${item.text}`} className="flex items-baseline gap-2.5 text-[13px] leading-snug text-slate-200">
          <span className={cn("mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full", dotClass[item.dot])} aria-hidden />
          <span>{item.text}</span>
        </li>
      ))}
    </ul>
  );
}

function monthKey(dt: Date) {
  return `${dt.getFullYear()}-${`${dt.getMonth() + 1}`.padStart(2, "0")}`;
}

export function LiveDashboardViewV2() {
  const baseDate = useMemo(() => new Date(), []);
  const [selectedMonthKey, setSelectedMonthKey] = useState(monthKey(baseDate));
  const [expandedInsights, setExpandedInsights] = useState(false);
  const [meetingModeOpen, setMeetingModeOpen] = useState(false);
  const closeMeetingMode = useCallback(() => setMeetingModeOpen(false), []);
  const { data, error, isLoading, mutate } = useSWR(`/api/dashboard/live-summary-v2?reportingMonth=${selectedMonthKey}`, fetcher, {
    refreshInterval: 45000,
    revalidateOnFocus: true,
    keepPreviousData: true,
  });

  if (isLoading) return <div className="px-6 py-8 text-sm text-slate-400">Loading gross tracking...</div>;
  if (error || !data) {
    const message = error instanceof Error ? error.message : "Live data unavailable.";
    return (
      <div className="mx-auto mt-8 w-full max-w-[1024px] rounded-xl border border-red-500/30 bg-red-950/40 px-5 py-4 text-[14px] text-red-100">
        <p className="font-semibold">Live data unavailable</p>
        <p className="mt-1">{message}</p>
        <p className="mt-2 text-red-200/90">Open Source Lineage to verify month-tab setup and parser warnings.</p>
      </div>
    );
  }

  const monthly = data.monthlyGrossTracking;
  const monthPeriodLabel = format(new Date(monthly.year, monthly.month - 1, 1), "MMMM yyyy");
  const unresolvedWarnings = data.sourceHealth.staleDataWarnings;
  const selectedMonthLabel = format(new Date(monthly.year, monthly.month - 1, 1), "MMMM");
  const sales = monthly.departments.find((d) => d.department === "Sales");
  const service = monthly.departments.find((d) => d.department === "Service");
  const parts = monthly.departments.find((d) => d.department === "Parts");
  const salesLineage = data.sourceLineage.find((line) => line.source === "sales");
  const salesRawTracking =
    typeof salesLineage?.rawParsedTotals?.trackingGross === "number" ? salesLineage.rawParsedTotals.trackingGross : null;
  const salesRawActual =
    typeof salesLineage?.rawParsedTotals?.totalGross === "number" ? salesLineage.rawParsedTotals.totalGross : null;
  const salesRawTarget =
    typeof salesLineage?.rawParsedTotals?.targetGross === "number" ? salesLineage.rawParsedTotals.targetGross : null;
  const salesDisplay = sales
    ? {
        ...sales,
        actualGross: sales.actualGross > 0 ? sales.actualGross : (salesRawActual ?? sales.actualGross),
        trackingGross: sales.trackingGross !== null && sales.trackingGross > 0 ? sales.trackingGross : (salesRawTracking ?? sales.trackingGross),
        targetGross: sales.targetGross > 0 ? sales.targetGross : (salesRawTarget ?? sales.targetGross),
      }
    : sales;
  const best = monthly.bestTrackingLine;
  const worst = monthly.worstTrackingLine;
  const partsCustomerLine = parts?.lines.find((line) => /customer gross/i.test(line.label)) ?? null;
  const partsWholesaleLine = parts?.lines.find((line) => /wholesale gross/i.test(line.label)) ?? null;
  const totalGap = monthly.totalGapToTarget;
  const totalPace = monthly.totalPacePercent;
  const headline =
    totalGap === null || !Number.isFinite(totalGap)
      ? `${selectedMonthLabel} gross needs setup`
      : `${selectedMonthLabel} gross is tracking ${money(Math.abs(totalGap))} ${totalGap < 0 ? "behind" : "ahead of"} target`;
  const missingDepartmentMessages = data.sourceLineage
    .filter((line) => ["sales", "service", "parts"].includes(line.source) && line.excluded)
    .map((line) => `${selectedMonthLabel} data not available yet for ${line.source[0].toUpperCase()}${line.source.slice(1)}.`);
  const departmentByName = new Map(monthly.departments.map((d) => [d.department.toLowerCase(), d]));
  const rankedDepartments = monthly.departments
    .filter((dept) => dept.gapToTarget !== null)
    .slice()
    .sort((a, b) => (b.gapToTarget ?? 0) - (a.gapToTarget ?? 0));
  const bestDepartmentTotal = rankedDepartments[0] ?? null;
  const worstDepartmentTotal = rankedDepartments.length ? rankedDepartments[rankedDepartments.length - 1] : null;

  const operationalSignals = (() => {
    const pool: { text: string; dot: SignalDot }[] = [];

    if (totalGap !== null && Number.isFinite(totalGap)) {
      pool.push({ text: `Total gross ${signedMoney(totalGap)} vs target`, dot: totalGap >= 0 ? "ok" : "bad" });
    }
    if (partsCustomerLine && (partsCustomerLine.gapToTarget ?? 0) < 0) {
      pool.push({ text: "Customer-pay gross below target", dot: "warn" });
    }
    if (partsWholesaleLine && (partsWholesaleLine.gapToTarget ?? 0) < 0) {
      pool.push({ text: "Wholesale gross below target", dot: "warn" });
    }
    if (service?.pacePercent !== null && service?.pacePercent !== undefined && Number.isFinite(service.pacePercent) && service.pacePercent < 85) {
      pool.push({ text: `Service under 85% pace (${Math.round(service.pacePercent)}%)`, dot: "warn" });
    }

    const seen = new Set<string>();
    const out: { text: string; dot: SignalDot }[] = [];
    for (const row of pool) {
      if (out.length >= 5) break;
      if (seen.has(row.text)) continue;
      seen.add(row.text);
      out.push(row);
    }
    return out;
  })();

  const meetingPayload: MeetingModePayload = {
    monthTitle: monthPeriodLabel,
    lastSyncedLabel: `Live · ${format(new Date(data.lastSynced), "h:mm a")}`,
    monthly,
    salesDisplay,
    service,
    parts,
    worst,
    best,
    bestDepartmentTotal,
    worstDepartmentTotal,
    operationalSignals,
    totalPace,
  };

  const deptCards: { dept: typeof salesDisplay; key: DeptKey }[] = [
    { dept: salesDisplay, key: "Sales" },
    { dept: service, key: "Service" },
    { dept: parts, key: "Parts" },
  ];

  return (
    <div className="relative z-0 text-slate-100">
      <div className="mx-auto w-full max-w-[1080px] space-y-3 px-4 pb-10 pt-4 md:space-y-4 md:px-6 md:pt-5">
      <ExecSection>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="velocity-metadata font-semibold uppercase tracking-[0.18em] text-slate-500">Sault Nissan</p>
            <h1 className="mt-1 text-[clamp(1.25rem,2vw,1.65rem)] font-semibold tracking-tight text-white">{monthPeriodLabel}</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <MonthSelector selectedMonthKey={selectedMonthKey} onChange={setSelectedMonthKey} />
            <div className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-[11px] font-medium text-slate-300">
              <Activity className="h-3 w-3 text-slate-500" aria-hidden />
              {`Live · ${format(new Date(data.lastSynced), "h:mm a")}`}
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-8 border-white/12 bg-white/[0.04] px-2 text-[11px] text-slate-200 hover:bg-white/[0.07]"
              onClick={() => mutate()}
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
              onClick={() => setMeetingModeOpen(true)}
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

      <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-center">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 border-white/15 bg-white/[0.05] text-[12px] font-medium text-slate-200 hover:bg-white/[0.08]"
          aria-expanded={expandedInsights}
          onClick={() => setExpandedInsights((v) => !v)}
        >
          {expandedInsights ? "Hide Expanded Insights" : "Show Expanded Insights"}
        </Button>
      </div>

      {expandedInsights ? (
        <div className="space-y-3 border-t border-white/10 pt-3">
          <ExecSection>
            <SectionHeader
              title="Expanded insights"
              subtitle="Line gaps, department totals, and short signals when you need another pass."
            />
            <div className="grid gap-3 lg:grid-cols-2">
              <article
                className={cn(
                  "rounded-xl border border-white/[0.07] p-4 ring-1 ring-inset ring-white/[0.04]",
                  worst ? deptLineSignalTheme(worst.department).rail : "",
                  worst ? deptLineSignalTheme(worst.department).surface : "bg-black/20",
                )}
              >
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-rose-200/90">Biggest problem area</p>
                <p className="mt-2 text-[15px] font-semibold text-white">
                  {worst ? `${worst.department} · ${worst.label}` : "Needs Setup"}
                </p>
                <p className="mt-1 text-[16px] font-semibold text-rose-300">
                  {worst?.gapToTarget === null || worst?.gapToTarget === undefined
                    ? "Needs Setup"
                    : `-${money(Math.abs(worst.gapToTarget))} vs target`}
                </p>
              </article>
              <article
                className={cn(
                  "rounded-xl border border-white/[0.07] p-4 ring-1 ring-inset ring-white/[0.04]",
                  best ? deptLineSignalTheme(best.department).rail : "",
                  best ? deptLineSignalTheme(best.department).surface : "bg-black/20",
                )}
              >
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-200/90">Strongest area</p>
                <p className="mt-2 text-[15px] font-semibold text-white">
                  {best ? `${best.department} · ${best.label}` : "Needs Setup"}
                </p>
                <p className="mt-1 text-[16px] font-semibold text-emerald-300">
                  {best?.gapToTarget === null || best?.gapToTarget === undefined
                    ? "Needs Setup"
                    : `+${money(Math.abs(best.gapToTarget))} vs target`}
                </p>
              </article>
              <article
                className={cn(
                  "rounded-xl border border-white/[0.07] p-4 ring-1 ring-inset ring-white/[0.04]",
                  worstDepartmentTotal ? deptLineSignalTheme(worstDepartmentTotal.department).rail : "",
                  worstDepartmentTotal ? deptLineSignalTheme(worstDepartmentTotal.department).surface : "bg-black/20",
                )}
              >
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">Department gap</p>
                <p className="mt-2 text-[15px] font-semibold text-white">
                  {worstDepartmentTotal ? worstDepartmentTotal.department : "Needs Setup"}
                </p>
                <p className={cn("mt-1 text-[16px] font-semibold", gapTone(worstDepartmentTotal?.gapToTarget ?? null))}>
                  {worstDepartmentTotal?.gapToTarget === null || worstDepartmentTotal?.gapToTarget === undefined
                    ? "Needs Setup"
                    : `${signedMoney(worstDepartmentTotal.gapToTarget)} vs target`}
                </p>
              </article>
              <article
                className={cn(
                  "rounded-xl border border-white/[0.07] p-4 ring-1 ring-inset ring-white/[0.04]",
                  bestDepartmentTotal ? deptLineSignalTheme(bestDepartmentTotal.department).rail : "",
                  bestDepartmentTotal ? deptLineSignalTheme(bestDepartmentTotal.department).surface : "bg-black/20",
                )}
              >
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">Top department</p>
                <p className="mt-2 text-[15px] font-semibold text-white">
                  {bestDepartmentTotal ? bestDepartmentTotal.department : "Needs Setup"}
                </p>
                <p className={cn("mt-1 text-[16px] font-semibold", gapTone(bestDepartmentTotal?.gapToTarget ?? null))}>
                  {bestDepartmentTotal?.gapToTarget === null || bestDepartmentTotal?.gapToTarget === undefined
                    ? "Needs Setup"
                    : `${signedMoney(bestDepartmentTotal.gapToTarget)} vs target`}
                </p>
              </article>
            </div>
            <div className="mt-6 border-t border-white/10 pt-5">
              <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">{"Today's signals"}</p>
              <OperationalSignalsList items={operationalSignals} />
            </div>
          </ExecSection>

          <ExecSection className="bg-black/25" padded>
            <details>
              <summary className="cursor-pointer text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500 hover:text-slate-300">
                Source lineage (technical)
              </summary>
              <div className="mt-3 space-y-2 text-[11px] text-slate-400">
                {data.sourceLineage.map((line) => {
                  const department = departmentByName.get(line.source);
                  return (
                    <div key={line.source} className="rounded-lg border border-white/10 bg-white/[0.03] p-2.5">
                      <p className="font-semibold text-slate-200">{line.source.toUpperCase()}</p>
                      <p>Tab: {line.resolvedTabName ?? "Unknown"}</p>
                      <p>Range: {line.resolvedRange}</p>
                      <p>
                        Actual {money(department?.actualGross ?? 0)} · Tracking {money(department?.trackingGross ?? 0)} · Target{" "}
                        {money(department?.targetGross ?? 0)}
                      </p>
                      <p className={line.excluded ? "text-rose-300" : "text-emerald-300/90"}>
                        {line.excluded ? line.exclusionReason : "Included."}
                      </p>
                      {line.warnings.map((warning: string) => (
                        <p key={warning} className="text-amber-200/90">
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
      ) : null}
      </div>
      {meetingModeOpen ? (
        <MeetingModeOverlay
          key={`meeting-${selectedMonthKey}`}
          open
          onClose={closeMeetingMode}
          payload={meetingPayload}
        />
      ) : null}
    </div>
  );
}
