"use client";

import Link from "next/link";
import { Fragment, useMemo, useState } from "react";
import useSWR from "swr";
import { format } from "date-fns";

import { MonthSelector } from "@/src/components/velocity/MonthSelector";
import type { VelocityData } from "@/src/lib/velocity/get-velocity-data";

type LiveSummaryResponse = VelocityData;

const fetcher = async (url: string): Promise<LiveSummaryResponse> => {
  const response = await fetch(url);
  if (!response.ok) {
    let details = "Source lineage unavailable.";
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

function monthKey(dt: Date) {
  return `${dt.getFullYear()}-${`${dt.getMonth() + 1}`.padStart(2, "0")}`;
}

function money(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "Needs Setup";
  return `$${Math.round(value).toLocaleString()}`;
}

function statusTone(status: "connected" | "excluded" | "error") {
  if (status === "connected") return "text-[#32D583]";
  if (status === "excluded") return "text-[#FFB547]";
  return "text-[#FF4D6D]";
}

function yesNo(value: boolean) {
  return value ? "Yes" : "No";
}

function signedMoney(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "Needs Setup";
  const abs = Math.round(Math.abs(value)).toLocaleString();
  return value >= 0 ? `+$${abs}` : `-$${abs}`;
}

const expectedTitleIncludes: Record<string, string> = {
  sales: "DAILY LOG",
  service: "Service DAILY TRACKING",
  parts: "Parts Daily Tracking",
  forecast: "Forecast",
};

export default function SourceLineagePage() {
  const baseDate = useMemo(() => new Date(), []);
  const [selectedMonthKey, setSelectedMonthKey] = useState(monthKey(baseDate));
  const { data, error, isLoading, mutate } = useSWR(`/api/dashboard/live-summary-v2?reportingMonth=${selectedMonthKey}`, fetcher, {
    refreshInterval: 45000,
    revalidateOnFocus: true,
    keepPreviousData: true,
  });

  if (isLoading) return <div className="px-6 py-8 text-sm text-slate-400">Loading source lineage...</div>;
  if (error || !data) {
    const message = error instanceof Error ? error.message : "Source lineage unavailable.";
    return (
      <div className="mx-auto mt-8 w-full max-w-[1160px] rounded-xl border border-red-500/30 bg-red-950/40 px-5 py-4 text-[14px] text-red-100">
        <p className="font-semibold">Source lineage unavailable</p>
        <p className="mt-1">{message}</p>
      </div>
    );
  }

  const monthly = data.monthlyGrossTracking;
  const departmentByName = new Map(monthly.departments.map((d) => [d.department.toLowerCase(), d]));

  return (
    <div className="mx-auto w-full max-w-[1160px] space-y-5 px-5 pb-16 pt-5 md:px-8">
      <section className="rounded-3xl bg-[linear-gradient(165deg,rgba(168,85,247,0.20),rgba(255,255,255,0.02)_40%),#121826] px-7 py-7 shadow-[0_34px_80px_-42px_rgba(0,0,0,0.95)]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="velocity-metadata font-semibold uppercase tracking-[0.22em] text-[#A855F7]">Sault Nissan</p>
            <h1 className="exec-section-title mt-1 text-white">Source Lineage Audit</h1>
            <p className="mt-2 text-sm text-[#A1A1AA]">Selected month: {format(new Date(monthly.year, monthly.month - 1, 1), "MMMM yyyy")}</p>
          </div>
          <div className="flex items-center gap-2">
            <MonthSelector selectedMonthKey={selectedMonthKey} onChange={setSelectedMonthKey} />
            <button
              type="button"
              onClick={() => mutate()}
              className="inline-flex h-8 items-center rounded-md border border-white/10 bg-[rgba(255,255,255,0.04)] px-2.5 text-[12px] font-medium text-slate-200 hover:bg-[#161B2E]"
            >
              Refresh
            </button>
            <Link href="/dashboard" className="inline-flex h-8 items-center rounded-md border border-white/10 bg-[rgba(255,255,255,0.04)] px-2.5 text-[12px] font-medium text-slate-200 hover:bg-[#161B2E]">
              Back to Dashboard
            </Link>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl bg-[linear-gradient(165deg,rgba(168,85,247,0.10),rgba(255,255,255,0.01)_42%),#161B2E] shadow-[0_24px_54px_-34px_rgba(0,0,0,0.92)]">
        <div className="border-b border-white/10 bg-[rgba(255,255,255,0.03)] px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#A1A1AA]">Environment / Source Verification</p>
          <div className="mt-2 grid gap-2 md:grid-cols-2">
            {data.sourceLineage.map((line) => {
              const expected = expectedTitleIncludes[line.source];
              const title = line.sheetTitle ?? "";
              const matchesExpected = title.toLowerCase().includes(expected.toLowerCase());
              const url = `https://docs.google.com/spreadsheets/d/${line.sourceSheetId}`;
              return (
                <div key={`verify-${line.source}`} className="rounded-lg bg-[rgba(255,255,255,0.04)] px-3 py-2 text-[12px]">
                  <p className="font-semibold text-white">{line.source.toUpperCase()}</p>
                  <p className="text-[#CBD5E1]">SHEET_ID (.env.local): <span className="font-mono text-white">{line.sourceSheetId}</span></p>
                  <p className="text-[#CBD5E1]">
                    Expected URL:{" "}
                    <a className="font-mono text-[#C4B5FD] underline underline-offset-2" href={url} target="_blank" rel="noreferrer">
                      {url}
                    </a>
                  </p>
                  <p className="text-[#CBD5E1]">Resolved title: <span className="font-mono text-white">{line.sheetTitle ?? "Unknown"}</span></p>
                  <p className="text-[#CBD5E1]">Selected tab: <span className="font-mono text-white">{line.matchedMonthTab ?? "none"}</span></p>
                  <p className="text-[#CBD5E1]">Rows: <span className="font-mono text-white">{line.rowsFetched}</span></p>
                  {!matchesExpected ? (
                    <p className="mt-1 text-[#FF9AAE]">
                      Warning: sheet title mismatch. Expected to include "{expected}".
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1280px] border-collapse text-left text-[12px] text-[#CBD5E1]">
            <thead className="bg-[rgba(255,255,255,0.04)] text-[11px] uppercase tracking-[0.12em] text-[#A1A1AA]">
              <tr>
                <th className="px-3 py-2">Source</th>
                <th className="px-3 py-2">Sheet ID</th>
                <th className="px-3 py-2">Selected Month</th>
                <th className="px-3 py-2">Matched Tab</th>
                <th className="px-3 py-2">Normalized Tab Key</th>
                <th className="px-3 py-2">Included?</th>
                <th className="px-3 py-2">Rows</th>
                <th className="px-3 py-2">Actual Gross</th>
                <th className="px-3 py-2">Target Gross</th>
                <th className="px-3 py-2">Tracking Gross</th>
                <th className="px-3 py-2">Warnings</th>
              </tr>
            </thead>
            <tbody>
              {data.sourceLineage.map((line) => {
                const department = departmentByName.get(line.source);
                const actualGross = line.source === "forecast" ? monthly.totalActualGross : (department?.actualGross ?? null);
                const targetGross = line.source === "forecast" ? monthly.totalTargetGross : (department?.targetGross ?? null);
                const trackingGross = line.source === "forecast" ? monthly.totalTrackingGross : (department?.trackingGross ?? null);
                const warnings = [...line.warnings];
                if (line.exclusionReason) warnings.unshift(line.exclusionReason);
                const wrongYearBug =
                  (line.source === "service" || line.source === "parts") &&
                  Boolean(line.matchedMonthTab) &&
                  Boolean(line.normalizedMatchedMonth) &&
                  line.normalizedMatchedMonth !== line.selectedMonth;
                return (
                  <Fragment key={line.source}>
                    <tr className="border-t border-white/5 align-top">
                      <td className="px-3 py-2">
                        <p className="font-semibold text-white">{line.source.toUpperCase()}</p>
                        <p className={`text-[11px] ${statusTone(line.connectionStatus)}`}>{line.connectionStatus}</p>
                      </td>
                      <td className="px-3 py-2 font-mono text-white">{line.sourceSheetId}</td>
                      <td className="px-3 py-2 font-mono text-white">{line.selectedMonth}</td>
                      <td className="px-3 py-2 font-mono text-white">{line.matchedMonthTab ?? "none"}</td>
                      <td className="px-3 py-2 font-mono text-white">{line.normalizedMatchedMonth ?? "none"}</td>
                      <td className="px-3 py-2">
                        <span className={line.excluded ? "text-[#FF4D6D]" : "text-[#32D583]"}>{yesNo(!line.excluded)}</span>
                      </td>
                      <td className="px-3 py-2 font-mono text-white">{line.rowsFetched}</td>
                      <td className="px-3 py-2 font-mono text-white">{money(actualGross)}</td>
                      <td className="px-3 py-2 font-mono text-white">{money(targetGross)}</td>
                      <td className="px-3 py-2 font-mono text-white">{money(trackingGross)}</td>
                      <td className="px-3 py-2">
                        {wrongYearBug ? (
                          <p className="text-[#FF4D6D]">BUG: wrong-year tab matched. Resolver must reject this.</p>
                        ) : warnings.length ? (
                          <p className="text-[#FDE68A]">{warnings[0]}</p>
                        ) : (
                          <p className="text-[#32D583]">none</p>
                        )}
                      </td>
                    </tr>
                    <tr className="border-t border-white/5">
                      <td colSpan={11} className="px-3 py-2">
                        <details>
                          <summary className="cursor-pointer text-[11px] uppercase tracking-[0.12em] text-[#A1A1AA]">
                            Available Tabs ({line.availableTabNames.length}) and Attempted Names
                          </summary>
                          <div className="mt-2 grid gap-2 md:grid-cols-2">
                            <p className="font-mono text-[11px] text-[#CBD5E1]">
                              Attempted: {line.attemptedTabNames.length ? line.attemptedTabNames.join(", ") : "none"}
                            </p>
                            <p className="font-mono text-[11px] text-[#CBD5E1]">
                              Available: {line.availableTabNames.length ? line.availableTabNames.join(", ") : "none"}
                            </p>
                          </div>
                        </details>
                      </td>
                    </tr>
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl bg-[linear-gradient(165deg,rgba(168,85,247,0.08),rgba(255,255,255,0.01)_42%),#161B2E] px-4 py-4 shadow-[0_24px_54px_-34px_rgba(0,0,0,0.92)]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#A1A1AA]">Monthly Reconciliation</p>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          {monthly.departments.map((dept) => (
            <div key={`recon-${dept.department}`} className="rounded-lg bg-[rgba(255,255,255,0.04)] px-3 py-3 text-[12px]">
              <p className="font-semibold text-white">{dept.department}</p>
              <p className="mt-1 text-[#CBD5E1]">Actual: <span className="font-mono text-white">{money(dept.actualGross)}</span></p>
              <p className="text-[#CBD5E1]">Tracking: <span className="font-mono text-white">{money(dept.trackingGross)}</span></p>
              <p className="text-[#CBD5E1]">Target: <span className="font-mono text-white">{money(dept.targetGross)}</span></p>
              <p className={dept.gapToTarget !== null && dept.gapToTarget >= 0 ? "text-[#86EFAC]" : "text-[#FCA5A5]"}>
                Gap: <span className="font-mono">{signedMoney(dept.gapToTarget)}</span>
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

