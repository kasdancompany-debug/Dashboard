"use client";

import { format } from "date-fns";
import { ArrowRight, Activity } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type PrimaryThreat = {
  title: string;
  department: string;
  impact: number;
  owner: string;
  action: string;
} | null;

type DataConfidence = {
  label: string;
  score: number;
};

type HeroCommandPanelProps = {
  primaryThreat: PrimaryThreat;
  currentProjection: number;
  targetProjection: number;
  gapToTarget: number;
  recoverableToday: number;
  dataConfidence: DataConfidence;
  lastSynced: string;
  timeline: {
    reportingMonth: string;
    daysUsed: number;
    daysAvailable: number;
    projectionBasis: string;
  };
};

function money(value: number) {
  const n = Math.round(Math.abs(value));
  const core = `$${n.toLocaleString()}`;
  if (value < 0) return `−${core}`;
  return core;
}

function signedMoney(delta: number) {
  if (delta === 0) return "$0";
  const core = `$${Math.round(Math.abs(delta)).toLocaleString()}`;
  return delta > 0 ? `+${core}` : `−${core}`;
}

export function HeroCommandPanel({
  primaryThreat,
  currentProjection,
  targetProjection,
  gapToTarget,
  recoverableToday,
  dataConfidence,
  lastSynced,
  timeline,
}: HeroCommandPanelProps) {
  const atRisk = gapToTarget < 0;
  const headline = primaryThreat?.title ?? `${money(recoverableToday)} at risk today`;
  const explanation = primaryThreat
    ? `${primaryThreat.department} is creating the primary profit threat. Owner: ${primaryThreat.owner}.`
    : "Primary threat signal is stabilizing. Keep operational controls tight through close.";

  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-3xl p-9 md:p-12",
        "bg-gradient-to-br from-[#121826] via-[#161B2E] to-[#110B1F]",
        atRisk ? "shadow-[0_30px_70px_-35px_rgba(255,77,109,0.4)]" : "shadow-[0_30px_70px_-35px_rgba(168,85,247,0.45)]",
      )}
    >
      <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-[rgba(168,85,247,0.22)] blur-3xl animate-pulse" />
      <div className="pointer-events-none absolute -right-24 bottom-0 h-64 w-64 rounded-full bg-[rgba(91,91,214,0.20)] blur-3xl animate-pulse" />
      <div className="relative grid min-h-[56vh] gap-8 lg:grid-cols-[1.3fr_1fr]">
        <div>
          <p className="velocity-metadata font-bold uppercase tracking-[0.22em] text-[#A855F7]">Sault Nissan</p>
          <p className="velocity-hero-headline mt-2 text-[#F8FAFC]">{headline}</p>
          <p className="mt-5 max-w-3xl text-[15px] leading-8 text-[#A1A1AA]">{explanation}</p>
          <p className="mt-2 text-[12px] text-[#71717A]">
            Timeline: {timeline.reportingMonth} · Day {timeline.daysUsed} of {timeline.daysAvailable} · {timeline.projectionBasis}
          </p>
          <Button className="mt-8 h-11 bg-[#8B5CF6] px-5 text-[13px] font-semibold text-[#F8FAFC] hover:bg-[#A855F7]">
            {primaryThreat?.action ?? "Execute top action"}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="rounded-2xl bg-[linear-gradient(160deg,rgba(168,85,247,0.16),rgba(255,255,255,0.02)_48%),rgba(255,255,255,0.04)] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_24px_48px_-28px_rgba(0,0,0,0.9)]">
          <div>
            <p className="exec-label">Projected Month-End Gross</p>
            <p className="exec-hero-number mt-1 text-[#F8FAFC]">{money(currentProjection)}</p>
          </div>
          <div className="mt-3 space-y-1 text-[13px] text-[#A1A1AA]">
            <p>Month target gross: <span className="font-mono font-bold text-[#F8FAFC]">{money(targetProjection)}</span></p>
            <p>Gap vs month target: <span className={cn("font-mono font-bold", atRisk ? "text-[#FF4D6D]" : "text-[#32D583]")}>{signedMoney(gapToTarget)}</span></p>
            <p>Recoverable before close today: <span className="font-mono font-bold text-[#FFB547]">{money(recoverableToday)}</span></p>
            <p>Data confidence: <span className="font-semibold text-[#A855F7]">{dataConfidence.label} ({dataConfidence.score}%)</span></p>
          </div>
          <div className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-[#A855F7]/35 bg-[#5B5BD6]/20 px-2 py-1 text-[12px] font-semibold text-[#E9D5FF]">
            <Activity className="h-3.5 w-3.5" />
            Live sync · {format(new Date(lastSynced), "h:mm a")}
          </div>
        </div>
      </div>
    </section>
  );
}
