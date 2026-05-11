"use client";

import { useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";

import { cn } from "@/lib/utils";
import type { AtRiskDeal } from "@/src/lib/profit-engine/types";
import type { SalesDeal, SalesSummary } from "@/src/lib/types/dealership";

type SalesDrilldownProps = {
  salesDeals: SalesDeal[];
  atRiskDeals: AtRiskDeal[];
  salesSummary: SalesSummary;
};

type SortKey = "risk" | "front" | "back" | "total";

function money(value: number) {
  const n = Math.round(Math.abs(value));
  const core = `$${n.toLocaleString()}`;
  return value < 0 ? `−${core}` : core;
}

const missingSignal = (value: string | null | undefined) => !value || /(TBD|NT)/i.test(value);

export function SalesDrilldown({ salesDeals, atRiskDeals, salesSummary }: SalesDrilldownProps) {
  const [sortKey, setSortKey] = useState<SortKey>("risk");
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");

  const dependencyRatio = salesSummary.backGross / Math.max(1, Math.abs(salesSummary.totalGross));
  const backDependencyWarning = dependencyRatio >= 0.6;
  const totalAtRiskGross = atRiskDeals.reduce((sum, deal) => sum + Math.max(0, deal.estimatedRecoverableGross), 0);

  const sortedDeals = useMemo(() => {
    const sorted = [...atRiskDeals].sort((a, b) => {
      const aVal = sortKey === "risk" ? a.riskScore : sortKey === "front" ? a.frontGross : sortKey === "back" ? a.backGross : a.totalGross;
      const bVal = sortKey === "risk" ? b.riskScore : sortKey === "front" ? b.frontGross : sortKey === "back" ? b.backGross : b.totalGross;
      return sortDir === "desc" ? bVal - aVal : aVal - bVal;
    });
    return sorted.slice(0, 12);
  }, [atRiskDeals, sortKey, sortDir]);

  const salespersonImpact = useMemo(() => {
    const map = new Map<string, { units: number; gross: number; front: number; riskExposure: number; riskCount: number }>();
    for (const deal of salesDeals) {
      const current = map.get(deal.salesperson) ?? { units: 0, gross: 0, front: 0, riskExposure: 0, riskCount: 0 };
      current.units += 1;
      current.gross += deal.totalGross;
      current.front += deal.frontGross;
      map.set(deal.salesperson, current);
    }
    for (const risk of atRiskDeals) {
      const current = map.get(risk.salesperson) ?? { units: 0, gross: 0, front: 0, riskExposure: 0, riskCount: 0 };
      current.riskExposure += risk.estimatedRecoverableGross;
      current.riskCount += 1;
      map.set(risk.salesperson, current);
    }
    return Array.from(map.entries())
      .map(([name, v]) => ({
        name,
        units: v.units,
        gross: v.gross,
        avgFront: v.units ? v.front / v.units : 0,
        riskExposure: v.riskExposure,
        riskCount: v.riskCount,
      }))
      .sort((a, b) => b.riskExposure - a.riskExposure);
  }, [salesDeals, atRiskDeals]);

  const topRiskSalesperson = salespersonImpact[0];
  const bestGrossQuality = [...salespersonImpact]
    .filter((s) => s.units >= 2)
    .sort((a, b) => b.avgFront - a.avgFront)[0];

  const managerImpact = useMemo(() => {
    const map = new Map<string, { riskDeals: number; riskExposure: number; avgRisk: number; totalRiskScore: number }>();
    for (const risk of atRiskDeals) {
      const current = map.get(risk.manager) ?? { riskDeals: 0, riskExposure: 0, avgRisk: 0, totalRiskScore: 0 };
      current.riskDeals += 1;
      current.riskExposure += risk.estimatedRecoverableGross;
      current.totalRiskScore += risk.riskScore;
      current.avgRisk = Math.round(current.totalRiskScore / Math.max(1, current.riskDeals));
      map.set(risk.manager, current);
    }
    return Array.from(map.entries())
      .map(([manager, v]) => ({
        manager,
        riskDeals: v.riskDeals,
        riskExposure: v.riskExposure,
        avgRisk: v.avgRisk,
        recommendation:
          v.avgRisk >= 80
            ? "Run immediate desk review before funding cut-off."
            : v.avgRisk >= 65
              ? "Tighten front-end structure checks on all pending deals."
              : "Maintain daily exception review cadence.",
      }))
      .sort((a, b) => b.riskExposure - a.riskExposure);
  }, [atRiskDeals]);

  const dataQuality = useMemo(() => {
    const missingFields = salesDeals.filter(
      (deal) => missingSignal(deal.stockNumber) || missingSignal(deal.businessManager) || missingSignal(deal.notes),
    );
    const incomingOrPreorder = salesDeals.filter((deal) => deal.status === "incoming" || deal.status === "preorder");
    return {
      missingFields: missingFields.length,
      incomingOrPreorder: incomingOrPreorder.length,
      missingExamples: missingFields.slice(0, 4),
    };
  }, [salesDeals]);

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-gradient-to-br from-[#0D1322] via-[#111827] to-[#070B14] p-6">
        <p className="velocity-metadata uppercase tracking-[0.2em]">Sales Risk Hero</p>
        <div className="mt-3 grid gap-4 md:grid-cols-4">
          <div>
            <p className="velocity-metadata">Total at-risk gross</p>
            <p className="velocity-kpi-number mt-1 text-red-300">{money(totalAtRiskGross)}</p>
          </div>
          <div>
            <p className="velocity-metadata">Risky deals</p>
            <p className="velocity-kpi-number mt-1 text-white">{atRiskDeals.length}</p>
          </div>
          <div>
            <p className="velocity-metadata">Average front gross</p>
            <p className="velocity-kpi-number mt-1 text-white">{money(salesSummary.frontAverage)}</p>
          </div>
          <div className={cn("rounded-xl border p-3", backDependencyWarning ? "border-amber-500/30 bg-amber-950/20" : "border-emerald-500/30 bg-cyan-950/20")}>
            <p className="velocity-metadata">Back-end dependency</p>
            <p className={cn("mt-1 text-[22px] font-semibold", backDependencyWarning ? "text-amber-200" : "text-green-300")}>
              {(dependencyRatio * 100).toFixed(1)}%
            </p>
            <p className="mt-1 text-[12px] text-[#94A3B8]">
              {backDependencyWarning ? "Warning: back-end is carrying too much total gross." : "Balanced gross mix."}
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#090f1d] p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="exec-section-title text-white">At-Risk Deals</h2>
            <p className="mt-1 text-[13px] text-[#94A3B8]">Sort by risk, front, back, or total gross to prioritize intervention.</p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
              className="rounded-md border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)] px-2 py-1.5 text-[12px] text-slate-200"
            >
              <option value="risk">Risk score</option>
              <option value="front">Front gross</option>
              <option value="back">Back gross</option>
              <option value="total">Total gross</option>
            </select>
            <button
              onClick={() => setSortDir((v) => (v === "desc" ? "asc" : "desc"))}
              className="rounded-md border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)] px-2 py-1.5 text-[12px] text-slate-200"
            >
              {sortDir === "desc" ? "High to Low" : "Low to High"}
            </button>
          </div>
        </div>
        <div className="mt-3 space-y-2">
          {sortedDeals.slice(0, 5).map((deal, idx) => (
            <article key={deal.dealId} className={cn("rounded-xl border p-3", idx === 0 ? "border-red-500/30 bg-red-950/20" : "border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)]")}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[14px] font-semibold text-white">{deal.customer} · {deal.vehicle}</p>
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-red-200">Risk {deal.riskScore}</p>
              </div>
              <p className="mt-1 text-[12px] text-[#94A3B8]">{deal.salesperson} / {deal.manager}</p>
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-[#94A3B8]">
                <p>Front: <span className="font-mono text-slate-100">{money(deal.frontGross)}</span></p>
                <p>Back: <span className="font-mono text-slate-100">{money(deal.backGross)}</span></p>
                <p>Total: <span className="font-mono text-slate-100">{money(deal.totalGross)}</span></p>
              </div>
              <p className="mt-1 text-[12px] text-slate-300">Reason: {deal.reasons[0] ?? "Risk flagged"}</p>
              <p className="text-[12px] text-[#64748B]">Action: {deal.recommendedAction}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#090f1d] p-5">
        <h2 className="exec-section-title text-white">Salesperson Impact</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-red-500/30 bg-red-950/20 p-3">
            <p className="velocity-metadata">Most risk exposure</p>
            <p className="mt-1 text-[16px] font-semibold text-white">{topRiskSalesperson?.name ?? "N/A"}</p>
            <p className="text-[12px] text-red-200">{topRiskSalesperson ? money(topRiskSalesperson.riskExposure) : "No risk exposure data"}</p>
          </div>
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-3">
            <p className="velocity-metadata">Best gross quality</p>
            <p className="mt-1 text-[16px] font-semibold text-white">{bestGrossQuality?.name ?? "N/A"}</p>
            <p className="text-[12px] text-green-200">{bestGrossQuality ? `${money(bestGrossQuality.avgFront)} avg front` : "Insufficient data"}</p>
          </div>
          <div className="rounded-xl border border-cyan-500/30 bg-cyan-950/20 p-3">
            <p className="velocity-metadata">Volume vs gross quality</p>
            <p className="mt-1 text-[12px] text-[#94A3B8]">Track unit pace against average front gross, not volume alone.</p>
          </div>
        </div>
        <div className="mt-3 space-y-2">
          {salespersonImpact.slice(0, 6).map((row) => (
            <div key={row.name} className="rounded-lg border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)] px-3 py-2 text-[12px] text-[#94A3B8]">
              <span className="font-semibold text-slate-200">{row.name}</span> · {row.units} units · avg front {money(row.avgFront)} · exposure {money(row.riskExposure)}
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#090f1d] p-5">
        <h2 className="exec-section-title text-white">Desk Manager View</h2>
        <div className="mt-3 space-y-2">
          {managerImpact.slice(0, 6).map((manager) => (
            <article key={manager.manager} className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)] p-3">
              <p className="text-[14px] font-semibold text-white">{manager.manager}</p>
              <p className="mt-1 text-[12px] text-[#94A3B8]">
                {manager.riskDeals} risk deals · exposure <span className="font-mono text-red-300">{money(manager.riskExposure)}</span> · avg risk {manager.avgRisk}
              </p>
              <p className="mt-1 text-[12px] text-[#64748B]">{manager.recommendation}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#090f1d] p-5">
        <h2 className="exec-section-title text-white">Data Quality</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-3">
            <p className="velocity-metadata">TBD/NT required field gaps</p>
            <p className="mt-1 text-[24px] font-semibold text-amber-200">{dataQuality.missingFields}</p>
            <p className="mt-1 text-[12px] text-[#94A3B8]">Deals with missing stock, business manager, or notes fields.</p>
          </div>
          <div className="rounded-xl border border-cyan-500/30 bg-cyan-950/20 p-3">
            <p className="velocity-metadata">Incoming/preorder completion queue</p>
            <p className="mt-1 text-[24px] font-semibold text-cyan-200">{dataQuality.incomingOrPreorder}</p>
            <p className="mt-1 text-[12px] text-[#94A3B8]">Deals needing completion discipline before funding risk increases.</p>
          </div>
        </div>
        {dataQuality.missingExamples.length > 0 ? (
          <div className="mt-3 rounded-xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)] p-3">
            <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-slate-300">Sample incomplete deals</p>
            <div className="mt-2 space-y-1 text-[12px] text-[#94A3B8]">
              {dataQuality.missingExamples.map((deal) => (
                <p key={deal.id} className="flex items-center gap-2">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-300" />
                  {deal.id} · {deal.customer} · {deal.salesperson}
                </p>
              ))}
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
