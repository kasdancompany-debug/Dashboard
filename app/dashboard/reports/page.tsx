import { ReportsHub } from "@/components/dashboard/reports-hub";

export default function ReportsPage() {
  return (
    <div className="space-y-8">
      <section className="rounded-2xl bg-white p-7 shadow-[var(--shadow-sm-subtle)]">
        <h1 className="text-[32px] font-semibold tracking-tight text-slate-950">Reports Library</h1>
        <p className="mt-2 max-w-3xl text-[16px] text-slate-700">Publishable manager report hub for previewing executive packs and export-ready snapshots.</p>
      </section>
      <ReportsHub />
    </div>
  );
}
