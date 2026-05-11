import { mapConfidenceSeverityToPill, StatusPill } from "@/components/dashboard/status-pill";
import type { ConfidenceWarning, ExecutiveBriefingVM } from "@/src/lib/briefing/executive-briefing-vm";

const NISSAN = "#E11D48";
const MUTED = "#5c6370";
const WIN = "#15803d";

function money(value: number) {
  const n = Math.round(Math.abs(value));
  const core = `$${n.toLocaleString()}`;
  if (value < 0) return `−${core}`;
  return core;
}

function severityBorder(s: ConfidenceWarning["severity"]) {
  if (s === "critical") return NISSAN;
  if (s === "warn") return "#ca8a04";
  return "#94a3b8";
}

function severityBg(s: ConfidenceWarning["severity"]) {
  if (s === "critical") return "#fff5f5";
  if (s === "warn") return "#fffbeb";
  return "#f8fafc";
}

export function ExecutiveBriefingSection({ vm }: { vm: ExecutiveBriefingVM }) {
  return (
    <section className="space-y-4" aria-labelledby="exec-briefing-heading">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-neutral-200 pb-3">
        <div>
          <h2 id="exec-briefing-heading" className="text-[20px] font-semibold tracking-tight text-neutral-950">
            Executive Briefing
          </h2>
          <p className="mt-1 max-w-3xl text-[13px] leading-relaxed" style={{ color: MUTED }}>
            Dealer-principal view: translate signals into ownership and same-day decisions—not spreadsheets.
          </p>
        </div>
      </div>

      {/* 1. Money at Risk */}
      <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-[0_1px_0_rgba(15,20,25,0.04)]">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: MUTED }}>
          1 · Money at risk
        </h3>
        <p className="mt-1 text-[12px] leading-snug" style={{ color: MUTED }}>
          Ranked checklist by dollar impact. Fix in order.
        </p>
        <ol className="mt-4 space-y-0">
          {vm.moneyAtRisk.map((row) => (
            <li key={row.id} className="border-t border-neutral-100 py-4 transition-colors duration-150 hover:bg-slate-50/60 first:border-t-0 first:pt-0">
              <div className="grid gap-3 md:grid-cols-[170px_minmax(0,1fr)_minmax(220px,280px)] md:items-center">
                <p className="font-mono text-[clamp(1.75rem,3.4vw,2rem)] font-bold leading-none tracking-tight text-[#e11d48] tabular-nums">
                  {money(row.impact)}
                </p>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-neutral-500">{row.tag}</p>
                  <p className="mt-1 line-clamp-1 text-[13px] font-medium text-neutral-900">{row.title}</p>
                </div>
                <p className="line-clamp-2 text-[13px] font-semibold text-neutral-900 md:text-right">
                  <span className="text-[#e11d48]">→ </span>
                  {row.decision}
                </p>
              </div>
            </li>
          ))}
        </ol>
        {vm.moneyAtRisk.length === 0 && <p className="mt-3 text-[13px]" style={{ color: MUTED }}>No material dollar risk flagged—still verify source hygiene below.</p>}
      </div>

      {/* 2. Accountability */}
      <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-[0_1px_0_rgba(15,20,25,0.04)]">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: MUTED }}>
          2 · Accountability
        </h3>
        <p className="mt-1 text-[13px] leading-snug" style={{ color: MUTED }}>
          Name-level ownership sorted by highest risk exposure.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-left text-[12px]">
            <thead>
              <tr className="border-b border-neutral-200 text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                <th className="py-2 pr-3">Name</th>
                <th className="py-2 pr-3">Role</th>
                <th className="py-2 pr-3 text-right">Risk amount</th>
                <th className="py-2 pr-3 text-right">Issue count</th>
                <th className="py-2">Risk</th>
              </tr>
            </thead>
            <tbody>
              {vm.accountability.map((r, idx) => {
                const isTop = idx === 0;
                const riskTone = r.severity === "high" ? "text-[#e11d48]" : r.severity === "medium" ? "text-amber-600" : "text-emerald-600";
                const riskDot = r.severity === "high" ? "🔴" : r.severity === "medium" ? "🟠" : "🟢";
                return (
                  <tr key={r.id} className={`border-b border-neutral-100 align-top transition-colors duration-150 hover:bg-slate-50/60 last:border-0 ${isTop ? "bg-[#fff1f2]/70" : ""}`}>
                    <td className="py-3 pr-3">
                      <div className="font-semibold text-neutral-900">{r.name}</div>
                      {isTop ? <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#e11d48]">Top offender</div> : null}
                    </td>
                    <td className="py-3 pr-3 text-neutral-700">{r.role}</td>
                    <td className={`py-3 pr-3 text-right font-mono font-bold tabular-nums ${riskTone}`}>{money(r.riskAmount)}</td>
                    <td className="py-3 pr-3 text-right font-mono font-semibold tabular-nums text-neutral-700">{r.issueCount}</td>
                    <td className={`py-3 font-semibold ${riskTone}`}>
                      {riskDot} {r.severity === "high" ? "High" : r.severity === "medium" ? "Medium" : "Low"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3. Today’s Required Actions */}
      <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-[0_1px_0_rgba(15,20,25,0.04)]">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: MUTED }}>
          3 · Today&apos;s required actions
        </h3>
        <p className="mt-1 text-[13px] leading-snug" style={{ color: MUTED }}>
          Ranked by estimated financial impact. Each row is a commitment, not a metric.
        </p>
        <ul className="mt-4 space-y-0">
          {vm.requiredActions.map((a) => (
            <li key={a.id} className="border-t border-neutral-100 py-4 transition-colors duration-150 hover:bg-slate-50/60 first:border-t-0 first:pt-0">
              <div className="space-y-1.5">
                <p className="flex flex-wrap items-baseline gap-2 text-[clamp(1rem,2.4vw,1.12rem)] font-semibold leading-snug text-neutral-950">
                  <span className="shrink-0 font-mono font-bold tabular-nums text-[#e11d48]">{money(a.impact)}</span>
                  <span className="text-neutral-400">—</span>
                  <span className="min-w-0">{a.what}</span>
                </p>
                <p className="text-[13px] font-medium text-neutral-900">
                  <span className="font-semibold text-[#e11d48]">→ Fix:</span> {a.status}
                </p>
                <div className="flex flex-wrap items-center gap-2 text-[11px] text-neutral-500">
                  <StatusPill
                    variant={
                      /complete|done|closed/i.test(a.status)
                        ? "healthy"
                        : /coach/i.test(a.status)
                          ? "watch"
                          : "at-risk"
                    }
                    label={/complete|done|closed/i.test(a.status) ? "Closed" : undefined}
                  />
                  <span>{a.who}</span>
                  <span>·</span>
                  <span>{a.deadline}</span>
                </div>
              </div>
            </li>
          ))}
        </ul>
        {vm.requiredActions.length === 0 && <p className="mt-3 text-[13px]" style={{ color: MUTED }}>No mandatory actions queued.</p>}
      </div>

      {/* 4. Confidence warnings */}
      <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-[0_1px_0_rgba(15,20,25,0.04)]">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: MUTED }}>
          4 · Confidence warnings
        </h3>
        <p className="mt-1 text-[13px] leading-snug" style={{ color: MUTED }}>
          If any item fires, downgrade trust in the headline numbers until resolved.
        </p>
        <ul className="mt-4 space-y-3">
          {vm.confidenceWarnings.map((w) => (
            <li
              key={w.id}
              className="rounded-lg border-l-[3px] px-4 py-3 transition-shadow duration-200"
              style={{ borderLeftColor: severityBorder(w.severity), background: severityBg(w.severity) }}
            >
              <div className="flex flex-wrap items-center gap-2">
                <StatusPill variant={mapConfidenceSeverityToPill(w.severity)} />
                <p className="text-[13px] font-semibold text-neutral-950">{w.title}</p>
              </div>
              <p className="mt-1 text-[12px] leading-relaxed text-neutral-800">{w.detail}</p>
              <p className="mt-2 text-[12px] font-medium leading-snug text-neutral-900">
                <span className="text-neutral-500">Do this · </span>
                {w.decision}
              </p>
            </li>
          ))}
        </ul>
        {vm.confidenceWarnings.length === 0 && (
          <p className="mt-3 text-[13px] font-medium" style={{ color: WIN }}>
            No confidence blockers detected on this snapshot—still refresh after sheet edits.
          </p>
        )}
      </div>

      {/* 5. Forecast explanation */}
      <div className="rounded-xl border border-neutral-200 bg-neutral-50/80 p-5">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: MUTED }}>
          5 · Forecast explanation
        </h3>
        <p className="mt-3 text-[18px] font-semibold tracking-tight text-neutral-950">{vm.forecast.headline}</p>
        <div className="mt-4 space-y-3 text-[14px] leading-relaxed text-neutral-800">
          {vm.forecast.paragraphs.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
        {vm.forecast.bullets.length > 0 && (
          <ul className="mt-4 list-inside list-disc space-y-2 text-[13px] leading-relaxed text-neutral-800">
            {vm.forecast.bullets.map((b, i) => (
              <li key={i}>{b}</li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
