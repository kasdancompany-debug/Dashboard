import { cn } from "@/lib/utils";

export type StatusPillVariant = "healthy" | "watch" | "at-risk" | "stale" | "broken";

const styles: Record<StatusPillVariant, string> = {
  healthy: "border-emerald-300/70 bg-emerald-50/90 text-emerald-900",
  watch: "border-amber-300/70 bg-amber-50/90 text-amber-950",
  "at-risk": "border-[#9f1239]/30 bg-[#fff1f2]/90 text-[#881337]",
  stale: "border-amber-300/80 bg-amber-100/85 text-amber-950",
  broken: "border-[#9f1239]/40 bg-[#ffe4e6]/90 text-[#7f1d1d]",
};

const labels: Record<StatusPillVariant, string> = {
  healthy: "Healthy",
  watch: "Watch",
  "at-risk": "At risk",
  stale: "Stale",
  broken: "Broken",
};

export function StatusPill({
  variant,
  label,
  className,
  pulse,
}: {
  variant: StatusPillVariant;
  label?: string;
  className?: string;
  /** Subtle motion when data is revalidating */
  pulse?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] transition-shadow duration-200",
        styles[variant],
        pulse && "ring-2 ring-amber-400/45 ring-offset-2 ring-offset-white",
        className,
      )}
    >
      {label ?? labels[variant]}
    </span>
  );
}

export function mapFreshnessToPill(status: "fresh" | "stale" | "error" | "unknown"): StatusPillVariant {
  if (status === "fresh") return "healthy";
  if (status === "stale") return "stale";
  if (status === "error") return "broken";
  return "watch";
}

/** Maps department pace label from command center logic */
export function mapDeptPaceToPill(status: string, tone: "win" | "risk" | "neutral"): StatusPillVariant {
  if (tone === "win") return "healthy";
  if (tone === "risk") return "at-risk";
  if (status.includes("Forecast not")) return "stale";
  return "watch";
}

export function mapForecastConfidenceLabel(label: "High" | "Moderate" | "Limited"): StatusPillVariant {
  if (label === "High") return "healthy";
  if (label === "Limited") return "at-risk";
  return "watch";
}

export function mapConfidenceSeverityToPill(severity: "critical" | "warn" | "info"): StatusPillVariant {
  if (severity === "critical") return "broken";
  if (severity === "warn") return "watch";
  return "healthy";
}
