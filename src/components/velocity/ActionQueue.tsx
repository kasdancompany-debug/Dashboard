"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ActionQueueItem = {
  id: string;
  rank: number;
  department: "Sales" | "Service" | "Parts" | "Store";
  title: string;
  severity: "low" | "medium" | "high";
  dollarImpact: number;
  owner: string;
  people?: string[];
  whyItMatters: string;
  recommendedAction: string;
  ctaLabel: string;
  ctaHref: string;
};

type ActionQueueProps = {
  items: ActionQueueItem[];
  className?: string;
};

function money(value: number) {
  const n = Math.round(Math.abs(value));
  return `$${n.toLocaleString()}`;
}

function severityStyles(level: ActionQueueItem["severity"]) {
  if (level === "high") return "border-[#FF4D6D]/40 bg-[#FF4D6D]/15 text-[#FFD1DB]";
  if (level === "medium") return "border-[#FFB547]/40 bg-[#FFB547]/15 text-[#FFE9C2]";
  return "border-[#32D583]/35 bg-[#32D583]/12 text-[#C7FFE3]";
}

function deptStyles(department: ActionQueueItem["department"]) {
  if (department === "Service") return "border-[#5B5BD6]/35 bg-[#5B5BD6]/15 text-[#D7D7FF]";
  if (department === "Parts") return "border-[#32D583]/35 bg-[#32D583]/14 text-[#C7FFE3]";
  if (department === "Store") return "border-[#A855F7]/35 bg-[#A855F7]/14 text-[#F0D8FF]";
  return "border-[#8B5CF6]/35 bg-[#8B5CF6]/14 text-[#E9D5FF]";
}

export function ActionQueue({ items, className }: ActionQueueProps) {
  const top = items.slice(0, 3);

  return (
    <section className={cn("rounded-2xl bg-[linear-gradient(165deg,rgba(168,85,247,0.08),rgba(255,255,255,0.01)_36%),#121826] p-5 shadow-[0_28px_56px_-36px_rgba(0,0,0,0.9)]", className)}>
      <h2 className="exec-section-title text-white">Action Queue</h2>
      <p className="mt-1 text-[13px] text-[#94A3B8]">Top 3 moves: signal, owner, dollar impact.</p>

      <div className="mt-5 grid gap-4 md:grid-cols-3">
        {top.map((item, idx) => (
          <article key={item.id} className="rounded-2xl bg-[linear-gradient(150deg,rgba(255,255,255,0.08),rgba(255,255,255,0.01)_45%)] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_24px_44px_-30px_rgba(0,0,0,0.9)]">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[13px] font-bold text-white">#{item.rank || idx + 1}</p>
              <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em]", severityStyles(item.severity))}>
                {item.severity}
              </span>
            </div>

            <div className="mt-2 flex items-center gap-2">
              <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em]", deptStyles(item.department))}>
                {item.department}
              </span>
            </div>

            <p className="mt-2 text-[15px] font-semibold leading-snug text-white">{item.title}</p>
            <p className="mt-1 text-[12px] text-[#A1A1AA]">
              Threat value: <span className="font-mono font-semibold text-[#FF4D6D]">{money(item.dollarImpact)}</span>
            </p>
            <p className="text-[12px] text-[#A1A1AA]">
              Owner: <span className="font-semibold text-slate-200">{item.owner}</span>
            </p>
            <p className="mt-2 text-[12px] text-[#71717A]">Action: {item.recommendedAction}</p>

            <Link
              href={item.ctaHref}
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                "mt-3 inline-flex h-8 items-center gap-1 border-[rgba(255,255,255,0.06)] bg-[rgba(168,85,247,0.12)] text-[12px] text-slate-100 hover:bg-[rgba(168,85,247,0.22)]",
              )}
            >
              {item.ctaLabel}
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </article>
        ))}
      </div>
    </section>
  );
}
