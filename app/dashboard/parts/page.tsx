import { PartsCommandCentre } from "@/components/dashboard/parts-command-centre";
import { getLiveDataset } from "@/src/lib/live/live-data";

export default async function PartsPage() {
  try {
    const dataset = await getLiveDataset();
    return (
      <div className="space-y-8">
        <section className="rounded-2xl bg-white p-7 shadow-[var(--shadow-sm-subtle)]">
          <h1 className="text-[32px] font-semibold tracking-tight text-slate-950">Parts Intelligence</h1>
          <p className="mt-2 max-w-3xl text-[16px] text-slate-700">Executive parts profit desk focused on pace, mix quality, and immediate actions to protect month-end results.</p>
        </section>
        <PartsCommandCentre summary={dataset.partsSummary} metricTrace={dataset.pipeline.metricTraces.parts} />
      </div>
    );
  } catch (error) {
    return <div className="rounded-md border border-[#DC2626] bg-[#fef2f2] p-4 text-[#DC2626]">Live parts data unavailable: {error instanceof Error ? error.message : "unknown error"}</div>;
  }
}
