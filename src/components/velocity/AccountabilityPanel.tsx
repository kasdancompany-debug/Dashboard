"use client";

import { cn } from "@/lib/utils";

type AccountabilityItem = {
  person: string;
  role: string;
  department: "Sales" | "Service" | "Parts";
  issueCount: number;
  totalDollarImpact: number;
  topIssue: string;
  recommendedCoachingAction: string;
  severity: "low" | "medium" | "high";
};

type AccountabilityPanelProps = {
  items: AccountabilityItem[];
  className?: string;
};

function money(value: number) {
  return `$${Math.round(Math.abs(value)).toLocaleString()}`;
}

function severityStyle(level: AccountabilityItem["severity"]) {
  if (level === "high") return "border-[#FF4D6D]/40 bg-[#FF4D6D]/15 text-[#FFD1DB]";
  if (level === "medium") return "border-[#FFB547]/40 bg-[#FFB547]/15 text-[#FFE9C2]";
  return "border-[#32D583]/35 bg-[#32D583]/12 text-[#C7FFE3]";
}

function departmentStyle(dept: AccountabilityItem["department"]) {
  if (dept === "Service") return "border-[#5B5BD6]/35 bg-[#5B5BD6]/15 text-[#D7D7FF]";
  if (dept === "Parts") return "border-[#32D583]/35 bg-[#32D583]/14 text-[#C7FFE3]";
  return "border-[#8B5CF6]/35 bg-[#8B5CF6]/14 text-[#E9D5FF]";
}

export function AccountabilityPanel({ items, className }: AccountabilityPanelProps) {
  const top = items.slice(0, 3);

  return (
    <section className={cn("rounded-2xl bg-[linear-gradient(165deg,rgba(91,91,214,0.08),rgba(255,255,255,0.01)_38%),#121826] p-5 shadow-[0_28px_56px_-36px_rgba(0,0,0,0.9)]", className)}>
      <h2 className="exec-section-title text-white">Accountability</h2>
      <p className="mt-1 text-[13px] text-[#94A3B8]">Top 3 owners requiring immediate intervention.</p>

      <div className="mt-5 space-y-3">
        {top.map((item, idx) => (
          <article
            key={`${item.person}-${idx}`}
            className="grid gap-2 rounded-2xl bg-[linear-gradient(150deg,rgba(255,255,255,0.08),rgba(255,255,255,0.01)_45%)] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_24px_44px_-30px_rgba(0,0,0,0.9)] md:grid-cols-[1.2fr_0.9fr_1fr]"
          >
            <div>
              <div className="flex items-center gap-2">
                <p className="text-[14px] font-semibold text-white">{item.person}</p>
                <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em]", severityStyle(item.severity))}>
                  {item.severity}
                </span>
              </div>
              <p className="text-[12px] text-[#94A3B8]">{item.role}</p>
            </div>

            <div className="flex items-center md:justify-start">
              <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em]", departmentStyle(item.department))}>
                {item.department}
              </span>
            </div>

            <div className="text-[12px] text-[#A1A1AA]">
              <p>{item.issueCount} active issues</p>
              <p className="mt-0.5 font-mono text-[15px] font-bold text-[#FF4D6D]">{money(item.totalDollarImpact)}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
