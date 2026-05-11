import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { AtRiskDeal } from "@/src/lib/profit-engine/types";

type AtRiskDealsProps = {
  deals: AtRiskDeal[];
  viewAllHref?: string;
  className?: string;
};

function money(value: number) {
  const absolute = Math.round(Math.abs(value)).toLocaleString();
  return value < 0 ? `-$${absolute}` : `$${absolute}`;
}

function topReason(deal: AtRiskDeal) {
  return deal.reasons[0] ?? "Risk signal flagged";
}

function scoreTone(score: number) {
  if (score >= 85) return "bg-rose-100 text-rose-700 border-rose-200";
  if (score >= 70) return "bg-amber-100 text-amber-700 border-amber-200";
  return "bg-slate-100 text-slate-700 border-slate-200";
}

export function AtRiskDeals({ deals, viewAllHref = "/dashboard/sales", className }: AtRiskDealsProps) {
  const topFive = [...deals].sort((a, b) => b.riskScore - a.riskScore).slice(0, 5);
  const lead = topFive[0];
  const remainder = topFive.slice(1);

  if (!topFive.length) {
    return (
      <section className={cn("rounded-xl border border-slate-200/90 bg-white p-4", className)}>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Top Sales Risks</h2>
          <Button asChild variant="outline" size="xs">
            <Link href={viewAllHref}>
              View all sales risks
              <ArrowRight className="h-3 w-3" />
            </Link>
          </Button>
        </div>
        <p className="mt-3 text-[13px] text-slate-600">No at-risk deals are currently flagged.</p>
      </section>
    );
  }

  return (
    <section className={cn("rounded-xl border border-slate-200/90 bg-white p-4 shadow-[0_1px_0_rgba(15,23,42,0.04)]", className)}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Top Sales Risks</h2>
        <Button asChild variant="outline" size="xs">
          <Link href={viewAllHref}>
            View all sales risks
            <ArrowRight className="h-3 w-3" />
          </Link>
        </Button>
      </div>

      <div className="mt-3 grid gap-2 md:grid-cols-2">
        <article className="md:col-span-2 rounded-lg border border-rose-200 bg-gradient-to-br from-rose-50 via-white to-white p-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <p className="text-[15px] font-semibold tracking-tight text-slate-950">
              {lead.customer} · {lead.vehicle}
            </p>
            <span className={cn("rounded-full border px-2 py-0.5 text-[11px] font-semibold", scoreTone(lead.riskScore))}>
              Risk {lead.riskScore}
            </span>
          </div>
          <p className="mt-1 text-[12px] text-slate-700">
            {lead.salesperson} · Manager: {lead.manager}
          </p>
          <div className="mt-2 grid gap-1 text-[12px] text-slate-700 sm:grid-cols-2">
            <p>Front: <span className="font-semibold text-slate-900">{money(lead.frontGross)}</span></p>
            <p>Back: <span className="font-semibold text-slate-900">{money(lead.backGross)}</span></p>
            <p>Total: <span className="font-semibold text-slate-900">{money(lead.totalGross)}</span></p>
            <p>Recoverable: <span className="font-semibold text-rose-700">{money(lead.estimatedRecoverableGross)}</span></p>
          </div>
          <p className="mt-2 text-[12px] text-slate-700">
            <span className="font-semibold text-slate-900">Top reason:</span> {topReason(lead)}
          </p>
          <p className="mt-1 text-[12px] text-slate-700">
            <span className="font-semibold text-slate-900">Recommended action:</span> {lead.recommendedAction}
          </p>
        </article>

        {remainder.map((deal) => (
          <article key={deal.dealId} className="rounded-lg border border-slate-200 bg-white p-3">
            <div className="flex items-start justify-between gap-2">
              <p className="text-[13px] font-semibold text-slate-950">
                {deal.customer} · {deal.vehicle}
              </p>
              <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-semibold", scoreTone(deal.riskScore))}>
                {deal.riskScore}
              </span>
            </div>
            <p className="mt-1 text-[11px] text-slate-700">
              {deal.salesperson} · Manager: {deal.manager}
            </p>
            <div className="mt-2 grid grid-cols-2 gap-1 text-[11px] text-slate-700">
              <p>Front: <span className="font-semibold text-slate-900">{money(deal.frontGross)}</span></p>
              <p>Back: <span className="font-semibold text-slate-900">{money(deal.backGross)}</span></p>
              <p>Total: <span className="font-semibold text-slate-900">{money(deal.totalGross)}</span></p>
              <p>Recoverable: <span className="font-semibold text-rose-700">{money(deal.estimatedRecoverableGross)}</span></p>
            </div>
            <p className="mt-2 line-clamp-2 text-[11px] text-slate-600">
              <span className="font-semibold text-slate-900">Reason:</span> {topReason(deal)}
            </p>
            <p className="mt-1 line-clamp-2 text-[11px] text-slate-600">
              <span className="font-semibold text-slate-900">Action:</span> {deal.recommendedAction}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
