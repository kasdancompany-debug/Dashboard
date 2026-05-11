import { ArrowDownRight, ArrowUpRight, Info, Minus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { formatMetricTraceHoverLine, type MetricTrace } from "@/src/lib/data-pipeline/source-trace";

export type KpiItem = {
  label: string;
  value: string;
  delta: string;
  trend: "up" | "down" | "flat";
  /** Lineage for dealer principal trust; hover shows workbook → tab → range. */
  metricTrace?: MetricTrace;
};

export function KpiCard({ item }: { item: KpiItem }) {
  const Icon = item.trend === "up" ? ArrowUpRight : item.trend === "down" ? ArrowDownRight : Minus;
  const deltaTone = item.trend === "up" ? "text-[#16A34A]" : item.trend === "down" ? "text-[#DC2626]" : "text-[#6B7280]";
  const traceLine = item.metricTrace ? formatMetricTraceHoverLine(item.metricTrace) : undefined;

  return (
    <Card className="group relative bg-white" title={traceLine}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <p className="text-[13px] font-medium tracking-[0.02em] text-[#6B7280]">{item.label}</p>
          {item.metricTrace ? (
            <span className="relative shrink-0 text-[#6B7280]">
              <Info className="h-4 w-4" aria-hidden />
              <span className="sr-only">Source details available on hover</span>
              <div className="pointer-events-none absolute right-0 top-full z-20 mt-1 hidden w-[min(100vw-2rem,22rem)] rounded-lg border border-slate-200 bg-white p-3 text-[12px] font-normal leading-snug text-slate-700 shadow-lg group-hover:block">
                <p className="font-semibold text-slate-900">Data lineage</p>
                <p className="mt-1.5 whitespace-pre-wrap">{traceLine}</p>
                <p className="mt-2 text-[11px] text-slate-500">
                  Status: {item.metricTrace.freshnessStatus}
                  {item.metricTrace.formulaErrorsPresent ? " · Formula errors detected in source grid" : ""}
                </p>
              </div>
            </span>
          ) : null}
        </div>
        <p className="mt-1 font-mono text-[42px] leading-[1.02] font-bold tracking-[-0.03em] text-[#0B0B0C]">{item.value}</p>
        <p className={`mt-2 flex items-center gap-1.5 text-[13px] font-medium ${deltaTone}`}>
          <Icon className="h-4 w-4" />
          {item.delta}
        </p>
      </CardContent>
    </Card>
  );
}
