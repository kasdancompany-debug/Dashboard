"use client";

import { cn } from "@/lib/utils";

type SourceRow = {
  source: "sales" | "service" | "parts";
  connected: boolean;
  rowCount: number;
  parserConfidence: number;
  warningCount: number;
  errors: string[];
  lastFetched: string | null;
};

type SourceHealthDrawerProps = {
  sources: SourceRow[];
  className?: string;
};

function statusFor(row: SourceRow): "connected" | "warning" | "error" {
  if (!row.connected || row.errors.length > 0) return "error";
  if (row.warningCount > 0 || row.parserConfidence < 75) return "warning";
  return "connected";
}

function statusStyles(status: ReturnType<typeof statusFor>) {
  if (status === "error") return "border-red-500/30 bg-red-950/20 text-red-200";
  if (status === "warning") return "border-amber-500/30 bg-amber-950/20 text-amber-200";
  return "border-emerald-500/30 bg-emerald-950/20 text-emerald-200";
}

export function SourceHealthDrawer({ sources, className }: SourceHealthDrawerProps) {
  return (
    <section id="source-health-detail" className={cn("rounded-xl bg-[linear-gradient(170deg,rgba(91,91,214,0.08),rgba(255,255,255,0.01)_38%),#121826] shadow-[0_20px_44px_-32px_rgba(0,0,0,0.9)]", className)}>
      <details>
        <summary className="cursor-pointer list-none px-4 py-3 text-[12px] font-semibold uppercase tracking-[0.16em] text-[#A1A1AA]">
          Source Health
        </summary>
        <div className="px-4 py-3 text-[12px] text-[#A1A1AA]">
          <div className="grid gap-2 md:grid-cols-3">
            {sources.map((src) => {
              const status = statusFor(src);
              return (
                <article key={src.source} className="rounded bg-[linear-gradient(150deg,rgba(255,255,255,0.06),rgba(255,255,255,0.01)_45%)] px-2.5 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold capitalize text-slate-200">{src.source}</p>
                    <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em]", statusStyles(status))}>
                      {status}
                    </span>
                  </div>
                  <p className="mt-1">Rows: {src.rowCount}</p>
                  <p>Parser confidence: {src.parserConfidence}%</p>
                  <p>Warnings: {src.warningCount}</p>
                  <p>Last fetched: {src.lastFetched ? new Date(src.lastFetched).toLocaleTimeString() : "—"}</p>
                </article>
              );
            })}
          </div>
        </div>
      </details>
    </section>
  );
}
