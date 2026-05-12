"use client";

import useSWR from "swr";
import { formatDistanceToNowStrict } from "date-fns";

import { Skeleton } from "@/components/ui/skeleton";
import type { VelocityData } from "@/src/lib/velocity/get-velocity-data";
import type { SourceHealth } from "@/src/lib/velocity/engine/types";

type LiveSummaryWithHealth = VelocityData;
type SourceDeptRow = SourceHealth["departments"][number];

const fetcher = async (url: string): Promise<LiveSummaryWithHealth> => {
  const response = await fetch(url);
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? "Unable to load source health.");
  }
  return response.json();
};

export function SourceHealthPanel() {
  const { data, error, isLoading, isValidating } = useSWR("/api/dashboard/live-summary-v2", fetcher, {
    refreshInterval: 30000,
    revalidateOnFocus: true,
    dedupingInterval: 5000,
  });

  if (isLoading) {
    return (
      <section className="mb-5 rounded-xl border border-slate-200/90 bg-white p-4 shadow-[0_1px_0_rgba(15,23,42,0.04)]" aria-busy="true">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Skeleton className="h-4 w-40 rounded bg-slate-200/90" />
          <Skeleton className="h-7 w-24 rounded-full bg-slate-200/80" />
        </div>
        <Skeleton className="mt-3 h-3 w-full max-w-xl rounded bg-slate-100" />
      </section>
    );
  }

  if (error || !data?.sourceHealth) {
    return (
      <section
        id="source-health-detail"
        className="mb-5 rounded-xl border border-amber-300/60 bg-amber-50/95 px-4 py-3 text-[13px] text-amber-950 shadow-[0_1px_0_rgba(15,23,42,0.04)]"
      >
        <p className="font-semibold">Source health unavailable</p>
        <p className="mt-1 text-amber-900/90">
          {error instanceof Error ? error.message : "Enable live Google Sheets mode to audit workbook tabs, sync time, and month alignment."}
        </p>
      </section>
    );
  }

  const health = data.sourceHealth;
  const trust = data.dataConfidence;
  const lastLabel = data.lastSynced ? formatDistanceToNowStrict(new Date(data.lastSynced), { addSuffix: true }) : "";
  const mismatches = health.departments.filter(
    (d: SourceDeptRow) => d.freshnessStatus !== "fresh" || !d.monthAligned,
  );
  const dataState: "trusted" | "watch" | "broken" =
    trust?.classification === "unreliable"
      ? "broken"
      : trust?.classification === "warning"
        ? "watch"
        : health.overallFreshness === "error"
          ? "broken"
          : health.overallFreshness === "stale" || health.overallFreshness === "unknown"
            ? "watch"
            : "trusted";
  const executiveExplanation =
    dataState === "trusted"
      ? ""
      : trust?.estimationReason ??
        health.staleDataWarnings[0] ??
        (mismatches.length > 0
          ? `${mismatches.map((m: SourceDeptRow) => m.department[0].toUpperCase() + m.department.slice(1)).join(" and ")} sources appear out of sync with reporting month.`
          : "One or more source checks failed.");
  const badgeClass =
    dataState === "trusted"
      ? "border-emerald-300/80 bg-emerald-50 text-emerald-900"
      : dataState === "watch"
        ? "border-amber-300/80 bg-amber-50 text-amber-950"
        : "border-[#e11d48]/30 bg-[#fff1f2] text-[#9f1239]";
  const badgeLabel = dataState === "trusted" ? "Data: Trusted" : dataState === "watch" ? "Data: Watch" : "Data: Broken";

  return (
    <section
      id="source-health-detail"
      className={`mb-5 rounded-xl border border-slate-200/90 bg-white shadow-[0_1px_0_rgba(15,23,42,0.04)] transition-shadow duration-200 ${isValidating ? "ring-1 ring-amber-400/40" : ""}`}
    >
      <details className="group">
        <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 px-4 py-3 outline-none marker:content-none [&::-webkit-details-marker]:hidden">
          <div className="flex min-w-0 items-center gap-2">
            <span className={`inline-flex items-center rounded-md border px-2 py-1 text-[11px] font-bold ${badgeClass}`}>{badgeLabel}</span>
            {dataState !== "trusted" ? (
              <p className="truncate text-[12px] text-slate-700">
                — {executiveExplanation}
              </p>
            ) : null}
          </div>
          <p className="text-[11px] font-medium tabular-nums text-slate-600">
            Synced <span className="text-slate-900">{lastLabel}</span>
            <span className="ml-2 text-slate-500">{dataState === "trusted" ? "" : "Details"}</span>
          </p>
        </summary>

        {dataState !== "trusted" ? <div className="border-t border-slate-100/90 px-4 py-3">
          <div className="mb-2">
            <h2 className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Source lineage</h2>
            <p className="mt-1 text-[12px] text-slate-700">
              Reporting <span className="font-semibold">{health.reportingMonthLabel}</span>
              {health.reportingMonth ? <span className="ml-1 font-mono text-[11px] text-slate-500">({health.reportingMonth})</span> : null}
            </p>
            {health.fallbackNotices?.length ? <p className="mt-1 text-[12px] text-amber-700">{health.fallbackNotices.join(" ")}</p> : null}
          </div>

          {health.staleDataWarnings.length > 0 ? (
            <div className="rounded-md border border-amber-200/80 bg-amber-50/90 px-3 py-2">
              <p className="text-[10px] font-bold uppercase tracking-wide text-amber-950">Warnings</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[12px] text-amber-900">
                {health.staleDataWarnings.map((w: string) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Sheet mismatches</p>
              {mismatches.length > 0 ? (
                <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[12px] text-slate-700">
                  {mismatches.slice(0, 6).map((d: SourceDeptRow) => (
                    <li key={d.department}>
                      <span className="font-semibold capitalize">{d.department}</span>: {d.sheetTab ?? "tab unknown"}
                      {d.extractedSheetMonthKey ? ` (${d.extractedSheetMonthKey})` : ""}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-[12px] text-slate-600">No mismatches detected.</p>
              )}
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Connections</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[12px] text-slate-700">
                {health.departments.map((d: SourceDeptRow) => (
                  <li key={`${d.department}-conn`}>
                    <span className="font-semibold capitalize">{d.department}</span>: {d.workbookTitle ?? "Workbook"} / {d.sheetTab ?? "Tab"}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {trust?.estimated && trust.estimationReason ? (
            <div className="mt-3 rounded-md border border-slate-200/80 bg-slate-50/80 px-3 py-2">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-600">Data health issues</p>
              <p className="mt-1 text-[12px] text-slate-700">{trust.estimationReason}</p>
            </div>
          ) : null}
        </div> : null}
      </details>
    </section>
  );
}
