import { type ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { VelocityData } from "@/src/lib/velocity/get-velocity-data";
import type { MonthlyGrossDepartment } from "@/src/lib/velocity/monthly-gross/types";

export function money(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "Needs Setup";
  return `$${Math.round(value).toLocaleString()}`;
}

export function signedMoney(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "Needs Setup";
  const abs = `$${Math.round(Math.abs(value)).toLocaleString()}`;
  return value >= 0 ? `+${abs}` : `-${abs}`;
}

export function trackingLineHeadline(line: { label: string; department: MonthlyGrossDepartment }) {
  return `${line.label} – ${line.department}`;
}

export function gapTone(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "text-[#A1A1AA]";
  return value >= 0 ? "text-[#34D399]" : "text-[#FB7185]";
}

export function paceTone(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "text-[#A1A1AA]";
  if (value < 95) return "text-[#FBBF24]";
  return "text-[#34D399]";
}

export function departmentHealthFromPace(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return { label: "Needs Setup", tone: "text-[#A1A1AA]", pill: "bg-white/10 text-[#CBD5E1]" };
  }
  if (value >= 100) {
    return { label: "Ahead", tone: "text-[#34D399]", pill: "bg-emerald-500/20 text-emerald-100 ring-1 ring-emerald-400/25" };
  }
  if (value >= 90) {
    return { label: "Watch", tone: "text-[#FBBF24]", pill: "bg-amber-500/20 text-amber-100 ring-1 ring-amber-400/30" };
  }
  return { label: "At Risk", tone: "text-[#FB7185]", pill: "bg-rose-500/20 text-rose-100 ring-1 ring-rose-400/25" };
}

export const SECTION_SHELL =
  "rounded-3xl border border-white/[0.07] bg-[linear-gradient(165deg,rgba(255,255,255,0.04)_0%,rgba(255,255,255,0.015)_40%,rgba(15,23,42,0.96)_100%)] shadow-[0_20px_50px_-36px_rgba(0,0,0,0.65)]";

export function ExecSection({
  children,
  className,
  padded = true,
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return <div className={cn(SECTION_SHELL, padded && "p-5 md:p-6", className)}>{children}</div>;
}

export function SectionHeader({ kicker, title, subtitle }: { kicker?: string; title: string; subtitle?: string }) {
  return (
    <header className="mb-4 max-w-4xl border-b border-white/10 pb-3">
      {kicker ? <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">{kicker}</p> : null}
      <h2 className="mt-0.5 text-[clamp(1rem,1.5vw,1.2rem)] font-semibold tracking-tight text-white">{title}</h2>
      {subtitle ? <p className="mt-1 text-[13px] leading-snug text-slate-400">{subtitle}</p> : null}
    </header>
  );
}

export type SignalDot = "ok" | "warn" | "bad" | "neutral";

function keyActionPrioritySurface(priority: "critical" | "high" | "medium") {
  switch (priority) {
    case "critical":
      return "border-rose-500/30 bg-rose-950/30 ring-rose-500/15";
    case "high":
      return "border-amber-500/25 bg-amber-950/20 ring-amber-400/12";
    default:
      return "border-sky-500/20 bg-sky-950/15 ring-sky-400/10";
  }
}

export function KeyActionsInsights({ items }: { items: VelocityData["keyActions"] }) {
  if (!items.length) {
    return (
      <p className="text-[13px] leading-relaxed text-slate-500">
        No key actions for this snapshot — sales Notes look sufficient for handoff and headline metrics are not raising automated leadership flags.
      </p>
    );
  }
  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li
          key={item.id}
          className={cn(
            "rounded-xl border p-4 ring-1 ring-inset",
            keyActionPrioritySurface(item.priority),
          )}
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
              {item.priority === "critical" ? "Critical" : item.priority === "high" ? "High" : "Medium"}
            </p>
            <p className="text-[10px] font-medium uppercase tracking-[0.1em] text-slate-500">
              {item.sources.join(" · ")}
            </p>
          </div>
          <p className="mt-1.5 text-[15px] font-semibold leading-snug text-white">{item.headline}</p>
          <p className="mt-2 text-[13px] leading-relaxed text-slate-200/95">{item.action}</p>
          <p className="mt-2 border-t border-white/10 pt-2 text-[12px] leading-snug text-slate-400">
            <span className="font-semibold text-slate-500">Evidence: </span>
            {item.evidence}
          </p>
        </li>
      ))}
    </ul>
  );
}

export function OperationalSignalsList({ items }: { items: { text: string; dot: SignalDot }[] }) {
  if (!items.length) {
    return <p className="text-[13px] text-slate-500">No signals from current month data.</p>;
  }
  const dotClass: Record<SignalDot, string> = {
    ok: "bg-emerald-400/70",
    warn: "bg-amber-400/70",
    bad: "bg-rose-400/75",
    neutral: "bg-slate-500/70",
  };
  return (
    <ul className="space-y-2">
      {items.map((item, i) => (
        <li key={`${i}-${item.text}`} className="flex items-baseline gap-2.5 text-[13px] leading-snug text-slate-200">
          <span className={cn("mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full", dotClass[item.dot])} aria-hidden />
          <span>{item.text}</span>
        </li>
      ))}
    </ul>
  );
}
