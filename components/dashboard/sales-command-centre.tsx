"use client";

import { useState } from "react";

import { KpiCard, KpiItem } from "@/components/dashboard/kpi-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { metricTraceWithCell, type MetricTrace } from "@/src/lib/data-pipeline/source-trace";
import { assessSalesDealsRisk } from "@/src/lib/risk/deal-risk-engine";
import { SalesDeal } from "@/src/lib/types/dealership";

const emDash = "\u2014";
const money = (value?: number | null) => (typeof value === "number" && Number.isFinite(value) ? `$${value.toLocaleString()}` : emDash);

function sum(items: number[]) {
  return items.reduce((acc, value) => acc + value, 0);
}

export function SalesCommandCentre({ deals, metricTrace }: { deals: SalesDeal[]; metricTrace?: MetricTrace }) {
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [salesperson, setSalesperson] = useState("all");
  const [manager, setManager] = useState("all");
  const [dealType, setDealType] = useState("all");
  const [businessManager, setBusinessManager] = useState("all");

  const salespeople = Array.from(new Set(deals.map((d) => d.salesperson))).sort();
  const managers = Array.from(new Set(deals.map((d) => d.manager))).sort();
  const businessManagers = Array.from(new Set(deals.map((d) => d.businessManager))).sort();

  const filteredDeals = deals.filter((deal) => {
    if (fromDate && deal.date < fromDate) return false;
    if (toDate && deal.date > toDate) return false;
    if (salesperson !== "all" && deal.salesperson !== salesperson) return false;
    if (manager !== "all" && deal.manager !== manager) return false;
    if (dealType !== "all" && deal.dealType !== dealType) return false;
    if (businessManager !== "all" && deal.businessManager !== businessManager) return false;
    return true;
  });

  const totalUnits = filteredDeals.length;
  const newUnits = filteredDeals.filter((d) => d.dealType === "new").length;
  const usedUnits = filteredDeals.filter((d) => d.dealType === "used").length;
  const unclassifiedUnits = filteredDeals.filter((d) => d.dealType === "unknown").length;
  const frontGross = sum(filteredDeals.map((d) => d.frontGross));
  const backGross = sum(filteredDeals.map((d) => d.backGross));
  const totalGross = sum(filteredDeals.map((d) => d.totalGross));
  const lowFrontDeals = filteredDeals.filter((d) => d.frontGross <= 0 || d.frontGross < 500);
  const atRiskDealCount = lowFrontDeals.length;
  const atRiskFrontGap = lowFrontDeals.reduce((acc, deal) => acc + Math.max(0, 1250 - deal.frontGross), 0);
  const metrics = {
    totalUnits,
    newUnits,
    usedUnits,
    frontGross,
    backGross,
    totalGross,
    perCopy: totalUnits > 0 ? Math.round(totalGross / totalUnits) : 0,
    trackingGross: Math.round(totalGross * 1.1),
  };

  const groupedSalespeople = new Map<string, { units: number; gross: number; front: number; back: number }>();
  filteredDeals.forEach((deal) => {
    const current = groupedSalespeople.get(deal.salesperson) ?? { units: 0, gross: 0, front: 0, back: 0 };
    current.units += 1;
    current.gross += deal.totalGross;
    current.front += deal.frontGross;
    current.back += deal.backGross;
    groupedSalespeople.set(deal.salesperson, current);
  });
  const salespersonBoard = Array.from(groupedSalespeople.entries())
    .map(([name, value]) => ({ name, ...value }))
    .sort((a, b) => b.gross - a.gross);

  const groupedManagers = new Map<string, { units: number; gross: number; avg: number }>();
  filteredDeals.forEach((deal) => {
    const current = groupedManagers.get(deal.manager) ?? { units: 0, gross: 0, avg: 0 };
    current.units += 1;
    current.gross += deal.totalGross;
    current.avg = Math.round(current.gross / current.units);
    groupedManagers.set(deal.manager, current);
  });
  const managerPerformance = Array.from(groupedManagers.entries())
    .map(([name, value]) => ({ name, ...value }))
    .sort((a, b) => b.gross - a.gross);

  const dealRiskRows = assessSalesDealsRisk(filteredDeals, {
    frontAverage: totalUnits > 0 ? frontGross / totalUnits : 0,
    backAverage: totalUnits > 0 ? backGross / totalUnits : 0,
  }).sort((a, b) => b.risk.score - a.risk.score);
  const topRisks = dealRiskRows.slice(0, 8);
  const topSalesperson = salespersonBoard[0];
  const topManager = managerPerformance[0];
  const grossGapToTracking = Math.max(0, metrics.trackingGross - metrics.totalGross);
  const classificationGap = Math.max(0, metrics.totalUnits - metrics.newUnits - metrics.usedUnits);
  const primaryProblem =
    grossGapToTracking > 0
      ? `${money(grossGapToTracking)} below tracking gross`
      : "Gross is on or above tracking";
  const primaryConsequence =
    grossGapToTracking > 0
      ? "If left unresolved, month-end closes below plan and weakens front-end quality."
      : "Current pace is healthy. Keep discipline on low-front exceptions.";

  const t = (cell: string) => (metricTrace ? metricTraceWithCell(metricTrace, cell) : undefined);

  const unitKpis: KpiItem[] = [
    {
      label: "Total Units",
      value: `${metrics.totalUnits}`,
      delta: unclassifiedUnits > 0 ? `${unclassifiedUnits} unclassified` : "All classified",
      trend: unclassifiedUnits > 0 ? "flat" : "up",
      metricTrace: t("Deal log · counted rows (UI filters apply)"),
    },
    {
      label: "New Units",
      value: `${metrics.newUnits}`,
      delta: "Filtered view",
      trend: "up",
      metricTrace: t("Deal log · DealType / section = New"),
    },
    {
      label: "Used Units",
      value: `${metrics.usedUnits}`,
      delta: "Filtered view",
      trend: "up",
      metricTrace: t("Deal log · DealType / section = Used"),
    },
    {
      label: "Unclassified Units",
      value: `${unclassifiedUnits}`,
      delta: "Missing new/used signal",
      trend: unclassifiedUnits > 0 ? "flat" : "up",
      metricTrace: t("Deal log · rows without New/Used classification"),
    },
  ];

  const grossKpis: KpiItem[] = [
    {
      label: "Front Gross",
      value: `$${metrics.frontGross.toLocaleString()}`,
      delta: "Filtered view",
      trend: "up",
      metricTrace: t("Deal log · FrontGross column (summed)"),
    },
    {
      label: "Back Gross",
      value: `$${metrics.backGross.toLocaleString()}`,
      delta: "Filtered view",
      trend: "up",
      metricTrace: t("Deal log · BackGross column (summed)"),
    },
    {
      label: "Total Gross",
      value: `$${metrics.totalGross.toLocaleString()}`,
      delta: "Filtered view",
      trend: "up",
      metricTrace: t("Deal log · TotalGross column (summed)"),
    },
    {
      label: "Per Copy",
      value: `$${metrics.perCopy.toLocaleString()}`,
      delta: "Filtered view",
      trend: "flat",
      metricTrace: t("Derived · total gross ÷ units (filtered set)"),
    },
    {
      label: "Tracking Gross",
      value: `$${metrics.trackingGross.toLocaleString()}`,
      delta: "Projected",
      trend: "up",
      metricTrace: t("UI projection (not a single sheet cell)"),
    },
  ];

  const commandList = [
    {
      title: "Escalate low-front deals before funding",
      why: `${atRiskDealCount} deals are below acceptable front-end threshold`,
      impact: money(atRiskFrontGap),
      action: "Desk manager review each flagged deal and rework structure same day.",
    },
    {
      title: "Close classification gap",
      why: `${classificationGap} deals are unclassified (new vs used)`,
      impact: "Forecast quality at risk",
      action: "Fix source rows so New/Used split is complete and trustable.",
    },
    {
      title: "Protect top performer momentum",
      why: topSalesperson ? `${topSalesperson.name} is leading at ${money(topSalesperson.gross)}` : "No leader data available",
      impact: "Stabilize daily pace",
      action: "Replicate winning structure with underperforming desks today.",
    },
  ];

  return (
    <div className="space-y-6">
      <section className="grid gap-3 rounded-2xl bg-card p-4 shadow-sm ring-1 ring-border/70 md:grid-cols-3 xl:grid-cols-6">
        <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="rounded-xl border border-input bg-white px-3 py-2.5 text-sm text-foreground" />
        <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="rounded-xl border border-input bg-white px-3 py-2.5 text-sm text-foreground" />
        <select value={salesperson} onChange={(e) => setSalesperson(e.target.value)} className="rounded-xl border border-input bg-white px-3 py-2.5 text-sm text-foreground"><option value="all">All salespeople</option>{salespeople.map((s) => <option key={s} value={s}>{s}</option>)}</select>
        <select value={manager} onChange={(e) => setManager(e.target.value)} className="rounded-xl border border-input bg-white px-3 py-2.5 text-sm text-foreground"><option value="all">All managers</option>{managers.map((s) => <option key={s} value={s}>{s}</option>)}</select>
        <select value={dealType} onChange={(e) => setDealType(e.target.value)} className="rounded-xl border border-input bg-white px-3 py-2.5 text-sm text-foreground"><option value="all">New + Used</option><option value="new">New</option><option value="used">Used</option></select>
        <select value={businessManager} onChange={(e) => setBusinessManager(e.target.value)} className="rounded-xl border border-input bg-white px-3 py-2.5 text-sm text-foreground"><option value="all">All business managers</option>{businessManagers.map((s) => <option key={s} value={s}>{s}</option>)}</select>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[var(--shadow-sm-subtle)]">
        <p className="text-[12px] font-semibold tracking-[0.08em] text-slate-500">WHAT THIS MEANS</p>
        <h2 className="mt-2 text-[34px] font-semibold tracking-tight text-slate-950">{primaryProblem}</h2>
        <p className="mt-2 text-[16px] text-slate-700">{primaryConsequence}</p>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {commandList.map((item) => (
            <div key={item.title} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="text-[16px] font-semibold text-slate-950">{item.title}</p>
              <p className="mt-1 text-[14px] text-slate-700">Why: {item.why}</p>
              <p className="mt-1 text-[14px] font-semibold text-[#DC2626]">Impact: {item.impact}</p>
              <p className="mt-1 text-[14px] text-slate-800">Do now: {item.action}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[...unitKpis, ...grossKpis].map((item) => (
          <KpiCard key={item.label} item={item} />
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card className="rounded-2xl bg-card shadow-sm ring-1 ring-border/70">
          <CardHeader>
            <CardTitle className="text-foreground">What Needs Attention Right Now</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-card">
                <TableRow>
                  <TableHead className="h-12 bg-muted/70 px-3 text-sm font-semibold text-foreground">Deal</TableHead>
                  <TableHead className="h-12 bg-muted/70 px-3 text-sm font-semibold text-foreground">Owner</TableHead>
                  <TableHead className="h-12 bg-muted/70 px-3 text-right text-sm font-semibold text-foreground">Front</TableHead>
                  <TableHead className="h-12 bg-muted/70 px-3 text-right text-sm font-semibold text-foreground">Risk</TableHead>
                  <TableHead className="h-12 bg-muted/70 px-3 text-sm font-semibold text-foreground">Why It Matters</TableHead>
                  <TableHead className="h-12 bg-muted/70 px-3 text-sm font-semibold text-foreground">Do Next</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topRisks.map(({ deal: d, risk }) => (
                  <TableRow key={d.id} className={risk.level === "high" ? "bg-red-50/70" : risk.level === "medium" ? "bg-amber-50/70" : ""}>
                    <TableCell className="px-3 py-3.5 text-sm font-semibold text-foreground">{d.id || emDash} · {d.customer || emDash}</TableCell>
                    <TableCell className="px-3 py-3.5 text-sm text-muted-foreground">{d.manager || emDash} / {d.salesperson || emDash}</TableCell>
                    <TableCell className={`px-3 py-3.5 text-right text-sm ${d.frontGross < 0 ? "text-red-700" : "text-foreground"}`}>{money(d.frontGross)}</TableCell>
                    <TableCell className={`px-3 py-3.5 text-right text-sm font-semibold ${risk.level === "high" ? "text-red-700" : risk.level === "medium" ? "text-amber-700" : "text-emerald-700"}`}>{risk.score} ({risk.level})</TableCell>
                    <TableCell className="px-3 py-3.5 text-sm text-slate-700">{risk.reasons.slice(0, 2).join(" · ")}</TableCell>
                    <TableCell className="px-3 py-3.5 text-sm text-slate-700">{risk.recommendedAction}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="rounded-2xl bg-card shadow-sm ring-1 ring-border/70">
          <CardHeader>
            <CardTitle className="text-foreground">On-Track Plan</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-700">
            <p>
              <span className="font-semibold text-slate-950">Primary target:</span> close the {money(grossGapToTracking)} gap to tracking gross.
            </p>
            <p>
              <span className="font-semibold text-slate-950">Fastest lever:</span> rescue {atRiskDealCount} low-front deals worth {money(atRiskFrontGap)}.
            </p>
            <p>
              <span className="font-semibold text-slate-950">People focus:</span>{" "}
              {topManager ? `${topManager.name} leads manager gross at ${money(topManager.gross)}.` : "Manager leaderboard unavailable."}
            </p>
            <p>
              <span className="font-semibold text-slate-950">Data discipline:</span> classify the remaining {classificationGap} deals (new/used) to stabilize forecast accuracy.
            </p>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-[13px] font-semibold tracking-[0.08em] text-slate-600">TODAY&apos;S EXECUTION CHECKLIST</p>
              <ul className="mt-2 space-y-1.5">
                <li>- 10:00 AM: desk review all high-risk deals.</li>
                <li>- 1:00 PM: rework low-front structure before funding.</li>
                <li>- 4:00 PM: verify gross recovery and update next-day queue.</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card className="rounded-2xl bg-card shadow-sm ring-1 ring-border/70">
          <CardHeader><CardTitle className="text-foreground">Salesperson Leaderboard</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="h-12 bg-muted/70 px-3 text-sm font-semibold text-foreground">Name</TableHead>
                  <TableHead className="h-12 bg-muted/70 px-3 text-sm font-semibold text-foreground">Units</TableHead>
                  <TableHead className="h-12 bg-muted/70 px-3 text-sm font-semibold text-foreground">Gross</TableHead>
                  <TableHead className="h-12 bg-muted/70 px-3 text-sm font-semibold text-foreground">Front / Back</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {salespersonBoard.slice(0, 8).map((r) => (
                  <TableRow key={r.name}>
                    <TableCell className="px-3 py-3.5 text-sm text-muted-foreground">{r.name}</TableCell>
                    <TableCell className="px-3 py-3.5 text-sm text-muted-foreground">{r.units}</TableCell>
                    <TableCell className="px-3 py-3.5 text-sm font-semibold text-foreground">{money(r.gross)}</TableCell>
                    <TableCell className="px-3 py-3.5 text-sm text-muted-foreground">{money(r.front)} / {money(r.back)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="rounded-2xl bg-card shadow-sm ring-1 ring-border/70">
          <CardHeader><CardTitle className="text-foreground">Manager Performance</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="h-12 bg-muted/70 px-3 text-sm font-semibold text-foreground">Manager</TableHead>
                  <TableHead className="h-12 bg-muted/70 px-3 text-sm font-semibold text-foreground">Units</TableHead>
                  <TableHead className="h-12 bg-muted/70 px-3 text-sm font-semibold text-foreground">Total Gross</TableHead>
                  <TableHead className="h-12 bg-muted/70 px-3 text-sm font-semibold text-foreground">Per Copy</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {managerPerformance.slice(0, 8).map((r) => (
                  <TableRow key={r.name}>
                    <TableCell className="px-3 py-3.5 text-sm text-muted-foreground">{r.name}</TableCell>
                    <TableCell className="px-3 py-3.5 text-sm text-muted-foreground">{r.units}</TableCell>
                    <TableCell className="px-3 py-3.5 text-sm font-semibold text-foreground">{money(r.gross)}</TableCell>
                    <TableCell className="px-3 py-3.5 text-sm text-muted-foreground">{money(r.avg)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
