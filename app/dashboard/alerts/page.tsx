import { AlertsCommandCentre } from "@/components/dashboard/alerts-command-centre";
import { generateStoreBriefing } from "@/src/lib/insights";
import { getLiveDataset } from "@/src/lib/live/live-data";

export default async function AlertsPage() {
  try {
    const dataset = await getLiveDataset();
    const briefing = generateStoreBriefing({
      salesDeals: dataset.salesDeals,
      salesSummary: dataset.salesSummary,
      serviceSummary: dataset.serviceSummary,
      advisorPerformance: dataset.serviceAdvisorPerformance,
      partsSummary: dataset.partsSummary,
      daysUsed: dataset.daysUsed,
      daysAvailable: dataset.daysAvailable,
    });
    return (
      <div className="space-y-8">
        <section className="rounded-2xl bg-white p-7 shadow-[var(--shadow-sm-subtle)]">
          <h1 className="text-[32px] font-semibold tracking-tight text-slate-950">Operational Alerts</h1>
          <p className="mt-2 max-w-3xl text-[16px] text-slate-700">Insight engine output with filters, accountability tracking, and action-first recommendations.</p>
        </section>
        <AlertsCommandCentre alerts={briefing.alerts} />
      </div>
    );
  } catch (error) {
    return <div className="rounded-md border border-[#DC2626] bg-[#fef2f2] p-4 text-[#DC2626]">Live alerts data unavailable: {error instanceof Error ? error.message : "unknown error"}</div>;
  }
}
