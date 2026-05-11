"use client";

import { StatusPill } from "@/components/dashboard/status-pill";
import { DataFreshness } from "@/components/dashboard/data-freshness";
import { cn } from "@/lib/utils";

type BossReason = {
  id: string;
  impact: number;
  issue: string;
  owner: string;
  why: string;
  action: string;
};

type BossOwner = {
  id: string;
  name: string;
  role: string;
  riskAmount: number;
  issueCount: number;
  prompt: string;
};

function money(value: number) {
  const n = Math.round(Math.abs(value));
  const core = `$${n.toLocaleString()}`;
  return value < 0 ? `−${core}` : core;
}

export function BossBrief({
  gapVsForecast,
  recoverableToday,
  explanation,
  dataNotes,
  confidenceScore,
  confidenceLabel,
  estimatedLabel,
  fallbackSummary,
  reportingMonth,
  freshnessSources,
  reasons,
  owners,
  playbook,
  playbookTotal,
}: {
  gapVsForecast: number;
  recoverableToday: number;
  explanation: string;
  dataNotes: Array<{ label: string; month: string; healthy: boolean }>;
  confidenceScore?: number;
  confidenceLabel?: string;
  estimatedLabel?: string;
  fallbackSummary?: string;
  reportingMonth: string;
  freshnessSources: Array<{ label: string; extractedMonthKey?: string | null }>;
  reasons: BossReason[];
  owners: BossOwner[];
  playbook: Array<{ id: string; title: string; impact: number }>;
  playbookTotal: number;
}) {
  const status = gapVsForecast > 0 ? "WINNING" : gapVsForecast < 0 ? "LOSING" : "WATCH";
  const statusTone = gapVsForecast > 0 ? "healthy" : gapVsForecast < 0 ? "at-risk" : "watch";

  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-[0_1px_0_rgba(2,6,23,0.03)] md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">Boss Brief</p>
        <StatusPill variant={statusTone} label={status} />
      </div>

      <div className={cn("border-l-2 pl-4", gapVsForecast < 0 ? "border-l-[#e11d48]/60" : gapVsForecast > 0 ? "border-l-emerald-500/60" : "border-l-amber-500/60")}>
        <p className="display-headline text-[clamp(3rem,7vw,5rem)] leading-[0.9] tracking-[-0.04em] text-slate-950">
          {money(Math.abs(gapVsForecast))} {gapVsForecast < 0 ? "BEHIND FORECAST" : gapVsForecast > 0 ? "AHEAD OF FORECAST" : "ON FORECAST"}
        </p>
        <p className="mt-2 font-mono text-[clamp(1.5rem,3.6vw,2.3rem)] font-bold leading-[0.95] tracking-[-0.02em] text-slate-900">
          {money(recoverableToday)} recoverable today
        </p>
        {estimatedLabel ? <p className="mt-2 text-[14px] font-semibold text-amber-700">⚠️ {estimatedLabel}</p> : null}
        {typeof confidenceScore === "number" ? <p className="mt-0.5 text-[14px] font-semibold text-slate-800">Confidence: {confidenceScore}%{confidenceLabel ? ` (${confidenceLabel})` : ""}</p> : null}
        {fallbackSummary ? <p className="mt-0.5 text-[13px] text-slate-700">{fallbackSummary}</p> : null}
        <p className="mt-2 max-w-4xl text-[14px] text-slate-700">{explanation}</p>
        <DataFreshness reportingMonth={reportingMonth} sources={freshnessSources} />
        {dataNotes.length > 0 ? (
          <div className="mt-2 rounded-md border border-slate-200/80 bg-slate-50/70 px-3 py-2">
            <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">Data notes</p>
            <ul className="mt-1 space-y-0.5 text-[12px] text-slate-700">
              {dataNotes.map((n) => (
                <li key={n.label}>
                  - {n.label}: {n.month} {n.healthy ? "✅" : "⚠️"}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-lg border border-slate-200/80 bg-slate-50/70 p-4">
          <h3 className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-500">Top 3 reasons</h3>
          <ol className="mt-2 space-y-2">
            {reasons.map((r, idx) => (
              <li key={r.id} className="border-t border-slate-200/70 pt-2 first:border-0 first:pt-0">
                <p className="text-[14px] font-semibold text-slate-950">
                  <span className="mr-1 font-mono text-slate-400">{idx + 1}.</span>
                  <span className="font-mono text-[#0b0d12]">{money(r.impact)}</span> · {r.issue}
                </p>
                <p className="line-clamp-1 text-[12px] text-slate-600">Owner: {r.owner} · Why: {r.why}</p>
                <p className="line-clamp-1 text-[12px] font-medium text-slate-900">
                  <span className="text-[#e11d48]">Do now: </span>
                  {r.action}
                </p>
              </li>
            ))}
          </ol>
        </div>

        <div className="rounded-lg border border-slate-200/80 bg-slate-50/70 p-4">
          <h3 className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-500">Who to talk to</h3>
          <ul className="mt-2 space-y-2">
            {owners.map((o, idx) => (
              <li key={o.id} className="border-t border-slate-200/70 pt-2 first:border-0 first:pt-0">
                <p className="text-[13px] font-semibold text-slate-950">
                  {idx + 1}. {o.name} · {o.role}
                </p>
                <p className="text-[12px] font-mono text-slate-900">
                  {money(o.riskAmount)} risk · {o.issueCount} issues
                </p>
                <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">Conversation prompt</p>
                <p className="line-clamp-2 text-[12px] text-slate-700">{o.prompt}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200/80 bg-white p-4">
        <h3 className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-500">Today&apos;s playbook</h3>
        <ol className="mt-2 space-y-1.5">
          {playbook.map((p, idx) => (
            <li key={p.id} className="text-[14px] font-medium text-slate-900">
              <span className="mr-1 font-mono text-slate-500">{idx + 1}.</span>
              {p.title} <span className={cn("font-mono font-bold", p.impact > 0 ? "text-[#e11d48]" : "text-slate-900")}>+{money(p.impact)}</span>
            </li>
          ))}
        </ol>
        <p className="mt-3 border-t border-slate-200 pt-2 font-mono text-[15px] font-bold text-slate-950">
          Total recoverable today: <span className="text-slate-950">{money(playbookTotal)}</span>
        </p>
      </div>
    </section>
  );
}

