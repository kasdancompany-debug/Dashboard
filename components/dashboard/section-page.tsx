import { EmptyState } from "@/components/dashboard/empty-state";
import { InsightCard } from "@/components/dashboard/insight-card";

export function SectionPage({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight text-white">{title}</h1>
      <p className="max-w-3xl text-sm text-white/60">{detail}</p>
      <div className="grid gap-4 xl:grid-cols-[1.8fr_1fr]">
        <EmptyState
          title={`${title} analytics will connect to Google Sheets feeds`}
          detail="This page is prepared with premium layout and mock mode enabled. API integration can now be wired without redesign."
        />
        <InsightCard insight="Leadership note: Keep this surface concise and action-focused for quick stand-up decision making." />
      </div>
    </div>
  );
}
