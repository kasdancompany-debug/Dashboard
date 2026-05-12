"use client";

import type { BestWorstTrackingLine } from "@/src/lib/velocity/monthly-gross/types";

type BestWorstTrackingProps = {
  bestTrackingLine: BestWorstTrackingLine | null;
  worstTrackingLine: BestWorstTrackingLine | null;
  className?: string;
};

function money(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "N/A";
  return `$${Math.round(value).toLocaleString()}`;
}

function signedMoney(value: number | null) {
  if (value === null) return "N/A";
  if (value === 0) return "$0";
  return `${value > 0 ? "+" : "−"}$${Math.round(Math.abs(value)).toLocaleString()}`;
}

export function BestWorstTracking({ bestTrackingLine, worstTrackingLine, className }: BestWorstTrackingProps) {
  return (
    <section className={className}>
      <div className="grid gap-4 md:grid-cols-2">
        <article className="rounded-2xl bg-[linear-gradient(165deg,rgba(50,213,131,0.16),rgba(255,255,255,0.02)_44%),#121826] p-5 shadow-[0_24px_54px_-34px_rgba(0,0,0,0.92)]">
          <p className="exec-label text-[#32D583]">Best Tracking Line</p>
          {bestTrackingLine ? (
            <>
              <p className="mt-2 text-[24px] font-semibold text-white">
                {bestTrackingLine.label} – {bestTrackingLine.department}
              </p>
              <div className="mt-2 space-y-1 text-[13px] text-[#A1A1AA]">
                <p>
                  Tracking: <span className="font-mono text-white">{money(bestTrackingLine.trackingGross)}</span>
                </p>
                <p>
                  Target: <span className="font-mono text-white">{money(bestTrackingLine.targetGross)}</span>
                </p>
                <p>
                  Gap: <span className="font-mono text-[#32D583]">{signedMoney(bestTrackingLine.gapToTarget)}</span>
                </p>
                <p className="text-[#C7FFE3]">{bestTrackingLine.explanation}</p>
              </div>
            </>
          ) : (
            <p className="mt-2 text-[13px] text-[#A1A1AA]">No best tracking line available.</p>
          )}
        </article>

        <article className="rounded-2xl bg-[linear-gradient(165deg,rgba(255,77,109,0.20),rgba(255,181,71,0.06)_45%,rgba(255,255,255,0.02)_70%),#121826] p-5 shadow-[0_24px_54px_-34px_rgba(0,0,0,0.92)]">
          <p className="exec-label text-[#FFB547]">Worst Tracking Line</p>
          {worstTrackingLine ? (
            <>
              <p className="mt-2 text-[24px] font-semibold text-white">
                {worstTrackingLine.label} – {worstTrackingLine.department}
              </p>
              <div className="mt-2 space-y-1 text-[13px] text-[#A1A1AA]">
                <p>
                  Tracking: <span className="font-mono text-white">{money(worstTrackingLine.trackingGross)}</span>
                </p>
                <p>
                  Target: <span className="font-mono text-white">{money(worstTrackingLine.targetGross)}</span>
                </p>
                <p>
                  Gap: <span className="font-mono text-[#FF4D6D]">{signedMoney(worstTrackingLine.gapToTarget)}</span>
                </p>
                <p className="text-[#FFE9C2]">
                  Recommended focus today: {worstTrackingLine.explanation}
                </p>
              </div>
            </>
          ) : (
            <p className="mt-2 text-[13px] text-[#A1A1AA]">No worst tracking line available.</p>
          )}
        </article>
      </div>
    </section>
  );
}

