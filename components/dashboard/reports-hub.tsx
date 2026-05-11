"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";
import { Download, Eye, FileText, X } from "lucide-react";
import useSWR from "swr";
import type { VelocityData } from "@/src/lib/velocity/get-velocity-data";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type ReportCard = {
  id: string;
  name: string;
  description: string;
  metrics: string[];
  lastGenerated: string;
};

const reports: ReportCard[] = [
  {
    id: "daily-gm-briefing",
    name: "Daily GM Briefing",
    description: "One-page executive view for the GM and dealer principal before morning standup.",
    metrics: ["Store health", "Department pacing", "Top risks", "Recommended actions"],
    lastGenerated: "2026-04-29T08:10:00-04:00",
  },
  {
    id: "weekly-sales",
    name: "Weekly Sales Performance",
    description: "Desk and F&I trend pack with gross quality and issue-deal tracking.",
    metrics: ["Units", "Front/Back gross", "Per-copy", "Issue deals"],
    lastGenerated: "2026-04-28T17:42:00-04:00",
  },
  {
    id: "service-manager",
    name: "Service Manager Report",
    description: "Advisor productivity report for ELR, HPRO, CSI, and CP labor compliance.",
    metrics: ["CP labour", "ELR", "CSI", "Forecast vs actual"],
    lastGenerated: "2026-04-29T07:55:00-04:00",
  },
  {
    id: "parts-performance",
    name: "Parts Performance Report",
    description: "Parts mix and margin performance with category pacing and risk flags.",
    metrics: ["Sales mix", "Gross mix", "Forecast pace", "Category drag"],
    lastGenerated: "2026-04-29T07:58:00-04:00",
  },
  {
    id: "people-coaching",
    name: "People Coaching Report",
    description: "Cross-department accountability report highlighting coaching opportunities.",
    metrics: ["Leaderboard", "Issue count", "Coaching notes", "Manager accountability"],
    lastGenerated: "2026-04-29T08:02:00-04:00",
  },
  {
    id: "gross-leakage",
    name: "Gross Leakage Report",
    description: "Exception report for negative/zero gross events and preventable margin erosion.",
    metrics: ["Negative front", "Zero gross", "Back-heavy deals", "Margin leakage"],
    lastGenerated: "2026-04-29T08:06:00-04:00",
  },
  {
    id: "data-quality",
    name: "Data Quality Report",
    description: "Data hygiene report for TBD fields, missing ownership, and sync consistency.",
    metrics: ["TBD/NT fields", "Missing assignments", "Feed integrity", "Record freshness"],
    lastGenerated: "2026-04-29T08:00:00-04:00",
  },
];

type LiveSummaryResponse = VelocityData;

const fetcher = async (url: string): Promise<LiveSummaryResponse> => {
  const response = await fetch(url);
  if (!response.ok) throw new Error("Unable to load live report data.");
  return response.json();
};

export function ReportsHub() {
  const [previewId, setPreviewId] = useState<string | null>(null);
  const previewReport = useMemo(() => reports.find((r) => r.id === previewId) ?? null, [previewId]);
  const { data } = useSWR("/api/dashboard/live-summary-v2", fetcher, {
    refreshInterval: 30000,
    revalidateOnFocus: true,
  });
  const live = data ?? null;
  const sales = live?.departmentPulse.find((d) => d.department === "Sales");
  const service = live?.departmentPulse.find((d) => d.department === "Service");
  const parts = live?.departmentPulse.find((d) => d.department === "Parts");
  const monthToDateGross = (sales?.actual ?? 0) + (service?.actual ?? 0) + (parts?.actual ?? 0);

  return (
    <div className="space-y-8">
      <section className="grid gap-4 xl:grid-cols-2">
        {reports.map((report) => (
          <Card key={report.id} className="bg-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-slate-900">
                <FileText className="h-4 w-4 text-primary" />
                {report.name}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-[16px] text-slate-700">{report.description}</p>
              <div className="space-y-1">
                <p className="text-[12px] uppercase tracking-[0.16em] text-slate-500">Included metrics</p>
                <p className="text-[15px] text-slate-700">{report.metrics.join(" · ")}</p>
              </div>
              <p className="text-[14px] text-slate-600">Last generated: {format(new Date(report.lastGenerated), "MMM d, yyyy 'at' p")}</p>
              <div className="flex gap-2">
                <Button onClick={() => setPreviewId(report.id)}>
                  <Eye className="h-4 w-4" />
                  Preview Report
                </Button>
                <Button variant="outline">
                  <Download className="h-4 w-4" />
                  Export PDF (placeholder)
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

      {previewReport?.id === "daily-gm-briefing" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="max-h-[92vh] w-full max-w-4xl overflow-auto rounded-2xl border border-white/20 bg-[#0b1320] p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-white">Daily GM Briefing Preview</h2>
              <Button variant="ghost" className="text-white hover:bg-white/10" onClick={() => setPreviewId(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <article className="rounded-xl border border-white/15 bg-white p-8 text-slate-900 print:border-slate-300">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Sault Nissan Profit Desk</p>
              <h3 className="mt-2 text-3xl font-semibold">Daily GM Briefing</h3>
              <p className="mt-1 text-sm text-slate-600">{format(new Date(), "EEEE, MMMM d, yyyy")}</p>

              <section className="mt-6 grid gap-4 md:grid-cols-3">
                <div className="rounded-lg border border-slate-200 p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Store Health</p>
                  <p className="mt-1 text-3xl font-semibold">{live ? `${Math.round(live.dataConfidence.score)}/100` : "Live unavailable"}</p>
                </div>
                <div className="rounded-lg border border-slate-200 p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Store Gross MTD</p>
                  <p className="mt-1 text-3xl font-semibold">{live ? `$${monthToDateGross.toLocaleString()}` : "Live unavailable"}</p>
                </div>
                <div className="rounded-lg border border-slate-200 p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Month Progress</p>
                  <p className="mt-1 text-3xl font-semibold">{live ? `${new Date().getDate()}/${new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate()}` : "Live unavailable"}</p>
                </div>
              </section>

              <section className="mt-6">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Executive Headline</p>
                <p className="mt-2 text-lg leading-8">
                  {live
                    ? `Live gross is $${monthToDateGross.toLocaleString()}. Focus today: protect front-end quality and hold fixed-ops margin.`
                    : "Live source unavailable. Report preview requires Google Sheets feed."}
                </p>
              </section>

              <section className="mt-6 grid gap-4 md:grid-cols-3">
                <div className="rounded-lg border border-slate-200 p-4">
                  <p className="text-sm font-semibold">Sales</p>
                  <p className="mt-2 text-sm text-slate-700">{live ? `$${(sales?.actual ?? 0).toLocaleString()} gross posted from live sheet.` : "Live unavailable."}</p>
                </div>
                <div className="rounded-lg border border-slate-200 p-4">
                  <p className="text-sm font-semibold">Service</p>
                  <p className="mt-2 text-sm text-slate-700">{live ? `$${(service?.actual ?? 0).toLocaleString()} gross posted from live sheet.` : "Live unavailable."}</p>
                </div>
                <div className="rounded-lg border border-slate-200 p-4">
                  <p className="text-sm font-semibold">Parts</p>
                  <p className="mt-2 text-sm text-slate-700">{live ? `$${(parts?.actual ?? 0).toLocaleString()} gross posted from live sheet.` : "Live unavailable."}</p>
                </div>
              </section>

              <section className="mt-6 grid gap-4 md:grid-cols-2">
                <div className="rounded-lg border border-slate-200 p-4">
                  <p className="text-sm font-semibold">Priority Actions Before Noon</p>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
                    <li>Escalate all low-front sales deals before funding.</li>
                    <li>Rebalance service advisor load before peak hours.</li>
                    <li>Confirm same-day commitments for high-value parts orders.</li>
                  </ul>
                </div>
                <div className="rounded-lg border border-slate-200 p-4">
                  <p className="text-sm font-semibold">MTD Gross Snapshot</p>
                  <ul className="mt-2 space-y-1 text-sm text-slate-700">
                    <li>Sales: {live ? `$${(sales?.actual ?? 0).toLocaleString()}` : "Live unavailable"}</li>
                    <li>Service: {live ? `$${(service?.actual ?? 0).toLocaleString()}` : "Live unavailable"}</li>
                    <li>Parts: {live ? `$${(parts?.actual ?? 0).toLocaleString()}` : "Live unavailable"}</li>
                  </ul>
                </div>
              </section>
            </article>
          </div>
        </div>
      )}
    </div>
  );
}
