"use client";

import { AlertTriangle, Boxes } from "lucide-react";

import { KpiCard, KpiItem } from "@/components/dashboard/kpi-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { metricTraceWithCell, type MetricTrace } from "@/src/lib/data-pipeline/source-trace";
import { PartsSummary } from "@/src/lib/types/dealership";

const money = (value?: number | null) => (typeof value === "number" && Number.isFinite(value) ? `$${value.toLocaleString()}` : "\u2014");

export function PartsCommandCentre({ summary, metricTrace }: { summary: PartsSummary; metricTrace?: MetricTrace }) {
  const trackingSales = Math.round(summary.totalSales * 1.05);
  const salesDeltaVsGoal = summary.totalSales - summary.forecastSales;
  const grossDeltaVsGoal = summary.totalGross - summary.forecastGross;

  const t = (cell: string) => (metricTrace ? metricTraceWithCell(metricTrace, cell) : undefined);

  const kpis: KpiItem[] = [
    {
      label: "Customer Sales",
      value: `$${summary.customerSales.toLocaleString()}`,
      delta: "retail channel",
      trend: "up" as const,
      metricTrace: t("Sales section · Customer row · actual column"),
    },
    {
      label: "Warranty Sales",
      value: `$${summary.warrantySales.toLocaleString()}`,
      delta: "warranty channel",
      trend: "flat" as const,
      metricTrace: t("Sales section · Warranty row · actual column"),
    },
    {
      label: "Internal Sales",
      value: `$${summary.internalSales.toLocaleString()}`,
      delta: "internal channel",
      trend: "flat" as const,
      metricTrace: t("Sales section · Internal row · actual column"),
    },
    {
      label: "Total Sales",
      value: `$${summary.totalSales.toLocaleString()}`,
      delta: `forecast $${summary.forecastSales.toLocaleString()}`,
      trend: "up" as const,
      metricTrace: t("Sales section · Total row · actual column"),
    },
    {
      label: "Customer Gross",
      value: `$${summary.customerGross.toLocaleString()}`,
      delta: "retail gross",
      trend: "up" as const,
      metricTrace: t("Gross section · Customer row · actual column"),
    },
    {
      label: "Warranty Gross",
      value: `$${summary.warrantyGross.toLocaleString()}`,
      delta: "warranty gross",
      trend: "flat" as const,
      metricTrace: t("Gross section · Warranty row · actual column"),
    },
    {
      label: "Internal Gross",
      value: `$${summary.internalGross.toLocaleString()}`,
      delta: "internal gross",
      trend: "flat" as const,
      metricTrace: t("Gross section · Internal row · actual column"),
    },
    {
      label: "Total Gross",
      value: `$${summary.totalGross.toLocaleString()}`,
      delta: `forecast $${summary.forecastGross.toLocaleString()}`,
      trend: "up" as const,
      metricTrace: t("Gross section · Total row · actual column"),
    },
    {
      label: "Forecast",
      value: `$${summary.forecastSales.toLocaleString()}`,
      delta: "month objective",
      trend: "flat" as const,
      metricTrace: t("Summary · Forecast column on Total row"),
    },
    {
      label: "Tracking",
      value: `$${trackingSales.toLocaleString()}`,
      delta: "projection",
      trend: "up" as const,
      metricTrace: t("UI projection (not a single sheet cell)"),
    },
    {
      label: "Up/Down vs Goal",
      value: `${salesDeltaVsGoal >= 0 ? "+" : "-"}$${Math.abs(salesDeltaVsGoal).toLocaleString()}`,
      delta: `${grossDeltaVsGoal >= 0 ? "+" : "-"}$${Math.abs(grossDeltaVsGoal).toLocaleString()} gross`,
      trend: salesDeltaVsGoal >= 0 ? ("up" as const) : ("down" as const),
      metricTrace: t("Derived from sales/gross totals vs forecast columns"),
    },
  ];

  const rankedInsights = [
    {
      title: "Sales pace vs forecast",
      takeaway: `Parts sales are ${money(summary.totalSales)} vs forecast ${money(summary.forecastSales)}.`,
      action: "Prioritize high-margin customer-pay pulls on active advisor menus today.",
      impact: Math.max(0, Math.round(summary.forecastSales - summary.totalSales)),
    },
    {
      title: "Gross pace vs forecast",
      takeaway: `Parts gross is ${money(summary.totalGross)} vs forecast ${money(summary.forecastGross)}.`,
      action: "Audit margin exception SKUs and correct pricing before close.",
      impact: Math.max(0, Math.round(summary.forecastGross - summary.totalGross)),
    },
    {
      title: "Internal mix drag",
      takeaway: `Internal mix is ${((summary.internalSales / Math.max(1, summary.totalSales)) * 100).toFixed(1)}% of sales.`,
      action: "Challenge non-essential internal requisitions and redirect inventory to retail opportunities.",
      impact: Math.max(0, Math.round(summary.totalGross * 0.07)),
    },
  ].sort((a, b) => b.impact - a.impact);

  const categoryBySales = [
    { label: "Customer", pct: summary.customerSales / summary.totalSales },
    { label: "Warranty", pct: summary.warrantySales / summary.totalSales },
    { label: "Internal", pct: summary.internalSales / summary.totalSales },
  ].sort((a, b) => a.pct - b.pct)[0];

  const alerts = [
    {
      show: summary.customerSales < summary.forecastSales * 0.45,
      title: "Customer sales behind forecast",
      detail: `Customer sales at $${summary.customerSales.toLocaleString()} are below required pace.`,
      action: "Push advisor-to-parts counter coordination on deferred maintenance menus.",
    },
    {
      show: summary.internalSales > summary.totalSales * 0.3,
      title: "Internal sales unusually high",
      detail: `Internal mix is ${((summary.internalSales / summary.totalSales) * 100).toFixed(1)}% of total sales.`,
      action: "Review recon request approvals and cap non-essential internal line pulls today.",
    },
    {
      show: summary.totalGross < summary.forecastGross,
      title: "Gross behind pace",
      detail: `Gross is $${Math.abs(grossDeltaVsGoal).toLocaleString()} under forecast pace.`,
      action: "Audit margin exceptions on fast-moving SKUs before afternoon dispatch.",
    },
    {
      show: true,
      title: "Category dragging total",
      detail: `${categoryBySales.label} is the lowest share at ${(categoryBySales.pct * 100).toFixed(1)}% of total sales.`,
      action: `Set one tactical lift objective for ${categoryBySales.label.toLowerCase()} before close.`,
    },
  ].filter((a) => a.show);

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        {kpis.map((item) => <KpiCard key={item.label} item={item} />)}
      </section>

      <section className="rounded-2xl bg-card p-4 shadow-sm ring-1 ring-border/70">
        <h3 className="text-base font-semibold text-foreground">Ranked Parts Insights</h3>
        <p className="mt-1 text-sm text-muted-foreground">Takeaway: parts recovery hinges on gross gap closure and internal-mix discipline today.</p>
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

      <section className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <Card className="border-border/70 bg-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-foreground">
              <AlertTriangle className="h-4 w-4 text-[#b91328]" />
              Parts Alerts Requiring Action
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {alerts.map((alert) => (
              <div key={alert.title} className="rounded-lg border border-border/70 bg-background/50 p-3">
                <p className="text-sm font-semibold text-foreground">{alert.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{alert.detail}</p>
                <p className="mt-2 text-sm text-foreground">Action: {alert.action}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-foreground">
              <Boxes className="h-4 w-4 text-[#b91328]" />
              Executive Parts Focus Today
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-foreground">
            <p>- Prioritize customer-pay parts pull-through on advisor menus before 2 PM.</p>
            <p>- Validate margin exceptions on high-velocity SKUs and adjust pricing where needed.</p>
            <p>- Challenge internal requisitions that do not support same-week retail delivery.</p>
            <p>- Reconfirm forecast-sensitive purchase orders for tomorrow&apos;s service load.</p>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
