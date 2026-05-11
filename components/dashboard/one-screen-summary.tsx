"use client";

import { StatusPill } from "@/components/dashboard/status-pill";

function money(value: number) {
  const n = Math.round(Math.abs(value));
  const core = `$${n.toLocaleString()}`;
  return value < 0 ? `−${core}` : core;
}

export function OneScreenSummary({
  gapVsForecast,
  recoverableToday,
  topIssues,
  topOwners,
  todaysActions,
}: {
  gapVsForecast: number;
  recoverableToday: number;
  topIssues: Array<{ id: string; impact: number; issue: string; owner: string }>;
  topOwners: Array<{ id: string; name: string; role: string; riskAmount: number; issueCount: number }>;
  todaysActions: Array<{ id: string; title: string; impact: number; owner: string; deadline: string; status: "open" | "in progress" | "done" }>;
}) {
  const status = gapVsForecast > 0 ? "WINNING" : gapVsForecast < 0 ? "LOSING" : "WATCH";
  const statusVariant = gapVsForecast > 0 ? "healthy" : gapVsForecast < 0 ? "at-risk" : "watch";

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_1px_0_rgba(2,6,23,0.03)] md:p-5">
      <div className="grid gap-4 xl:grid-cols-12">
        <div className="xl:col-span-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500">1. Are we winning or losing?</p>
          <div className="mt-1 flex items-center gap-2">
            <StatusPill variant={statusVariant} label={status} />
            <p className="font-mono text-[14px] font-semibold text-slate-800">{gapVsForecast > 0 ? "Ahead" : gapVsForecast < 0 ? "Behind" : "On pace"}</p>
          </div>

          <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500">2. What is the money gap?</p>
          <p className="display-headline mt-1 text-[clamp(2.25rem,4vw,3rem)] leading-[0.92] tracking-[-0.035em] text-slate-950">
            {money(Math.abs(gapVsForecast))} {gapVsForecast < 0 ? "BEHIND" : gapVsForecast > 0 ? "AHEAD" : "ON TARGET"}
          </p>

          <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500">3. What is recoverable today?</p>
          <p className="mt-1 font-mono text-[clamp(1.5rem,3vw,2rem)] font-bold leading-none text-[#e11d48]">{money(recoverableToday)} recoverable today</p>
        </div>

        <div className="xl:col-span-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500">4. Top 3 issues</p>
          <ol className="mt-1.5 space-y-1.5">
            {topIssues.slice(0, 3).map((i, idx) => (
              <li key={i.id} className="rounded-md border border-slate-200/80 px-2.5 py-2">
                <p className="text-[12px] font-semibold text-slate-900">
                  {idx + 1}. {i.issue}
                </p>
                <p className="text-[11px] text-slate-600">
                  <span className="font-mono text-[#e11d48]">{money(i.impact)}</span> · {i.owner}
                </p>
              </li>
            ))}
          </ol>
        </div>

        <div className="xl:col-span-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500">5. Top 5 owners</p>
          <ul className="mt-1.5 space-y-1">
            {topOwners.slice(0, 5).map((o, idx) => (
              <li key={o.id} className="text-[11px] text-slate-700">
                <span className="font-semibold text-slate-900">
                  {idx + 1}. {o.name}
                </span>{" "}
                · {money(o.riskAmount)} · {o.issueCount} issues
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-4 border-t border-slate-200 pt-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500">6. Today&apos;s actions</p>
        <ol className="mt-1.5 grid gap-1.5 md:grid-cols-2">
          {todaysActions.slice(0, 6).map((a, idx) => (
            <li key={a.id} className="rounded-md border border-slate-200/80 px-2.5 py-2 text-[12px]">
              <p className="font-semibold text-slate-900">
                {idx + 1}. {a.title}
              </p>
              <p className="text-slate-600">
                {a.owner} · {a.deadline} · <span className="font-mono text-[#e11d48]">+{money(a.impact)}</span>
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

