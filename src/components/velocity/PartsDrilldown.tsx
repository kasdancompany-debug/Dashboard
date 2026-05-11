"use client";

import type { AccountabilityItem, DepartmentHealth } from "@/src/lib/profit-engine/types";
import type { PartsSummary } from "@/src/lib/types/dealership";

type PartsDrilldownProps = {
  summary: PartsSummary;
  partsPulse?: DepartmentHealth;
  actionQueue: Array<{
    title: string;
    impact: number;
    owner: string;
    action: string;
    severity: "low" | "medium" | "high";
    department: "Sales" | "Service" | "Parts" | "Store";
  }>;
  accountability: AccountabilityItem[];
};

function money(value: number) {
  return `$${Math.round(Math.abs(value)).toLocaleString()}`;
}

export function PartsDrilldown({ summary, partsPulse, actionQueue, accountability }: PartsDrilldownProps) {
  const partsActions = actionQueue.filter((a) => a.department === "Parts").slice(0, 5);
  const partsAccountability = accountability.filter((a) => a.department === "Parts").slice(0, 5);
  const internalMix = summary.internalSales / Math.max(1, summary.totalSales);

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-gradient-to-br from-[#0D1322] via-[#111827] to-[#070B14] p-6">
        <p className="velocity-metadata uppercase tracking-[0.2em]">Parts Command</p>
        <div className="mt-3 grid gap-4 md:grid-cols-4">
          <div>
            <p className="velocity-metadata">Parts gross</p>
            <p className="velocity-kpi-number mt-1 text-white">{money(summary.totalGross)}</p>
          </div>
          <div>
            <p className="velocity-metadata">Forecast gap</p>
            <p className={`velocity-kpi-number mt-1 ${summary.totalGross >= summary.forecastGross ? "text-green-300" : "text-red-300"}`}>
              {money(summary.totalGross - summary.forecastGross)}
            </p>
          </div>
          <div>
            <p className="velocity-metadata">Internal mix</p>
            <p className={`velocity-kpi-number mt-1 ${internalMix > 0.3 ? "text-amber-200" : "text-cyan-200"}`}>{(internalMix * 100).toFixed(1)}%</p>
          </div>
          <div>
            <p className="velocity-metadata">Pace status</p>
            <p className="mt-1 text-[24px] font-semibold text-slate-100">{partsPulse?.status ?? summary.paceStatus}</p>
            <p className="text-[12px] text-[#94A3B8]">{partsPulse ? `${partsPulse.pacePercent}% pace` : "Parts pulse unavailable"}</p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#090f1d] p-5">
        <h2 className="exec-section-title text-white">Parts Risk Queue</h2>
        <div className="mt-3 space-y-2">
          {partsActions.length ? (
            partsActions.map((item, idx) => (
              <article key={`${item.title}-${idx}`} className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)] p-3">
                <p className="text-[14px] font-semibold text-white">{item.title}</p>
                <p className="mt-1 text-[12px] text-[#94A3B8]">Impact: <span className="font-mono text-red-300">{money(item.impact)}</span> · Owner: {item.owner}</p>
                <p className="mt-1 text-[12px] text-[#64748B]">{item.action}</p>
              </article>
            ))
          ) : (
            <p className="text-[13px] text-[#94A3B8]">No parts actions currently escalated.</p>
          )}
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2">
        <article className="rounded-2xl border border-cyan-500/30 bg-cyan-950/15 p-4">
          <h3 className="text-[18px] font-semibold text-white">Mix and Margin Signals</h3>
          <p className="mt-2 text-[13px] text-[#94A3B8]">Customer sales: {money(summary.customerSales)} · Internal sales: {money(summary.internalSales)}</p>
          <p className="mt-1 text-[12px] text-[#94A3B8]">Warranty sales: {money(summary.warrantySales)} · Total sales: {money(summary.totalSales)}</p>
          <p className="mt-1 text-[12px] text-[#64748B]">Keep internal-heavy mix below threshold to protect retail margin quality.</p>
        </article>
        <article className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0D1322] p-4">
          <h3 className="text-[18px] font-semibold text-white">Management Attention</h3>
          <div className="mt-2 space-y-1 text-[12px] text-[#94A3B8]">
            {partsAccountability.length ? (
              partsAccountability.map((a, idx) => (
                <p key={`${a.person}-${idx}`}>- {a.person} ({a.role}) · {a.issueCount} issues · {money(a.totalDollarImpact)}</p>
              ))
            ) : (
              <p>- No parts accountability escalations right now.</p>
            )}
          </div>
        </article>
      </section>
    </div>
  );
}
