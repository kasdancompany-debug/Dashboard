"use client";

import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";

import type { DepartmentGrossTracking } from "@/src/lib/velocity/monthly-gross/types";

type DepartmentGrossAccordionProps = {
  departments: DepartmentGrossTracking[];
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

function statusTone(status: "ahead" | "on-track" | "behind" | "insufficient-data") {
  if (status === "ahead") return "text-[#32D583]";
  if (status === "behind") return "text-[#FF4D6D]";
  if (status === "insufficient-data") return "text-[#A1A1AA]";
  return "text-[#FFB547]";
}

export function DepartmentGrossAccordion({ departments, className }: DepartmentGrossAccordionProps) {
  const ordered = useMemo(
    () =>
      ["Sales", "Service", "Parts"]
        .map((name) => departments.find((d) => d.department === name))
        .filter((d): d is DepartmentGrossTracking => Boolean(d)),
    [departments],
  );

  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    Sales: true,
    Service: false,
    Parts: false,
  });

  return (
    <section className={className}>
      <div className="space-y-3">
        {ordered.map((dept) => {
          const isOpen = expanded[dept.department] ?? false;
          return (
            <article
              key={dept.department}
              className="rounded-2xl bg-[linear-gradient(165deg,rgba(91,91,214,0.10),rgba(255,255,255,0.01)_42%),#111827] p-4 shadow-[0_22px_44px_-30px_rgba(0,0,0,0.9)]"
            >
              <button
                type="button"
                onClick={() =>
                  setExpanded((prev) => ({
                    ...prev,
                    [dept.department]: !isOpen,
                  }))
                }
                className="flex w-full items-center justify-between gap-3 text-left"
              >
                <div>
                  <p className="text-[20px] font-semibold text-white">{dept.department}</p>
                  <p className="text-[12px] text-[#A1A1AA]">
                    Tracking <span className="font-mono text-[#E9D5FF]">{money(dept.trackingGross)}</span> vs Target{" "}
                    <span className="font-mono text-white">{money(dept.targetGross)}</span>
                  </p>
                </div>
                <div className="flex items-center gap-4 text-[12px]">
                  <p className="text-[#A1A1AA]">
                    Gap <span className={`font-mono ${statusTone(dept.status)}`}>{signedMoney(dept.gapToTarget)}</span>
                  </p>
                  <p className="text-[#E9D5FF]">{dept.pacePercent === null ? "N/A" : `${Math.round(dept.pacePercent)}%`}</p>
                  <ChevronDown className={`h-4 w-4 text-[#A1A1AA] transition-transform ${isOpen ? "rotate-180" : ""}`} />
                </div>
              </button>
              {dept.warning ? <p className="mt-2 text-[12px] text-[#FDE68A]">{dept.warning}</p> : null}

              {isOpen ? (
                <div className="mt-4 space-y-2">
                  {dept.lines.map((line) => {
                    const isBest = dept.bestLine?.label === line.label;
                    const isWorst = dept.worstLine?.label === line.label;
                    const tone = isBest
                      ? "bg-[#32D583]/12"
                      : isWorst
                        ? "bg-[#FF4D6D]/12"
                        : "bg-[rgba(255,181,71,0.10)]";
                    return (
                      <div
                        key={line.id}
                        className={`grid items-center gap-2 rounded-xl px-3 py-2 md:grid-cols-[1.3fr_1fr_1fr_1fr_90px_80px] ${tone}`}
                      >
                        <p className="text-[13px] font-medium text-white">{line.label}</p>
                        <p className="text-[12px] text-[#A1A1AA]">Actual {money(line.actualGross)}</p>
                        <p className="text-[12px] text-[#A1A1AA]">Tracking {money(line.trackingGross)}</p>
                        <p className="text-[12px] text-[#A1A1AA]">Target {money(line.targetGross)}</p>
                        <p className={`text-[12px] font-mono ${line.gapToTarget === null ? "text-[#A1A1AA]" : line.gapToTarget >= 0 ? "text-[#32D583]" : "text-[#FF4D6D]"}`}>
                          {signedMoney(line.gapToTarget)}
                        </p>
                        <p className={`text-[12px] font-semibold ${statusTone(line.status)}`}>{line.status}</p>
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}

