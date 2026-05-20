"use client";

import { useCallback, useMemo, useState } from "react";
import useSWR from "swr";
import { format } from "date-fns";

import { Button } from "@/components/ui/button";
import { MeetingModeOverlay, type MeetingModePayload } from "@/components/dashboard/meeting-mode-overlay";
import { LiveDashboardExpandedInsights } from "@/components/dashboard/live-dashboard-expanded-insights";
import { LiveDashboardLockedTop, type DeptKey } from "@/components/dashboard/live-dashboard-locked-top";
import { money } from "@/components/dashboard/live-dashboard-shared";
import { buildSinceYesterdayRow } from "@/src/lib/dashboard/since-yesterday";
import type { VelocityData } from "@/src/lib/velocity/get-velocity-data";
import type { DepartmentGrossTracking } from "@/src/lib/velocity/monthly-gross/types";

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

type SignalDot = "ok" | "warn" | "bad" | "neutral";

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
      const abs = `$${Math.round(Math.abs(totalGap)).toLocaleString()}`;
      const signed = totalGap >= 0 ? `+${abs}` : `-${abs}`;
      pool.push({ text: `Total gross ${signed} vs target`, dot: totalGap >= 0 ? "ok" : "bad" });
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

  const deptCards: { dept: DepartmentGrossTracking | null | undefined; key: DeptKey }[] = [
    { dept: salesDisplay, key: "Sales" },
    { dept: service, key: "Service" },
    { dept: parts, key: "Parts" },
  ];

  const lastSyncedLabel = `Live · ${format(new Date(data.lastSynced), "h:mm a")}`;

  const sinceYesterday = buildSinceYesterdayRow(
    {
      reportingMonthKey: selectedMonthKey,
      daysUsed: monthly.daysUsed,
      totalTrackingGross: monthly.totalTrackingGross,
      totalPacePercent: monthly.totalPacePercent,
      departments: monthly.departments,
    },
    data.sinceYesterdaySnapshot ?? null,
  );

  return (
    <div className="relative z-0 text-slate-100">
      <div className="mx-auto w-full max-w-[1080px] space-y-4 px-4 pb-24 pt-4 md:px-6 md:pt-5">
        <LiveDashboardLockedTop
          monthPeriodLabel={monthPeriodLabel}
          selectedMonthKey={selectedMonthKey}
          onMonthChange={setSelectedMonthKey}
          lastSyncedLabel={lastSyncedLabel}
          onRefresh={() => void mutate()}
          onOpenMeetingMode={() => setMeetingModeOpen(true)}
          unresolvedWarnings={unresolvedWarnings}
          missingDepartmentMessages={missingDepartmentMessages}
          headline={headline}
          totalGap={totalGap}
          monthly={{
            totalTrackingGross: monthly.totalTrackingGross,
            totalTargetGross: monthly.totalTargetGross,
            totalGapToTarget: monthly.totalGapToTarget,
            totalPacePercent: monthly.totalPacePercent,
            daysUsed: monthly.daysUsed,
            daysAvailable: monthly.daysAvailable,
          }}
          deptCards={deptCards}
          sinceYesterday={sinceYesterday}
        />

        <div className="flex flex-col items-stretch gap-2 border-t border-white/[0.06] pt-4 sm:flex-row sm:items-center sm:justify-center">
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
          <LiveDashboardExpandedInsights
            worst={worst}
            best={best}
            operationalSignals={operationalSignals}
            opportunityRadar={data.opportunityRadar}
            keyActions={data.keyActions}
            sourceLineage={data.sourceLineage}
            departmentByName={departmentByName}
          />
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
