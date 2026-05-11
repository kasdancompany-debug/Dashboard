"use client";

import { AlertTriangle, Wrench } from "lucide-react";

import { KpiCard, KpiItem } from "@/components/dashboard/kpi-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { metricTraceWithCell, type MetricTrace } from "@/src/lib/data-pipeline/source-trace";
import { ServiceAdvisorPerformance, ServiceSummary } from "@/src/lib/types/dealership";

const emDash = "\u2014";
const money = (value?: number | null) => (typeof value === "number" && Number.isFinite(value) ? `$${value.toLocaleString()}` : emDash);

export function ServiceCommandCentre({
  summary,
  advisors,
  metricTrace,
}: {
  summary: ServiceSummary;
  advisors: ServiceAdvisorPerformance[];
  metricTrace?: MetricTrace;
}) {
  const elrAverage = advisors.length ? advisors.reduce((acc, a) => acc + a.elr, 0) / advisors.length : 0;
  const hproAverage = advisors.length ? advisors.reduce((acc, a) => acc + a.hpro, 0) / advisors.length : 0;

  const t = (cell: string) => (metricTrace ? metricTraceWithCell(metricTrace, cell) : undefined);

  const kpis: KpiItem[] = [
    {
      label: "Total Service Sales",
      value: `$${summary.totalSales.toLocaleString()}`,
      delta: `forecast $${summary.forecastSales.toLocaleString()}`,
      trend: "up" as const,
      metricTrace: t("Sales section · row labeled Total · actual column (H)"),
    },
    {
      label: "Total Gross",
      value: `$${summary.totalGross.toLocaleString()}`,
      delta: `forecast $${summary.forecastGross.toLocaleString()}`,
      trend: "up" as const,
      metricTrace: t("Gross section · row labeled Total · actual column (H)"),
    },
    {
      label: "Customer Pay Sales",
      value: `$${summary.customerSales.toLocaleString()}`,
      delta: "CP contribution",
      trend: "up" as const,
      metricTrace: t("Sales section · Customer row · actual column (H)"),
    },
    {
      label: "Warranty Sales",
      value: `$${summary.warrantySales.toLocaleString()}`,
      delta: "Warranty contribution",
      trend: "up" as const,
      metricTrace: t("Sales section · Warranty row · actual column (H)"),
    },
    {
      label: "Internal Sales",
      value: `$${summary.internalSales.toLocaleString()}`,
      delta: "Internal contribution",
      trend: "flat" as const,
      metricTrace: t("Sales section · Internal row · actual column (H)"),
    },
    {
      label: "CP Labour Actual",
      value: `$${summary.cpLaborActual.toFixed(1)}`,
      delta: `goal $${summary.dailyCpLaborGoal.toFixed(0)}`,
      trend: summary.cpLaborActual < summary.dailyCpLaborGoal ? "down" : "up",
      metricTrace: t("Sales Total row · actual vs tracking columns"),
    },
    {
      label: "CP Labour Tracking",
      value: `$${summary.cpLaborTracking.toFixed(1)}`,
      delta: "month tracking",
      trend: "flat" as const,
      metricTrace: t("Sales Total row · tracking column (M)"),
    },
    {
      label: "Daily CP Labour Goal",
      value: `$${summary.dailyCpLaborGoal.toFixed(1)}`,
      delta: "daily benchmark",
      trend: "flat" as const,
      metricTrace: t("Row labeled Daily C/P Labor Department Goal"),
    },
    {
      label: "ELR Average",
      value: `$${elrAverage.toFixed(1)}`,
      delta: "advisor average",
      trend: "up" as const,
      metricTrace: t("Advisor grid · ELR column (derived average)"),
    },
    {
      label: "HPRO Average",
      value: `${hproAverage.toFixed(2)}`,
      delta: "advisor average",
      trend: "up" as const,
      metricTrace: t("Advisor grid · HPRO column (derived average)"),
    },
  ];

  const rankedInsights = [
    {
      title: "CP labour pace",
      takeaway: `Service is ${money(summary.cpLaborActual)} vs daily goal ${money(summary.dailyCpLaborGoal)}.`,
      action: "Reassign high-value maintenance opportunities before noon dispatch.",
      impact: Math.max(0, Math.round(summary.dailyCpLaborGoal - summary.cpLaborActual)),
    },
    {
      title: "Gross vs forecast",
      takeaway: `Service gross is ${money(summary.totalGross)} vs forecast ${money(summary.forecastGross)}.`,
      action: "Audit gross exceptions on active ROs and close corrective pricing today.",
      impact: Math.max(0, Math.round(summary.forecastGross - summary.totalGross)),
    },
    {
      title: "Advisor ELR consistency",
      takeaway: `${advisors.filter((a) => a.elr < 140).length} advisors are below ELR target $140.`,
      action: "Coach low-ELR advisors before afternoon peak and enforce menu discipline.",
      impact: Math.max(0, Math.round((140 - elrAverage) * 40)),
    },
  ].sort((a, b) => b.impact - a.impact);

  const elrTarget = 140;
  const csiTarget = 95;
  const warrantyMixPct = (summary.warrantySales / summary.totalSales) * 100;
  const internalMixPct = (summary.internalSales / summary.totalSales) * 100;

  const alerts = [
    {
      condition: summary.cpLaborActual < summary.dailyCpLaborGoal,
      title: "CP labour below daily goal",
      detail: `Actual $${summary.cpLaborActual.toFixed(1)} vs goal $${summary.dailyCpLaborGoal.toFixed(1)}.`,
      action: "Review advisor sold-hours by 11:30 AM and assign same-day high-value maintenance opportunities.",
    },
    {
      condition: advisors.some((a) => a.elr < elrTarget),
      title: "Advisor below ELR target",
      detail: `${advisors.filter((a) => a.elr < elrTarget).map((a) => a.name).join(", ")} below $${elrTarget}.`,
      action: "Run pricing and menu compliance check before afternoon dispatch handoff.",
    },
    {
      condition: advisors.some((a) => a.csiScore < csiTarget),
      title: "Advisor with low CSI",
      detail: `${advisors.filter((a) => a.csiScore < csiTarget).map((a) => `${a.name} (${a.csiScore.toFixed(1)})`).join(", ")} under ${csiTarget}.`,
      action: "Conduct same-day callback audit and escalate unresolved customer concerns.",
    },
    {
      condition: warrantyMixPct > 30,
      title: "Warranty carrying too much of the month",
      detail: `Warranty is ${warrantyMixPct.toFixed(1)}% of total service sales.`,
      action: "Push advisor focus on CP maintenance opportunities in every active RO.",
    },
    {
      condition: internalMixPct > 12,
      title: "Internal sales unusual spike",
      detail: `Internal is ${internalMixPct.toFixed(1)}% of total service sales.`,
      action: "Validate internal jobs coding and verify used-car recon approvals by end of day.",
    },
  ];

  const actionableAlerts = alerts.filter((a) => a.condition);

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {kpis.map((item) => (
          <KpiCard key={item.label} item={item} />
        ))}
      </section>

      <section className="rounded-2xl bg-card p-4 shadow-sm ring-1 ring-border/70">
        <h3 className="text-base font-semibold text-foreground">Ranked Service Insights</h3>
        <p className="mt-1 text-sm text-muted-foreground">Takeaway: service recovery depends on CP labour pace and gross exception control today.</p>
        <ol className="mt-3 space-y-2">
          {rankedInsights.map((insight, idx) => (
            <li key={insight.title} className="rounded-lg border border-border/70 bg-background/60 px-3 py-2">
              <p className="text-sm font-semibold text-foreground">
                {idx + 1}. {insight.title} <span className="font-mono text-[#b91328]">+{money(insight.impact)}</span>
              </p>
              <p className="text-sm text-muted-foreground">{insight.takeaway}</p>
              <p className="text-sm text-foreground">
                <span className="font-semibold text-[#b91328]">Action:</span> {insight.action}
              </p>
            </li>
          ))}
        </ol>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.2fr_1fr_1fr]">
        <Card className="rounded-2xl bg-card shadow-sm ring-1 ring-border/70">
          <CardHeader><CardTitle className="text-foreground">Advisor leaderboard</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="h-12 bg-muted/70 px-3 text-sm font-semibold text-foreground">Advisor</TableHead>
                  <TableHead className="h-12 bg-muted/70 px-3 text-right text-sm font-semibold text-foreground">Sales</TableHead>
                  <TableHead className="h-12 bg-muted/70 px-3 text-right text-sm font-semibold text-foreground">CP Labour</TableHead>
                  <TableHead className="h-12 bg-muted/70 px-3 text-right text-sm font-semibold text-foreground">ELR</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...advisors].sort((a, b) => b.totalSales - a.totalSales).map((a) => (
                  <TableRow key={a.name}>
                    <TableCell className="px-3 py-3.5 text-sm font-medium text-foreground">{a.name || emDash}</TableCell>
                    <TableCell className="px-3 py-3.5 text-right text-sm text-foreground">{money(a.totalSales)}</TableCell>
                    <TableCell className="px-3 py-3.5 text-right text-sm text-foreground">{money(a.cpLabor)}</TableCell>
                    <TableCell className="px-3 py-3.5 text-right text-sm text-foreground">{a.elr ? `$${a.elr.toFixed(1)}` : emDash}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="rounded-2xl bg-card shadow-sm ring-1 ring-border/70">
          <CardHeader><CardTitle className="text-foreground">CSI performance</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="h-12 bg-muted/70 px-3 text-sm font-semibold text-foreground">Advisor</TableHead>
                  <TableHead className="h-12 bg-muted/70 px-3 text-right text-sm font-semibold text-foreground">Responses</TableHead>
                  <TableHead className="h-12 bg-muted/70 px-3 text-right text-sm font-semibold text-foreground">Perfect</TableHead>
                  <TableHead className="h-12 bg-muted/70 px-3 text-right text-sm font-semibold text-foreground">CSI</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {advisors.map((a) => (
                  <TableRow key={a.name}>
                    <TableCell className="px-3 py-3.5 text-sm font-medium text-foreground">{a.name || emDash}</TableCell>
                    <TableCell className="px-3 py-3.5 text-right text-sm text-foreground">{a.csiResponses ?? emDash}</TableCell>
                    <TableCell className="px-3 py-3.5 text-right text-sm text-foreground">{a.csiPerfect ?? emDash}</TableCell>
                    <TableCell className="px-3 py-3.5 text-right text-sm text-foreground">{a.csiScore ? a.csiScore.toFixed(1) : emDash}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="rounded-2xl bg-card shadow-sm ring-1 ring-border/70">
          <CardHeader><CardTitle className="text-foreground">CP RO + HPRO performance</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="h-12 bg-muted/70 px-3 text-sm font-semibold text-foreground">Advisor</TableHead>
                  <TableHead className="h-12 bg-muted/70 px-3 text-right text-sm font-semibold text-foreground">CP RO</TableHead>
                  <TableHead className="h-12 bg-muted/70 px-3 text-right text-sm font-semibold text-foreground">HPRO</TableHead>
                  <TableHead className="h-12 bg-muted/70 px-3 text-right text-sm font-semibold text-foreground">Wildcards</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {advisors.map((a) => (
                  <TableRow key={a.name}>
                    <TableCell className="px-3 py-3.5 text-sm font-medium text-foreground">{a.name || emDash}</TableCell>
                    <TableCell className="px-3 py-3.5 text-right text-sm text-foreground">{a.cpRo ?? emDash}</TableCell>
                    <TableCell className="px-3 py-3.5 text-right text-sm text-foreground">{a.hpro ? a.hpro.toFixed(2) : emDash}</TableCell>
                    <TableCell className="px-3 py-3.5 text-right text-sm text-foreground">{a.soldWildcards ?? emDash}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <Card className="border-border/70 bg-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-foreground">
              <AlertTriangle className="h-4 w-4 text-[#b91328]" />
              Service Alerts Requiring Action Today
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {actionableAlerts.map((alert) => (
              <div key={alert.title} className="rounded-lg border border-border/70 bg-background/50 p-3">
                <p className="text-sm font-semibold text-foreground">{alert.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{alert.detail}</p>
                <p className="mt-2 text-sm text-foreground">Action: {alert.action}</p>
              </div>
            ))}
            {actionableAlerts.length === 0 && <p className="text-sm text-emerald-700">No critical service alerts in current snapshot.</p>}
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-foreground">
              <Wrench className="h-4 w-4 text-[#b91328]" />
              Manager Action Queue
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-foreground">
            <p>- Review sold-hours gap at 11:30 AM and assign next RO upsell priorities.</p>
            <p>- Coach low-ELR advisors before afternoon peak check-in wave.</p>
            <p>- Run CSI callback audit for yesterday deliveries before 3:00 PM.</p>
            <p>- Validate internal RO coding to prevent gross leakage before close.</p>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
