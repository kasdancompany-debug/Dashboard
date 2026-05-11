"use client";

function monthDistance(reportingMonth: string, sourceMonth: string): number | null {
  const [ry, rm] = reportingMonth.split("-").map(Number);
  const [sy, sm] = sourceMonth.split("-").map(Number);
  if (![ry, rm, sy, sm].every((n) => Number.isFinite(n))) return null;
  return (ry - sy) * 12 + (rm - sm);
}

function monthLabel(monthKey: string) {
  const [y, m] = monthKey.split("-").map(Number);
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) return monthKey;
  const labels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${labels[m - 1]}`;
}

export function DataFreshness({
  reportingMonth,
  sources,
}: {
  reportingMonth: string;
  sources: Array<{ label: string; extractedMonthKey?: string | null }>;
}) {
  return (
    <div className="mt-2 rounded-md border border-slate-200/80 bg-slate-50/70 px-3 py-2">
      <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">Data Freshness</p>
      <ul className="mt-1 space-y-0.5 text-[12px]">
        {sources.map((s) => {
          const key = s.extractedMonthKey ?? reportingMonth;
          const d = monthDistance(reportingMonth, key);
          const status = d === 0 ? "live" : d === 1 ? "behind-1" : "outdated";
          const text =
            status === "live"
              ? `Live (${monthLabel(key)})`
              : status === "behind-1"
                ? `1 month behind (${monthLabel(key)})`
                : `Outdated (${monthLabel(key)})`;
          const tone = status === "live" ? "text-emerald-700" : status === "behind-1" ? "text-amber-700" : "text-[#e11d48]";
          return (
            <li key={s.label} className="text-slate-700">
              <span className="font-semibold">{s.label}:</span> <span className={tone}>{text}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

