"use client";

import { cn } from "@/lib/utils";

export type SegmentedControlOption<T extends string> = {
  value: T;
  label: string;
  /** Optional native tooltip for truncated labels */
  title?: string;
};

type SegmentedControlProps<T extends string> = {
  value: T;
  onChange: (value: T) => void;
  options: readonly SegmentedControlOption<T>[];
  "aria-label": string;
  className?: string;
};

/**
 * Dark, compact segmented control for filters / time ranges.
 * Single-select; parent owns value.
 */
export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  "aria-label": ariaLabel,
  className,
}: SegmentedControlProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn(
        "flex w-full max-w-full gap-0.5 rounded-xl border border-white/[0.11] bg-black/50 p-0.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]",
        className,
      )}
    >
      {options.map((opt) => {
        const selected = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={selected}
            title={opt.title ?? opt.label}
            onClick={() => onChange(opt.value)}
            className={cn(
              "relative min-h-[34px] min-w-0 flex-1 rounded-[10px] px-2 py-1.5 text-center text-[11px] font-semibold tracking-tight transition-[color,background,box-shadow] sm:px-2.5 sm:text-[12px]",
              selected
                ? "z-[1] text-white shadow-[0_0_0_1px_rgba(255,255,255,0.14),0_8px_20px_-12px_rgba(0,0,0,0.85)]"
                : "text-slate-500 hover:text-slate-300",
            )}
          >
            {selected ? (
              <span
                className="pointer-events-none absolute inset-0 rounded-[10px] bg-gradient-to-b from-sky-400/20 via-white/[0.09] to-white/[0.03] ring-1 ring-inset ring-white/[0.12]"
                aria-hidden
              />
            ) : null}
            <span className="relative block truncate">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
