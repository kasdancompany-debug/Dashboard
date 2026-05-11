import { PeopleCommandCentre } from "@/components/dashboard/people-command-centre";
import { getLiveDataset } from "@/src/lib/live/live-data";

export default async function PeoplePage() {
  try {
    const dataset = await getLiveDataset();
    return (
      <div className="space-y-8">
        <section className="rounded-2xl bg-white p-7 shadow-[var(--shadow-sm-subtle)]">
          <h1 className="text-[32px] font-semibold tracking-tight text-slate-950">People & Productivity</h1>
          <p className="mt-2 max-w-3xl text-[16px] text-slate-700">Cross-department accountability view showing who is winning, who needs coaching, and where manager follow-up is required.</p>
        </section>
        <PeopleCommandCentre deals={dataset.salesDeals} advisors={dataset.serviceAdvisorPerformance} />
      </div>
    );
  } catch (error) {
    return <div className="rounded-md border border-[#DC2626] bg-[#fef2f2] p-4 text-[#DC2626]">Live people data unavailable: {error instanceof Error ? error.message : "unknown error"}</div>;
  }
}
