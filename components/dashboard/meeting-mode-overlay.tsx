"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, CircleDot, Maximize2, Minimize2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { BestWorstTrackingLine, DepartmentGrossTracking, MonthlyGrossTracking } from "@/src/lib/velocity/monthly-gross/types";

type SignalDot = "ok" | "warn" | "bad" | "neutral";

type DeptKey = "Sales" | "Service" | "Parts";

export type MeetingModePayload = {
  monthTitle: string;
  lastSyncedLabel: string;
  monthly: MonthlyGrossTracking;
  salesDisplay: DepartmentGrossTracking | null | undefined;
  service: DepartmentGrossTracking | null | undefined;
  parts: DepartmentGrossTracking | null | undefined;
  worst: BestWorstTrackingLine | null;
  best: BestWorstTrackingLine | null;
  bestDepartmentTotal: DepartmentGrossTracking | null;
  worstDepartmentTotal: DepartmentGrossTracking | null;
  operationalSignals: { text: string; dot: SignalDot }[];
  totalPace: number | null;
};

const SLIDE_COUNT = 4;

function isTypingTarget(el: EventTarget | null) {
  const t = el as HTMLElement | null;
  return !!t?.closest("input, textarea, select, [contenteditable='true']");
}

function getFullscreenElement(): Element | null {
  const doc = document as Document & { webkitFullscreenElement?: Element | null };
  return document.fullscreenElement ?? doc.webkitFullscreenElement ?? null;
}

async function enterFullscreen(el: HTMLElement) {
  const anyEl = el as HTMLElement & { webkitRequestFullscreen?: () => void };
  try {
    if (anyEl.requestFullscreen) {
      await anyEl.requestFullscreen();
    } else if (anyEl.webkitRequestFullscreen) {
      anyEl.webkitRequestFullscreen();
    }
  } catch {
    /* user gesture or policy */
  }
}

async function exitFullscreenDoc() {
  const doc = document as Document & { webkitExitFullscreen?: () => void };
  try {
    if (!getFullscreenElement()) return;
    if (typeof document.exitFullscreen === "function") {
      await document.exitFullscreen();
    } else if (typeof doc.webkitExitFullscreen === "function") {
      doc.webkitExitFullscreen();
    }
  } catch {
    /* ignore */
  }
}

function money(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "—";
  return `$${Math.round(value).toLocaleString()}`;
}

function signedMoney(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "—";
  const abs = `$${Math.round(Math.abs(value)).toLocaleString()}`;
  return value >= 0 ? `+${abs}` : `-${abs}`;
}

function pacePresentationClass(pace: number | null) {
  if (pace === null || !Number.isFinite(pace)) return "text-stone-500";
  if (pace >= 95) return "text-emerald-700";
  if (pace >= 90) return "text-amber-700";
  return "text-red-700";
}

function gapPresentationClass(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "text-stone-500";
  return value >= 0 ? "text-emerald-700" : "text-red-700";
}

function leadershipLabel(pace: number | null): "Healthy" | "Watch" | "At Risk" | "—" {
  if (pace === null || !Number.isFinite(pace)) return "—";
  if (pace >= 100) return "Healthy";
  if (pace >= 90) return "Watch";
  return "At Risk";
}

function leadershipBadgeClass(label: ReturnType<typeof leadershipLabel>) {
  if (label === "Healthy") return "bg-emerald-600/12 text-emerald-900 ring-1 ring-emerald-700/20";
  if (label === "Watch") return "bg-amber-500/15 text-amber-950 ring-1 ring-amber-700/25";
  if (label === "At Risk") return "bg-red-600/10 text-red-900 ring-1 ring-red-700/20";
  return "bg-stone-200/80 text-stone-600 ring-1 ring-stone-400/25";
}

function clampPct(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, n));
}

type BarTone = "positive" | "watch" | "risk" | "neutral";

function barFillClass(tone: BarTone) {
  if (tone === "positive") return "bg-emerald-600";
  if (tone === "watch") return "bg-amber-500";
  if (tone === "risk") return "bg-red-600";
  return "bg-stone-600";
}

function MiniBar({ pct, tone, className }: { pct: number; tone: BarTone; className?: string }) {
  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-stone-200/95 transition-[width] duration-500 ease-out", className)}>
      <div className={cn("h-full rounded-full transition-[width] duration-700 ease-out", barFillClass(tone))} style={{ width: `${clampPct(pct)}%` }} />
    </div>
  );
}

function trackingVsTargetPct(tracking: number | null, target: number) {
  if (!target || !Number.isFinite(target)) return 0;
  const t = tracking === null || !Number.isFinite(tracking) ? 0 : tracking;
  return (t / target) * 100;
}

function paceBarPct(pace: number | null) {
  if (pace === null || !Number.isFinite(pace)) return 0;
  return Math.min(100, pace);
}

/** Wide stage for conference displays — capped so type stays legible at distance. */
const STAGE_MAX = "max-w-[min(95vw,120rem)]";

function BriefSlide({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex min-h-0 w-full flex-1 flex-col items-center py-1 md:py-1.5", className)}>
      <div className={cn("flex w-full flex-1 flex-col gap-2.5 md:gap-3", STAGE_MAX)}>{children}</div>
    </div>
  );
}

function SlideHead({ eyebrow, title, strap }: { eyebrow: string; title: string; strap?: string }) {
  return (
    <header className="shrink-0 space-y-0.5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-stone-500">{eyebrow}</p>
      <h2 className="text-balance font-serif text-[clamp(1.25rem,2.4vw,2.35rem)] font-semibold leading-tight tracking-tight text-stone-950">{title}</h2>
      {strap ? <p className="pt-1 text-[13px] leading-snug text-stone-600">{strap}</p> : null}
      <div className="mt-2 h-px w-14 bg-stone-900/80" aria-hidden />
    </header>
  );
}

function TakeawayCallout({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-2xl border border-stone-800/75",
        "bg-gradient-to-br from-[#2a2724] via-[#1c1917] to-[#0f0e0c]",
        "shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_32px_100px_-40px_rgba(0,0,0,0.65)]",
      )}
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-200/25 to-transparent"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute bottom-0 left-0 top-0 w-px bg-gradient-to-b from-amber-400/50 via-amber-500/12 to-transparent md:w-[3px]"
        aria-hidden
      />

      <header className="relative flex items-center gap-4 border-b border-white/[0.07] px-5 py-4 md:gap-5 md:px-8 md:py-5">
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-b from-white/[0.12] to-white/[0.03] ring-1 ring-inset ring-white/15 shadow-sm md:h-12 md:w-12"
          aria-hidden
        >
          <CircleDot className="h-5 w-5 text-amber-400 md:h-6 md:w-6" strokeWidth={2} />
        </div>
        <p className="min-w-0 text-balance font-sans text-[12px] font-semibold uppercase leading-snug tracking-[0.2em] text-stone-200 md:text-[13px] md:tracking-[0.24em]">
          {label}
        </p>
      </header>
      <div className="relative px-5 py-5 md:px-8 md:py-8">{children}</div>
    </section>
  );
}

/** Large, readable takeaway lines for TV / conference room distance. */
function TakeawayBulletList({
  lines,
  emptyMessage = "Nothing to highlight for this snapshot.",
  divided = false,
}: {
  lines: string[];
  emptyMessage?: string;
  divided?: boolean;
}) {
  if (!lines.length) {
    return (
      <p className="text-[clamp(1.05rem,1.65vw,1.4rem)] font-medium leading-relaxed text-stone-500">{emptyMessage}</p>
    );
  }

  return (
    <ul
      className={cn(
        "m-0 list-none p-0",
        divided ? "divide-y divide-white/[0.08]" : "flex flex-col gap-4 md:gap-6",
      )}
    >
      {lines.map((line) => (
        <li
          key={line}
          className={cn(
            "flex gap-4 md:gap-5",
            divided && "py-4 first:pt-0 last:pb-0 md:py-5 md:first:pt-0 md:last:pb-0",
          )}
        >
          <span
            className="mt-[0.5em] h-2 w-2 shrink-0 rounded-full bg-amber-400 shadow-[0_0_0_4px_rgba(251,191,36,0.12)] md:mt-[0.48em]"
            aria-hidden
          />
          <span className="min-w-0 text-balance text-[clamp(1.08rem,1.9vw,1.6rem)] font-medium leading-snug tracking-tight text-[#fafaf9] md:leading-snug">
            {line}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Month completion ring — conic-gradient only, no fabricated data. */
function MonthProgressRing({ pct }: { pct: number }) {
  const p = clampPct(pct);
  return (
    <div
      className="relative mx-auto h-[7.5rem] w-[7.5rem] shrink-0 rounded-full shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)] transition-transform duration-500 ease-out md:h-[8.25rem] md:w-[8.25rem]"
      style={{
        background: `conic-gradient(#292524 ${p}%, #e7e5e4 0)`,
      }}
    >
      <div className="absolute inset-[11px] flex flex-col items-center justify-center rounded-full bg-[#f2f0ea] text-center md:inset-[12px]">
        <p className="font-mono text-2xl font-semibold tabular-nums text-stone-900 md:text-[1.65rem]">{Math.round(p)}%</p>
        <p className="text-[9px] font-medium uppercase tracking-[0.14em] text-stone-500">Month</p>
      </div>
    </div>
  );
}

function buildStoreTakeaways(p: MeetingModePayload): string[] {
  const { monthly, totalPace, salesDisplay, service, parts } = p;
  const lines: string[] = [];
  if (totalPace !== null && Number.isFinite(totalPace)) {
    lines.push(`Store pacing ${Math.round(totalPace)}% to month-end.`);
  }
  const g = monthly.totalGapToTarget;
  if (g !== null && Number.isFinite(g)) {
    lines.push(
      g >= 0 ? `Total gross ahead of target by ${money(Math.abs(g))}.` : `Total gross behind target by ${money(Math.abs(g))}.`,
    );
  }
  const sg = salesDisplay?.gapToTarget;
  const pg = parts?.gapToTarget;
  if (
    sg !== null &&
    sg !== undefined &&
    pg !== null &&
    pg !== undefined &&
    Number.isFinite(sg) &&
    Number.isFinite(pg) &&
    sg > 0 &&
    pg < 0
  ) {
    lines.push("Sales ahead of department target; Parts below department target.");
  } else if (parts?.gapToTarget !== null && parts?.gapToTarget !== undefined && Number.isFinite(parts.gapToTarget) && parts.gapToTarget < 0) {
    lines.push(`Parts department gap ${signedMoney(parts.gapToTarget)} vs target.`);
  }
  const sp = service?.pacePercent;
  if (sp !== null && sp !== undefined && Number.isFinite(sp) && sp < 90) {
    lines.push(`Service pace ${Math.round(sp)}% — below 90% watch threshold.`);
  }
  return lines.slice(0, 4);
}

function buildDepartmentBullets(p: MeetingModePayload): string[] {
  const { salesDisplay, service, parts } = p;
  const rows: { key: DeptKey; dept: DepartmentGrossTracking | null | undefined }[] = [
    { key: "Sales", dept: salesDisplay },
    { key: "Service", dept: service },
    { key: "Parts", dept: parts },
  ];
  const tracking = rows.map((r) => ({ key: r.key, v: r.dept?.trackingGross ?? 0 }));
  const maxKey = tracking.reduce((a, b) => (b.v > a.v ? b : a), tracking[0]).key;
  const lines: string[] = [];
  if (maxKey && tracking.some((t) => t.v > 0)) {
    lines.push(`${maxKey} carrying largest share of projected gross.`);
  }
  if (service?.pacePercent !== null && service?.pacePercent !== undefined && Number.isFinite(service.pacePercent) && service.pacePercent < 95) {
    lines.push(`Service at ${Math.round(service.pacePercent)}% pace — tighten advisor throughput.`);
  }
  if (parts?.gapToTarget !== null && parts?.gapToTarget !== undefined && Number.isFinite(parts.gapToTarget) && parts.gapToTarget < 0) {
    lines.push(`Parts materially under target (${signedMoney(parts.gapToTarget)}).`);
  }
  if (salesDisplay?.pacePercent !== null && salesDisplay?.pacePercent !== undefined && Number.isFinite(salesDisplay.pacePercent) && salesDisplay.pacePercent >= 100) {
    lines.push(`Sales at ${Math.round(salesDisplay.pacePercent)}% pace — maintain current discipline.`);
  }
  return lines.slice(0, 4);
}

function buildRiskStrengthBullets(p: MeetingModePayload): string[] {
  const { worst, best, worstDepartmentTotal } = p;
  const lines: string[] = [];
  if (worst?.label) {
    lines.push(`${worst.department} · ${worst.label}: gap ${signedMoney(worst.gapToTarget)} vs line target.`);
  }
  if (best?.label) {
    lines.push(`${best.department} · ${best.label}: strongest line (${signedMoney(best.gapToTarget)} vs target).`);
  }
  if (worstDepartmentTotal?.department) {
    lines.push(`${worstDepartmentTotal.department} department needs attention (${signedMoney(worstDepartmentTotal.gapToTarget)} vs dept target).`);
  }
  return lines.slice(0, 4);
}

function buildTodayFocusItems(p: MeetingModePayload): string[] {
  const { operationalSignals, monthly, worstDepartmentTotal } = p;
  const fromSignals = operationalSignals.map((s) => s.text);
  const extra: string[] = [];
  const g = monthly.totalGapToTarget;
  if (g !== null && Number.isFinite(g) && !fromSignals.some((t) => t.toLowerCase().includes("total gross"))) {
    extra.push(`Total gross ${signedMoney(g)} vs target.`);
  }
  if (
    worstDepartmentTotal &&
    !fromSignals.some((t) => t.toLowerCase().includes(worstDepartmentTotal.department.toLowerCase())) &&
    worstDepartmentTotal.gapToTarget !== null &&
    worstDepartmentTotal.gapToTarget < 0
  ) {
    extra.push(`Review ${worstDepartmentTotal.department} gap ${signedMoney(worstDepartmentTotal.gapToTarget)} vs target.`);
  }
  const merged = [...fromSignals, ...extra];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const line of merged) {
    if (out.length >= 5) break;
    if (seen.has(line)) continue;
    seen.add(line);
    out.push(line);
  }
  return out;
}

function lineVsTargetTone(gap: number | null): BarTone {
  if (gap === null || !Number.isFinite(gap)) return "neutral";
  return gap >= 0 ? "positive" : "risk";
}

function Slide1StoreOverview({ p }: { p: MeetingModePayload }) {
  const { monthly, monthTitle, totalPace } = p;
  const gap = monthly.totalGapToTarget;
  const dayPct = monthly.daysAvailable > 0 ? (monthly.daysUsed / monthly.daysAvailable) * 100 : 0;
  const paceStr = totalPace === null || !Number.isFinite(totalPace) ? "—" : `${Math.round(totalPace)}%`;
  const paceTone: BarTone =
    totalPace === null || !Number.isFinite(totalPace) ? "neutral" : totalPace >= 95 ? "positive" : totalPace >= 90 ? "watch" : "risk";
  const takeaways = buildStoreTakeaways(p);

  return (
    <BriefSlide>
      <SlideHead
        eyebrow="Store overview"
        title={monthTitle}
        strap="Headline metric first — then how the month is pacing vs published targets."
      />

      {/* Primary focal: one composed surface */}
      <div className="rounded-2xl border border-stone-200/90 bg-white/90 p-3.5 shadow-[0_1px_0_rgba(0,0,0,0.04),0_18px_48px_-36px_rgba(0,0,0,0.12)] md:p-4">
        <div className="grid grid-cols-1 items-stretch gap-4 sm:grid-cols-[7.5rem_1fr] sm:gap-5 md:grid-cols-[8.25rem_1fr]">
          <div className="flex justify-center sm:justify-start">
            <MonthProgressRing pct={dayPct} />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-stone-500">Projected gross</p>
            <p className="mt-0.5 font-mono text-[clamp(1.75rem,4.5vw,3.5rem)] font-semibold tabular-nums leading-none tracking-tight text-stone-950 transition-opacity duration-500">
              {money(monthly.totalTrackingGross)}
            </p>
            <div className="mt-3 grid grid-cols-3 gap-2 border-t border-stone-200/80 pt-3">
              <div>
                <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-stone-500">Pace</p>
                <p className={cn("mt-0.5 font-mono text-sm font-semibold tabular-nums", pacePresentationClass(totalPace))}>{paceStr}</p>
                <MiniBar className="mt-1.5" pct={paceBarPct(totalPace)} tone={paceTone} />
              </div>
              <div>
                <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-stone-500">Gap</p>
                <p className={cn("mt-0.5 font-mono text-sm font-semibold tabular-nums", gapPresentationClass(gap))}>
                  {signedMoney(monthly.totalGapToTarget)}
                </p>
              </div>
              <div>
                <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-stone-500">Days</p>
                <p className="mt-0.5 font-mono text-sm font-semibold tabular-nums text-stone-900">
                  {monthly.daysUsed}
                  <span className="text-stone-400">/</span>
                  {monthly.daysAvailable}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <TakeawayCallout label="Discussion — what to say">
        <TakeawayBulletList
          lines={takeaways}
          emptyMessage="No automated takeaway lines for this month snapshot."
        />
      </TakeawayCallout>
    </BriefSlide>
  );
}

const DEPT_RING: Record<DeptKey, string> = {
  Sales: "ring-emerald-700/25",
  Service: "ring-amber-700/25",
  Parts: "ring-rose-700/25",
};

const DEPT_BAR: Record<DeptKey, string> = {
  Sales: "bg-emerald-600",
  Service: "bg-amber-500",
  Parts: "bg-rose-600",
};

function Slide2DepartmentHealth({ p }: { p: MeetingModePayload }) {
  const rows: { key: DeptKey; dept: DepartmentGrossTracking | null | undefined }[] = [
    { key: "Sales", dept: p.salesDisplay },
    { key: "Service", dept: p.service },
    { key: "Parts", dept: p.parts },
  ];
  const values = rows.map((r) => Math.max(0, r.dept?.trackingGross ?? 0));
  const bullets = buildDepartmentBullets(p);

  return (
    <BriefSlide>
      <SlideHead
        eyebrow="Department health"
        title="Pace posture by department"
        strap="Compare projected gross mix, then land the story in three bullets."
      />

      <div className="rounded-2xl border border-stone-200/90 bg-white/90 p-3 shadow-[0_1px_0_rgba(0,0,0,0.04)] md:p-3.5">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-2">
          {rows.map(({ key, dept }) => {
            const pace = dept?.pacePercent ?? null;
            const label = leadershipLabel(pace);
            const tr = dept?.trackingGross ?? null;
            const paceTone: BarTone =
              pace === null || !Number.isFinite(pace) ? "neutral" : pace >= 95 ? "positive" : pace >= 90 ? "watch" : "risk";
            return (
              <div
                key={key}
                className={cn(
                  "flex min-w-0 flex-col rounded-lg border border-stone-200/80 bg-stone-50/50 p-2.5 ring-1 ring-inset ring-black/[0.02]",
                  DEPT_RING[key],
                )}
              >
                <div className="flex items-start justify-between gap-1.5">
                  <p className="font-serif text-base font-semibold text-stone-950">{key}</p>
                  <span className={cn("shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold tracking-tight", leadershipBadgeClass(label))}>
                    {label}
                  </span>
                </div>
                <p className="mt-1.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-stone-500">Projected</p>
                <p className="font-mono text-lg font-semibold tabular-nums leading-tight text-stone-900">{money(tr)}</p>
                <p className="mt-2 text-[9px] font-semibold uppercase tracking-[0.12em] text-stone-500">Pace</p>
                <p className={cn("font-mono text-xs font-semibold tabular-nums", pacePresentationClass(pace))}>
                  {pace === null || !Number.isFinite(pace) ? "—" : `${Math.round(pace)}%`}
                </p>
                <MiniBar className="mt-1" pct={paceBarPct(pace)} tone={paceTone} />
              </div>
            );
          })}
        </div>

        <div className="mt-3 border-t border-stone-200/80 pt-3">
          <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-stone-500">Projected gross mix</p>
          <div className="mt-1.5 flex h-8 w-full overflow-hidden rounded-md bg-stone-200/90 ring-1 ring-inset ring-stone-300/40">
            {rows.map(({ key }, i) => {
              const v = values[i] ?? 0;
              const flexGrow = v > 0 ? v : 0;
              return (
                <div
                  key={key}
                  className={cn("flex min-w-0 items-center justify-center px-0.5 transition-[flex-grow] duration-700 ease-out", DEPT_BAR[key])}
                  style={{ flex: `${flexGrow} 1 0` }}
                  title={`${key}: ${money(rows[i]!.dept?.trackingGross ?? null)}`}
                >
                  {v > 0 ? <span className="truncate text-[9px] font-bold text-white/95">{key}</span> : null}
                </div>
              );
            })}
          </div>
          <div className="mt-1.5 grid grid-cols-3 gap-1 text-center text-[9px] font-medium tabular-nums text-stone-600">
            {rows.map(({ key }, i) => (
              <span key={key} className="min-w-0 truncate">
                {key} {money(rows[i]!.dept?.trackingGross ?? null)}
              </span>
            ))}
          </div>
        </div>
      </div>

      <TakeawayCallout label="Operational read — for the room">
        <TakeawayBulletList lines={bullets} emptyMessage="No department readouts for this snapshot." />
      </TakeawayCallout>
    </BriefSlide>
  );
}

function SplitLinePanel({
  title,
  line,
  variant,
  embedded,
}: {
  title: string;
  line: BestWorstTrackingLine | null;
  variant: "strength" | "concern";
  embedded?: boolean;
}) {
  const accent = variant === "strength" ? "border-l-[3px] border-l-emerald-600" : "border-l-[3px] border-l-red-600";
  const wash = variant === "strength" ? "from-emerald-50/50" : "from-red-50/40";
  if (!line) {
    return (
      <div
        className={cn(
          "relative flex min-h-[9.5rem] flex-col bg-white/95 p-3 md:min-h-0 md:p-3.5",
          embedded ? "rounded-none border-0" : "rounded-xl border border-stone-200/90",
          accent,
        )}
      >
        <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-stone-500">{title}</p>
        <p className="mt-2 text-[13px] leading-snug text-stone-500">No line in this bucket for the workbook month.</p>
      </div>
    );
  }
  const tr = line.trackingGross;
  const tgt = line.targetGross;
  const tv = trackingVsTargetPct(tr, tgt);
  const gap = line.gapToTarget;
  const pace = line.pacePercent;
  const paceTone: BarTone = pace === null || !Number.isFinite(pace) ? "neutral" : pace >= 95 ? "positive" : pace >= 90 ? "watch" : "risk";

  return (
    <div
      className={cn(
        "relative flex min-h-0 flex-1 flex-col overflow-hidden bg-white p-3 md:p-3.5",
        embedded ? "rounded-none border-0" : "rounded-xl border border-stone-200/90",
        accent,
      )}
    >
      <div className={cn("pointer-events-none absolute inset-0 bg-gradient-to-br to-transparent opacity-[0.65]", wash)} />
      <div className="relative flex min-h-0 flex-1 flex-col">
        <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-stone-500">{title}</p>
        <p className="mt-1 font-serif text-base font-semibold leading-snug text-stone-950 md:text-lg">
          {line.department} · {line.label}
        </p>
        <p className={cn("mt-2 font-mono text-xl font-semibold tabular-nums md:text-2xl", gapPresentationClass(gap))}>{signedMoney(gap)}</p>
        <div className="mt-3 flex flex-1 flex-col justify-end space-y-2 border-t border-stone-200/70 pt-2.5">
          <div>
            <div className="mb-1 flex justify-between text-[9px] font-semibold uppercase tracking-[0.1em] text-stone-500">
              <span>Tracking vs target</span>
              <span className="font-mono font-medium normal-case tabular-nums text-stone-800">
                {money(tr)} / {money(tgt)}
              </span>
            </div>
            <MiniBar pct={clampPct(tv)} tone={lineVsTargetTone(gap)} />
          </div>
          {pace !== null && Number.isFinite(pace) ? (
            <div>
              <div className="mb-1 flex justify-between text-[9px] font-semibold uppercase tracking-[0.1em] text-stone-500">
                <span>Line pace</span>
                <span className="font-mono font-medium normal-case tabular-nums text-stone-800">{Math.round(pace)}%</span>
              </div>
              <MiniBar pct={paceBarPct(pace)} tone={paceTone} />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Slide3OpportunitiesRisks({ p }: { p: MeetingModePayload }) {
  const { worst, best } = p;
  const bullets = buildRiskStrengthBullets(p);

  return (
    <BriefSlide>
      <SlideHead
        eyebrow="Opportunities & risks"
        title="Strength on the left, exposure on the right"
        strap="One focal comparison — then align the room on the same three facts."
      />

      <div className="overflow-hidden rounded-2xl border border-stone-200/90 bg-white/95 shadow-[0_1px_0_rgba(0,0,0,0.04)]">
        <div className="grid grid-cols-1 divide-y divide-stone-200/90 md:grid-cols-2 md:divide-x md:divide-y-0">
          <SplitLinePanel title="Biggest strength" line={best} variant="strength" embedded />
          <SplitLinePanel title="Biggest concern" line={worst} variant="concern" embedded />
        </div>
      </div>

      <TakeawayCallout label="Operational read — align the story">
        <TakeawayBulletList lines={bullets} emptyMessage="No strength or risk lines for this workbook month." />
      </TakeawayCallout>
    </BriefSlide>
  );
}

function Slide4ActionFocus({ p }: { p: MeetingModePayload }) {
  const items = buildTodayFocusItems(p);

  return (
    <BriefSlide>
      <SlideHead
        eyebrow="Action focus"
        title="Today's focus"
        strap="End the briefing with explicit priorities — only signals already in the data."
      />

      <TakeawayCallout label="Meeting priorities — assign owners">
        <TakeawayBulletList
          lines={items}
          divided
          emptyMessage="No additional focus lines beyond prior slides."
        />
      </TakeawayCallout>
    </BriefSlide>
  );
}

type MeetingModeOverlayProps = {
  open: boolean;
  onClose: () => void;
  payload: MeetingModePayload;
};

function slideDeckMotionClass(enter: "forward" | "back" | "none") {
  const ease = "ease-[cubic-bezier(0.22,1,0.36,1)]";
  if (enter === "forward") {
    return cn("animate-in fade-in-0 slide-in-from-right-8 duration-500", ease, "motion-reduce:animate-none motion-reduce:opacity-100");
  }
  if (enter === "back") {
    return cn("animate-in fade-in-0 slide-in-from-left-8 duration-500", ease, "motion-reduce:animate-none motion-reduce:opacity-100");
  }
  return cn("animate-in fade-in duration-450 ease-out", "motion-reduce:animate-none motion-reduce:opacity-100");
}

type SlideDeckState = { index: number; enter: "forward" | "back" | "none" };

export function MeetingModeOverlay({ open, onClose, payload }: MeetingModeOverlayProps) {
  const [deck, setDeck] = useState<SlideDeckState>({ index: 0, enter: "none" });
  const [browserFullscreen, setBrowserFullscreen] = useState(false);
  const shellRef = useRef<HTMLDivElement>(null);

  const slideIndex = deck.index;
  const slideEnter = deck.enter;

  const goToSlide = useCallback((target: number) => {
    const clamped = Math.max(0, Math.min(SLIDE_COUNT - 1, target));
    setDeck((prev) => {
      if (prev.index === clamped) return prev;
      const enter = clamped > prev.index ? "forward" : "back";
      return { index: clamped, enter };
    });
  }, []);

  const goNext = useCallback(() => {
    setDeck((prev) => {
      const next = Math.min(SLIDE_COUNT - 1, prev.index + 1);
      if (next === prev.index) return prev;
      return { index: next, enter: "forward" };
    });
  }, []);

  const goPrev = useCallback(() => {
    setDeck((prev) => {
      const next = Math.max(0, prev.index - 1);
      if (next === prev.index) return prev;
      return { index: next, enter: "back" };
    });
  }, []);

  const closeBriefing = useCallback(async () => {
    await exitFullscreenDoc();
    onClose();
  }, [onClose]);

  const toggleBrowserFullscreen = useCallback(async () => {
    const el = shellRef.current;
    if (!el) return;
    if (getFullscreenElement() === el) {
      await exitFullscreenDoc();
    } else {
      await enterFullscreen(el);
    }
  }, []);

  useEffect(() => {
    const sync = () => {
      const fsEl = getFullscreenElement();
      const shell = shellRef.current;
      setBrowserFullscreen(!!shell && fsEl === shell);
    };
    document.addEventListener("fullscreenchange", sync);
    document.addEventListener("webkitfullscreenchange", sync);
    return () => {
      document.removeEventListener("fullscreenchange", sync);
      document.removeEventListener("webkitfullscreenchange", sync);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        void closeBriefing();
        return;
      }
      if (e.key === " ") {
        if (isTypingTarget(e.target)) return;
        e.preventDefault();
        goNext();
        return;
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        goNext();
        return;
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        goPrev();
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [open, closeBriefing, goNext, goPrev]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      void exitFullscreenDoc();
      queueMicrotask(() => {
        setBrowserFullscreen(false);
        setDeck({ index: 0, enter: "none" });
      });
    }
  }, [open]);

  if (!open) return null;
  if (typeof document === "undefined") return null;

  const slide = (() => {
    switch (slideIndex) {
      case 0:
        return <Slide1StoreOverview p={payload} />;
      case 1:
        return <Slide2DepartmentHealth p={payload} />;
      case 2:
        return <Slide3OpportunitiesRisks p={payload} />;
      case 3:
        return <Slide4ActionFocus p={payload} />;
      default:
        return null;
    }
  })();

  const overlay = (
    <div
      ref={shellRef}
      className="fixed inset-0 isolate z-[200] flex flex-col bg-[#f2f0ea] text-stone-900 antialiased"
      style={{ colorScheme: "light" }}
      role="dialog"
      aria-modal="true"
      aria-label="Meeting briefing"
    >
      <header className="shrink-0 border-b border-stone-200/80 bg-white/92 px-4 py-2 backdrop-blur-sm md:px-6">
        <div className={cn("mx-auto flex w-full items-center justify-between gap-3", STAGE_MAX)}>
          <div className="min-w-0">
            <p className="truncate text-[10px] font-semibold uppercase tracking-[0.2em] text-stone-400">Briefing</p>
            <p className="truncate text-[13px] font-medium text-stone-800">{payload.monthTitle}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 border-stone-300/90 bg-white px-2.5 text-stone-700 shadow-none hover:bg-stone-50"
              onClick={() => void toggleBrowserFullscreen()}
              aria-pressed={browserFullscreen}
              aria-label={browserFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            >
              {browserFullscreen ? <Minimize2 className="mr-1 h-3.5 w-3.5" /> : <Maximize2 className="mr-1 h-3.5 w-3.5" />}
              <span className="text-[11px] font-medium">{browserFullscreen ? "Exit" : "Fullscreen"}</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 border-stone-300/90 bg-white px-2.5 text-stone-800 shadow-none hover:bg-stone-50"
              onClick={() => void closeBriefing()}
            >
              <X className="mr-1 h-3.5 w-3.5" aria-hidden />
              <span className="text-[11px] font-medium">Exit</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-[radial-gradient(ellipse_120%_80%_at_50%_-20%,rgba(41,37,36,0.04),transparent_55%)]">
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-4 pb-1 pt-1 md:px-6 md:pb-2 md:pt-2">
          <div
            key={slideIndex}
            className={cn("flex min-h-full flex-col items-stretch will-change-transform", slideDeckMotionClass(slideEnter))}
            aria-live="polite"
          >
            {slide}
          </div>
        </div>

        <div className="shrink-0 border-t border-stone-200/80 bg-[#f2f0ea]/98 px-4 pb-3 pt-2.5 backdrop-blur-sm md:px-6 md:pb-4 md:pt-3">
          <nav className={cn("mx-auto flex w-full items-center justify-between gap-3", STAGE_MAX)} aria-label="Slides">
            <button
              type="button"
              onClick={goPrev}
              disabled={slideIndex === 0}
              className="inline-flex items-center gap-1 rounded-full px-3 py-2 text-[13px] font-medium text-stone-700 transition-[transform,colors] duration-200 ease-out hover:bg-stone-200/50 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-30 motion-reduce:transition-colors motion-reduce:active:scale-100"
              aria-label="Previous slide"
            >
              <ChevronLeft className="h-4 w-4" strokeWidth={1.75} />
              Back
            </button>
            <div className="flex items-center gap-1.5">
              {Array.from({ length: SLIDE_COUNT }, (_, i) => (
                <button
                  key={i}
                  type="button"
                  aria-label={`Slide ${i + 1}`}
                  aria-current={slideIndex === i ? "step" : undefined}
                  onClick={() => goToSlide(i)}
                  className={cn(
                    "h-1.5 rounded-full transition-all duration-300 ease-out motion-reduce:transition-colors",
                    slideIndex === i ? "w-7 scale-y-110 bg-stone-800" : "w-1.5 bg-stone-300 hover:bg-stone-400",
                  )}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={goNext}
              disabled={slideIndex === SLIDE_COUNT - 1}
              className="inline-flex items-center gap-1 rounded-full px-3 py-2 text-[13px] font-medium text-stone-700 transition-[transform,colors] duration-200 ease-out hover:bg-stone-200/50 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-30 motion-reduce:transition-colors motion-reduce:active:scale-100"
              aria-label="Next slide"
            >
              Next
              <ChevronRight className="h-4 w-4" strokeWidth={1.75} />
            </button>
          </nav>
          <p className={cn("mx-auto mt-2 text-center text-[10px] text-stone-400 md:text-[11px]", STAGE_MAX)}>
            <span className="hidden sm:inline">Space or → next · ← back · Esc closes</span>
            <span className="sm:hidden">Keyboard when available</span>
            {browserFullscreen ? <span className="sm:ml-1"> · Fullscreen</span> : null}
          </p>
          <p className={cn("mx-auto mt-1 text-center text-[10px] text-stone-400", STAGE_MAX)}>{payload.lastSyncedLabel}</p>
        </div>
      </main>
    </div>
  );

  return createPortal(overlay, document.body);
}
