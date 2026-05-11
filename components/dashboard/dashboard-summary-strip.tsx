"use client";

import useSWR from "swr";
import { formatDistanceToNowStrict } from "date-fns";
import { usePathname } from "next/navigation";

import { StatusPill } from "@/components/dashboard/status-pill";
import { cn } from "@/lib/utils";
import type { VelocityData } from "@/src/lib/velocity/get-velocity-data";

type StripPayload = VelocityData;

const fetcher = async (url: string): Promise<StripPayload> => {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Live summary unavailable");
  return res.json();
};

function moneyAbs(n: number) {
  return `$${Math.round(Math.abs(n)).toLocaleString()}`;
}

function signedShort(n: number) {
  if (n === 0) return "$0";
  const m = moneyAbs(n);
  return n > 0 ? `+${m}` : `−${m}`;
}

export function DashboardSummaryStrip() {
  const pathname = usePathname();
  const enabled = pathname?.startsWith("/dashboard") ?? false;

  const { data, error, isLoading, isValidating } = useSWR(enabled ? "/api/dashboard/live-summary-v2" : null, fetcher, {
    refreshInterval: 30000,
    revalidateOnFocus: true,
    dedupingInterval: 4000,
  });

  if (!enabled) return null;

  const ok = Boolean(data);
  const recoverable = data?.recoverableToday ?? 0;
  const freshness = data?.sourceHealth?.overallFreshness ?? "unknown";

  if (isLoading) {
    return (
      <div className="mt-2 border-t border-slate-200/80 pt-3">
        <div className="flex min-w-0 items-stretch overflow-x-auto rounded-lg border border-slate-200/70 bg-white">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="min-w-[180px] flex-1 space-y-2 border-r border-slate-200/70 px-3 py-2.5 last:border-r-0">
              <div className="h-2.5 w-20 rounded bg-slate-200/90" />
              <div className="h-9 w-full max-w-[170px] rounded-md bg-slate-200/80" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error || !ok) {
    return (
      <div className="mt-2 border-t border-[#9f1239]/20 pt-3 transition-opacity duration-200">
        <div className="flex items-center gap-2 rounded-lg border border-[#9f1239]/25 bg-[#fff1f2]/95 px-3 py-2 text-[12px] text-[#881337]">
          <span className="font-semibold">Command strip offline ·</span>
          {error instanceof Error ? error.message : "Enable live data for store-wide figures."}
        </div>
      </div>
    );
  }

  const trackingGross = data.currentProjection;
  const targetGross = data.targetProjection;
  const gap = data.gapToTarget;
  const paceLabel = gap >= 0 ? "Ahead of pace" : "Behind pace";
  const trust = data?.dataConfidence;
  const estimated = trust?.estimated;
  const estimateNote = trust?.estimationReason;

  return (
    <div
      className={cn(
        "mt-2 border-t border-slate-200/80 pt-3 transition-[box-shadow,opacity] duration-200",
        isValidating && "rounded-lg opacity-90 shadow-[inset_0_0_0_1px_rgba(245,158,11,0.35)]",
      )}
    >
      <div className="flex min-w-0 items-stretch overflow-x-auto rounded-lg border border-slate-200/70 bg-white">
        <div className="min-w-[220px] flex-1 border-r border-slate-200/70 px-3 py-2">
          <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">Tracking (Projected)</p>
          <p className="mt-1 font-mono text-[clamp(2rem,3vw,2.5rem)] font-bold leading-none tracking-tight text-slate-950 tabular-nums transition-all duration-200">
            {moneyAbs(trackingGross)}
          </p>
          <p className={cn("mt-1 text-[11px] font-semibold", gap >= 0 ? "text-emerald-700" : "text-[#e11d48]")}>
            Tracking: {moneyAbs(trackingGross)} vs Target: {moneyAbs(targetGross)} ({signedShort(gap)} {gap >= 0 ? "ahead" : "behind"})
          </p>
          <p className="mt-1 text-[10px] text-slate-600">Synced data from sales/service/parts parser pipeline.</p>
          <p className={cn("text-[10px] font-semibold", paceLabel === "Ahead of pace" ? "text-emerald-700" : "text-[#e11d48]")}>{paceLabel}</p>
        </div>
        <div className="min-w-[190px] flex-1 border-r border-slate-200/70 px-3 py-2">
          <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">Gap (Tracking - Target)</p>
          <p
            className={cn(
              "mt-1 font-mono text-[clamp(2rem,3vw,2.5rem)] font-bold tabular-nums leading-none transition-all duration-200",
              gap >= 0 ? "text-emerald-700" : "text-[#e11d48]",
            )}
          >
            {signedShort(gap)}{estimated ? " (est.)" : ""}
          </p>
          <p className="mt-1 text-[10px] text-slate-600">Target: {moneyAbs(targetGross)}</p>
        </div>
        <div className="min-w-[220px] flex-1 border-r border-slate-200/70 px-3 py-2">
          <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">Recoverable Today</p>
          <p
            className={cn(
              "mt-1 font-mono text-[clamp(2rem,3vw,2.5rem)] font-extrabold leading-none tabular-nums transition-all duration-200",
              recoverable > 0 ? "text-[#e11d48]" : "text-emerald-700",
            )}
          >
            {moneyAbs(recoverable)}{estimated ? " (est.)" : ""}
          </p>
        </div>
        <div className="min-w-[170px] flex-1 border-r border-slate-200/70 px-3 py-2">
          <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">Data Health</p>
          <div className="mt-1.5">
            <StatusPill
              variant={trust?.classification === "unreliable" ? "broken" : trust?.classification === "warning" ? "stale" : freshness === "fresh" ? "healthy" : freshness === "error" ? "broken" : "stale"}
              label={trust ? `${trust.score}% ${trust.label}` : undefined}
              pulse={isValidating}
            />
          </div>
        </div>
        <div className="min-w-[170px] flex-1 px-3 py-2 text-right">
          <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">Last Sync</p>
          <p className="mt-1 font-mono text-[12px] font-medium leading-none text-slate-600 tabular-nums">
            {data.lastSynced ? formatDistanceToNowStrict(new Date(data.lastSynced), { addSuffix: true }) : "—"}
          </p>
          {estimated && estimateNote ? <p className="mt-1 text-[10px] text-amber-700">{estimateNote}</p> : null}
        </div>
      </div>
      {data?.sourceHealth?.fallbackNotices?.length ? (
        <p className="mt-1.5 text-[11px] text-amber-700">{data.sourceHealth.fallbackNotices.join(" ")}</p>
      ) : null}
    </div>
  );
}
