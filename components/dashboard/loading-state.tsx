import { Skeleton } from "@/components/ui/skeleton";

/** Dense terminal-style placeholders aligned to dashboard layout */
export function LoadingState() {
  return (
    <div className="space-y-5 animate-in fade-in duration-200" aria-busy="true" aria-label="Loading Sault Nissan operating view">
      <section className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-[0_1px_0_rgba(15,23,42,0.05)] md:p-7">
        <div className="flex flex-wrap justify-between gap-3">
          <Skeleton className="h-3 w-40 rounded bg-slate-200/90" />
          <div className="flex gap-2">
            <Skeleton className="h-6 w-20 rounded-full bg-slate-200/80" />
            <Skeleton className="h-6 w-28 rounded-full bg-slate-200/80" />
          </div>
        </div>
        <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_minmax(0,300px)]">
          <div>
            <Skeleton className="h-2.5 w-48 rounded bg-slate-200/80" />
            <Skeleton className="mt-3 h-[clamp(3rem,8vw,4.5rem)] w-[min(100%,22rem)] rounded-md bg-slate-200/70" />
            <div className="mt-5 space-y-2">
              <Skeleton className="h-3.5 w-full max-w-xl rounded bg-slate-100" />
              <Skeleton className="h-3.5 w-full max-w-lg rounded bg-slate-100" />
            </div>
          </div>
          <div className="space-y-2 rounded-lg border border-slate-200/80 bg-slate-50/80 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex justify-between gap-3 border-b border-slate-200/60 pb-2 last:border-0 last:pb-0">
                <Skeleton className="h-3 w-28 rounded bg-slate-200/70" />
                <Skeleton className="h-4 w-24 rounded bg-slate-300/80" />
              </div>
            ))}
          </div>
        </div>
      </section>

      <div>
        <Skeleton className="h-2.5 w-44 rounded bg-slate-200/80" />
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm">
              <div className="flex justify-between gap-2">
                <Skeleton className="h-4 w-24 rounded bg-slate-200/80" />
                <Skeleton className="h-6 w-16 rounded-full bg-slate-200/70" />
              </div>
              <div className="mt-4 space-y-2">
                <Skeleton className="h-4 w-full rounded bg-slate-100" />
                <Skeleton className="h-3 w-full rounded bg-slate-100" />
                <Skeleton className="h-3 w-[80%] rounded bg-slate-100" />
              </div>
            </div>
          ))}
        </div>
      </div>

      <section className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-sm">
        <Skeleton className="h-4 w-48 rounded bg-slate-200/80" />
        <Skeleton className="mt-2 h-3 w-full max-w-md rounded bg-slate-100" />
        <div className="mt-5 space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex gap-4 border-t border-slate-100 pt-4 first:border-t-0 first:pt-0">
              <Skeleton className="h-3 w-6 rounded bg-slate-200/70" />
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-3 w-20 rounded bg-slate-200/60" />
                <Skeleton className="h-4 w-full max-w-sm rounded bg-slate-100" />
                <Skeleton className="h-3 w-full rounded bg-slate-100" />
              </div>
              <Skeleton className="h-6 w-20 shrink-0 rounded bg-slate-200/80" />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
