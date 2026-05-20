"use client";

import { cn } from "@/lib/utils";
import type { SinceYesterdayPill, SinceYesterdayRowModel } from "@/src/lib/dashboard/since-yesterday";

const PILL_TONE: Record<SinceYesterdayPill["tone"], string> = {
  positive: "border-emerald-500/25 bg-emerald-950/30 text-emerald-100",
  negative: "border-rose-500/25 bg-rose-950/30 text-rose-100",
  neutral: "border-white/[0.08] bg-black/25 text-slate-200",
  "dept-sales": "border-emerald-500/30 bg-emerald-950/35 text-emerald-100",
  "dept-service": "border-amber-500/30 bg-amber-950/35 text-amber-100",
  "dept-parts": "border-rose-500/30 bg-rose-950/35 text-rose-100",
};

const VALUE_TONE: Record<SinceYesterdayPill["tone"], string> = {
  positive: "text-emerald-300",
  negative: "text-rose-300",
  neutral: "text-white",
  "dept-sales": "text-emerald-200",
  "dept-service": "text-amber-200",
  "dept-parts": "text-rose-200",
};

export function SinceYesterdayRow({ model }: { model: SinceYesterdayRowModel }) {
  if (model.status === "unavailable") {
    return null;
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Since yesterday</p>
        {model.isEstimated ? (
          <span className="text-[10px] font-medium text-slate-600">Estimated · history coming soon</span>
        ) : null}
      </div>
      <ul className="flex flex-wrap gap-2">
        {model.pills.map((pill) => (
          <li
            key={pill.id}
            className={cn(
              "min-w-[8.5rem] flex-1 rounded-lg border px-3 py-2 ring-1 ring-inset ring-white/[0.04] sm:max-w-[14rem]",
              PILL_TONE[pill.tone],
            )}
          >
            <p className="text-[9px] font-bold uppercase tracking-[0.1em] opacity-80">{pill.label}</p>
            <p className={cn("mt-0.5 font-mono text-[14px] font-semibold tabular-nums leading-tight", VALUE_TONE[pill.tone])}>
              {pill.value}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
