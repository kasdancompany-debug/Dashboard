"use client";

import type { AccountabilityItem, DepartmentHealth } from "@/src/lib/profit-engine/types";
import type { ServiceAdvisorPerformance, ServiceSummary } from "@/src/lib/types/dealership";

type ServiceDrilldownProps = {
  summary: ServiceSummary;
  advisors: ServiceAdvisorPerformance[];
  servicePulse?: DepartmentHealth;
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

export function ServiceDrilldown({ summary, advisors, servicePulse, actionQueue, accountability }: ServiceDrilldownProps) {
  const serviceActions = actionQueue.filter((a) => a.department === "Service").slice(0, 5);
  const serviceAccountability = accountability.filter((a) => a.department === "Service").slice(0, 5);
  const lowElr = advisors.filter((a) => a.elr < 140);
  const lowHpro = advisors.filter((a) => a.hpro < 2.8);

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-gradient-to-br from-[#0D1322] via-[#111827] to-[#070B14] p-6">
        <p className="velocity-metadata uppercase tracking-[0.2em]">Service Command</p>
        <div className="mt-3 grid gap-4 md:grid-cols-4">
          <div>
            <p className="velocity-metadata">Service gross</p>
            <p className="velocity-kpi-number mt-1 text-white">{money(summary.totalGross)}</p>
          </div>
          <div>
            <p className="velocity-metadata">Forecast gap</p>
            <p className={`velocity-kpi-number mt-1 ${summary.totalGross >= summary.forecastGross ? "text-green-300" : "text-red-300"}`}>
              {money(summary.totalGross - summary.forecastGross)}
            </p>
          </div>
          <div>
            <p className="velocity-metadata">CP labour</p>
            <p className="velocity-kpi-number mt-1 text-cyan-200">{summary.cpLaborActual.toFixed(1)}</p>
          </div>
          <div>
            <p className="velocity-metadata">Pace status</p>
            <p className="mt-1 text-[24px] font-semibold text-slate-100">{servicePulse?.status ?? summary.paceStatus}</p>
            <p className="text-[12px] text-[#94A3B8]">{servicePulse ? `${servicePulse.pacePercent}% pace` : "Service pulse unavailable"}</p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#090f1d] p-5">
        <h2 className="exec-section-title text-white">Service Risk Queue</h2>
        <div className="mt-3 space-y-2">
          {serviceActions.length ? (
            serviceActions.map((item, idx) => (
              <article key={`${item.title}-${idx}`} className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)] p-3">
                <p className="text-[14px] font-semibold text-white">{item.title}</p>
                <p className="mt-1 text-[12px] text-[#94A3B8]">Impact: <span className="font-mono text-red-300">{money(item.impact)}</span> · Owner: {item.owner}</p>
                <p className="mt-1 text-[12px] text-[#64748B]">{item.action}</p>
              </article>
            ))
          ) : (
            <p className="text-[13px] text-[#94A3B8]">No service actions currently escalated.</p>
          )}
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2">
        <article className="rounded-2xl border border-amber-500/30 bg-amber-950/15 p-4">
          <h3 className="text-[18px] font-semibold text-white">Advisor Risk Signals</h3>
          <p className="mt-2 text-[13px] text-[#94A3B8]">{lowElr.length} advisors below ELR target · {lowHpro.length} below HPRO target.</p>
          <div className="mt-2 space-y-1 text-[12px] text-[#fef3c7]">
            {advisors.slice(0, 5).map((a) => (
              <p key={a.name}>- {a.name}: ELR {a.elr.toFixed(1)} · HPRO {a.hpro.toFixed(2)} · CSI {a.csiScore.toFixed(1)}</p>
            ))}
          </div>
        </article>
        <article className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0D1322] p-4">
          <h3 className="text-[18px] font-semibold text-white">Management Attention</h3>
          <div className="mt-2 space-y-1 text-[12px] text-[#94A3B8]">
            {serviceAccountability.length ? (
              serviceAccountability.map((a, idx) => (
                <p key={`${a.person}-${idx}`}>- {a.person} ({a.role}) · {a.issueCount} issues · {money(a.totalDollarImpact)}</p>
              ))
            ) : (
              <p>- No service accountability escalations right now.</p>
            )}
          </div>
        </article>
      </section>
    </div>
  );
}
