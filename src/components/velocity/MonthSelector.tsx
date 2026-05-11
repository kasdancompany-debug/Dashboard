"use client";

import { useMemo } from "react";

type MonthSelectorProps = {
  selectedMonthKey: string;
  onChange: (monthKey: string) => void;
  className?: string;
};

const MONTHS = [
  { value: 1, label: "January" },
  { value: 2, label: "February" },
  { value: 3, label: "March" },
  { value: 4, label: "April" },
  { value: 5, label: "May" },
  { value: 6, label: "June" },
  { value: 7, label: "July" },
  { value: 8, label: "August" },
  { value: 9, label: "September" },
  { value: 10, label: "October" },
  { value: 11, label: "November" },
  { value: 12, label: "December" },
];

function parseMonthKey(key: string) {
  const [yearRaw, monthRaw] = key.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const safe = Number.isFinite(year) && Number.isFinite(month) && month >= 1 && month <= 12;
  if (!safe) {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  }
  return { year, month };
}

function toMonthKey(year: number, month: number) {
  return `${year}-${`${month}`.padStart(2, "0")}`;
}

export function MonthSelector({ selectedMonthKey, onChange, className }: MonthSelectorProps) {
  const now = useMemo(() => new Date(), []);
  const { year, month } = parseMonthKey(selectedMonthKey);
  const years = useMemo(
    () => Array.from({ length: 6 }, (_, idx) => now.getFullYear() - 4 + idx),
    [now],
  );

  return (
    <div className={className}>
      <div className="flex items-center gap-2">
        <select
          value={month}
          onChange={(e) => onChange(toMonthKey(year, Number(e.target.value)))}
          className="rounded-md bg-[rgba(255,255,255,0.04)] px-2.5 py-1 text-[12px] font-semibold text-[#F8FAFC]"
          aria-label="Select month"
        >
          {MONTHS.map((m) => (
            <option key={m.value} value={m.value} className="bg-[#121826] text-[#F8FAFC]">
              {m.label}
            </option>
          ))}
        </select>
        <select
          value={year}
          onChange={(e) => onChange(toMonthKey(Number(e.target.value), month))}
          className="rounded-md bg-[rgba(255,255,255,0.04)] px-2.5 py-1 text-[12px] font-semibold text-[#F8FAFC]"
          aria-label="Select year"
        >
          {years.map((y) => (
            <option key={y} value={y} className="bg-[#121826] text-[#F8FAFC]">
              {y}
            </option>
          ))}
        </select>
      </div>
      <p className="mt-1 text-[12px] text-[#A1A1AA]">
        Viewing {MONTHS.find((m) => m.value === month)?.label} {year}
      </p>
    </div>
  );
}

