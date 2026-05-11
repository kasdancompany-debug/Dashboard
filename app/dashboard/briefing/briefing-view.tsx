"use client";

import useSWR from "swr";
import type { VelocityData } from "@/src/lib/velocity/get-velocity-data";

type LiveSummaryResponse = VelocityData;

const fetcher = async (url: string): Promise<LiveSummaryResponse> => {
  const response = await fetch(url);
  if (!response.ok) throw new Error("Unable to load live briefing data.");
  return response.json();
};

const money = (value: number) => `$${Math.round(Math.abs(value)).toLocaleString()}`;

export default function BriefingView() {
  const { data, error, isLoading } = useSWR("/api/dashboard/live-summary-v2", fetcher, {
    refreshInterval: 30000,
    revalidateOnFocus: true,
  });

  if (isLoading) {
    return <div className="rounded-md border border-[#e5e7eb] bg-white px-4 py-3 text-[14px] text-[#6B7280]">Loading live briefing...</div>;
  }

  if (error || !data) {
    return (
      <div className="rounded-md border border-[#DC2626] bg-[#fef2f2] px-4 py-3 text-[14px] text-[#DC2626]">
        Live Google Sheets briefing data is unavailable. Mock data is disabled.
      </div>
    );
  }

  const closeGap = data.gapToTarget;

  return (
    <div className="space-y-8">
      <section className="rounded-md border border-[#e5e7eb] bg-white p-5">
        <p className="text-[12px] font-semibold tracking-[0.08em] text-[#6B7280]">TODAY&apos;S PROFIT BRIEFING (LIVE)</p>
        <h1 className="display-headline mt-2 text-[44px] font-bold text-[#0B0B0C] md:text-[56px]">
          {closeGap < 0 ? `${money(closeGap)} below target requires action today.` : `${money(closeGap)} above target. Protect close quality.`}
        </h1>
      </section>

      <section className="rounded-md border border-[#e5e7eb] bg-white p-5">
        <h2 className="text-[24px] font-semibold text-[#0B0B0C]">At-Risk Deals (Live)</h2>
        <div className="mt-4 space-y-2">
          {(data.atRiskDeals ?? []).slice(0, 8).map((deal) => (
            <div key={deal.dealId} className="grid grid-cols-[1.2fr_1.2fr_1fr_130px_1.4fr] gap-3 rounded-md border border-[#e5e7eb] bg-white px-3 py-2">
              <p className="text-[14px] font-medium text-[#0B0B0C]">{deal.customer}</p>
              <p className="text-[14px] text-[#0B0B0C]">{deal.vehicle}</p>
              <p className="text-[14px] text-[#0B0B0C]">{deal.salesperson}</p>
              <p className={`text-right text-[14px] font-semibold ${deal.frontGross <= 0 ? "text-[#DC2626]" : "text-[#0B0B0C]"}`}>{money(deal.frontGross)}</p>
              <p className="text-[13px] text-[#6B7280]">{deal.reasons.slice(0, 2).join(" · ") || deal.recommendedAction}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-md border border-[#e5e7eb] bg-white p-5">
        <h2 className="text-[24px] font-semibold text-[#0B0B0C]">Today&apos;s Accountability (Live)</h2>
        <div className="mt-4 space-y-2">
          {(data.accountability ?? []).slice(0, 6).map((item, idx) => (
            <div key={`${item.person}-${idx}`} className="grid grid-cols-[1.1fr_0.8fr_1.4fr_140px] gap-3 rounded-md border border-[#e5e7eb] px-3 py-2">
              <p className="text-[14px] font-medium text-[#0B0B0C]">{item.person} · {item.role}</p>
              <p className="text-[14px] text-[#0B0B0C]">{item.issueCount} issues</p>
              <p className="text-[13px] text-[#6B7280]">{item.topIssue}</p>
              <p className="text-right text-[14px] font-semibold text-[#0B0B0C]">{money(item.totalDollarImpact)}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
