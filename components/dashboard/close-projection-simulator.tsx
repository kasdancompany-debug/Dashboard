"use client";

import { useMemo, useState } from "react";

type ImprovementOption = {
  id: "front" | "backend" | "service" | "parts";
  label: string;
  impact: number;
};

const options: ImprovementOption[] = [
  { id: "front", label: "Fix low front deals", impact: 42000 },
  { id: "backend", label: "Improve back-end gross", impact: 18000 },
  { id: "service", label: "Optimize service performance", impact: 12000 },
  { id: "parts", label: "Improve parts execution", impact: 10000 },
];

function money(value: number) {
  return `$${Math.round(value).toLocaleString()}`;
}

export function CloseProjectionSimulator({ currentProjection }: { currentProjection: number }) {
  const [enabled, setEnabled] = useState<Record<ImprovementOption["id"], boolean>>({
    front: true,
    backend: false,
    service: true,
    parts: false,
  });

  const delta = useMemo(
    () =>
      options.reduce((sum, option) => {
        return enabled[option.id] ? sum + option.impact : sum;
      }, 0),
    [enabled],
  );

  const improvedProjection = currentProjection + delta;
  const roundedCurrent = Math.round(currentProjection / 1000);
  const roundedImproved = Math.round(improvedProjection / 1000);
  const targetClose = 500000;

  return (
    <section className="rounded-xl border border-slate-300 bg-white p-6 shadow-[var(--shadow-sm-subtle)]">
      <h2 className="text-[28px] font-semibold tracking-tight text-slate-950">Close Projection Simulator</h2>
      <p className="mt-2 text-[17px] text-slate-700">Toggle execution improvements to simulate projected month-end close.</p>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {options.map((option) => (
          <label key={option.id} className="flex cursor-pointer items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
            <div>
              <p className="text-[15px] font-semibold text-slate-900">{option.label}</p>
              <p className="text-[13px] text-slate-600">Impact +{money(option.impact)}</p>
            </div>
            <input
              type="checkbox"
              checked={enabled[option.id]}
              onChange={(e) => setEnabled((prev) => ({ ...prev, [option.id]: e.target.checked }))}
              className="h-4 w-4 accent-[#C3002F]"
            />
          </label>
        ))}
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-[12px] font-semibold tracking-[0.08em] text-slate-500">Current Projection</p>
          <p className="text-[30px] font-bold tracking-[-0.03em] text-slate-950">{money(currentProjection)}</p>
        </div>
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
          <p className="text-[12px] font-semibold tracking-[0.08em] text-emerald-800">Improved Projection</p>
          <p className="text-[30px] font-bold tracking-[-0.03em] text-emerald-900">{money(improvedProjection)}</p>
        </div>
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-[12px] font-semibold tracking-[0.08em] text-amber-800">Delta</p>
          <p className="text-[30px] font-bold tracking-[-0.03em] text-amber-900">+{money(delta)}</p>
        </div>
      </div>

      <div className="mt-4 rounded-lg border border-slate-300 bg-slate-100 px-4 py-3">
        <p className="text-[12px] font-semibold tracking-[0.08em] text-slate-500">PROJECTED CLOSE</p>
        <p className="text-[20px] font-bold tracking-[-0.02em] text-slate-950">
          ${roundedCurrent}k → ${roundedImproved}k → ${Math.round(targetClose / 1000)}k
        </p>
      </div>
    </section>
  );
}
