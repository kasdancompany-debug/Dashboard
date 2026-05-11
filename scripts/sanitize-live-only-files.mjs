import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");

const files = {
  "app/dashboard/sales/page.tsx": `import { SalesCommandCentre } from "@/components/dashboard/sales-command-centre";
import { getLiveDataset } from "@/src/lib/live/live-data";

export default async function SalesPage() {
  try {
    const dataset = await getLiveDataset();
    return (
      <div className="space-y-8">
        <section className="rounded-2xl bg-white p-7 shadow-[var(--shadow-sm-subtle)]">
          <h1 className="text-[32px] font-semibold tracking-tight text-slate-950">Sales Command</h1>
          <p className="mt-2 max-w-3xl text-[16px] text-slate-700">Sales profit desk for desk control, gross quality, and leadership monitoring.</p>
        </section>
        <SalesCommandCentre deals={dataset.salesDeals} metricTrace={dataset.pipeline.metricTraces.sales} />
      </div>
    );
  } catch (error) {
    return <div className="rounded-md border border-[#DC2626] bg-[#fef2f2] p-4 text-[#DC2626]">Live sales data unavailable: {error instanceof Error ? error.message : "unknown error"}</div>;
  }
}
`,
  "app/dashboard/service/page.tsx": `import { ServiceCommandCentre } from "@/components/dashboard/service-command-centre";
import { getLiveDataset } from "@/src/lib/live/live-data";

export default async function ServicePage() {
  try {
    const dataset = await getLiveDataset();
    return (
      <div className="space-y-8">
        <section className="rounded-2xl bg-white p-7 shadow-[var(--shadow-sm-subtle)]">
          <h1 className="text-[32px] font-semibold tracking-tight text-slate-950">Service Operations</h1>
          <p className="mt-2 max-w-3xl text-[16px] text-slate-700">Service profit desk for advisor productivity, gross quality, and immediate manager interventions.</p>
        </section>
        <ServiceCommandCentre
          summary={dataset.serviceSummary}
          advisors={dataset.serviceAdvisorPerformance}
          metricTrace={dataset.pipeline.metricTraces.service}
        />
      </div>
    );
  } catch (error) {
    return <div className="rounded-md border border-[#DC2626] bg-[#fef2f2] p-4 text-[#DC2626]">Live service data unavailable: {error instanceof Error ? error.message : "unknown error"}</div>;
  }
}
`,
  "app/dashboard/parts/page.tsx": `import { PartsCommandCentre } from "@/components/dashboard/parts-command-centre";
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
`,
  "app/dashboard/alerts/page.tsx": `import { AlertsCommandCentre } from "@/components/dashboard/alerts-command-centre";
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
`,
  "app/dashboard/people/page.tsx": `import { PeopleCommandCentre } from "@/components/dashboard/people-command-centre";
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
`,
  "app/dashboard/briefing/page.tsx": `import BriefingView from "./briefing-view";

export default function BriefingPage() {
  return <BriefingView />;
}
`,
  "components/dashboard/live-dashboard.tsx": `export { LiveDashboardView as LiveDashboard } from "@/components/dashboard/live-dashboard-view";
`,
  "app/api/sheets/sales/route.ts": `import { fetchSheetRows, isLiveDataEnabled } from "@/src/lib/google/sheets-client";
import { badRequest, ok, serverError } from "@/src/lib/google/route-utils";

export async function GET() {
  if (!isLiveDataEnabled()) {
    return badRequest("LIVE_DATA_ENABLED must be true. Mock fallback is disabled.");
  }
  try {
    return ok(await fetchSheetRows("sales"));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch sales sheet.";
    if (message.includes("Missing required environment variable")) return badRequest(message);
    return serverError(message);
  }
}
`,
  "app/api/sheets/service/route.ts": `import { fetchSheetRows, isLiveDataEnabled } from "@/src/lib/google/sheets-client";
import { badRequest, ok, serverError } from "@/src/lib/google/route-utils";

export async function GET() {
  if (!isLiveDataEnabled()) {
    return badRequest("LIVE_DATA_ENABLED must be true. Mock fallback is disabled.");
  }
  try {
    return ok(await fetchSheetRows("service"));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch service sheet.";
    if (message.includes("Missing required environment variable")) return badRequest(message);
    return serverError(message);
  }
}
`,
  "app/api/sheets/parts/route.ts": `import { fetchSheetRows, isLiveDataEnabled } from "@/src/lib/google/sheets-client";
import { badRequest, ok, serverError } from "@/src/lib/google/route-utils";

export async function GET() {
  if (!isLiveDataEnabled()) {
    return badRequest("LIVE_DATA_ENABLED must be true. Mock fallback is disabled.");
  }
  try {
    return ok(await fetchSheetRows("parts"));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch parts sheet.";
    if (message.includes("Missing required environment variable")) return badRequest(message);
    return serverError(message);
  }
}
`,
};

for (const [relativePath, content] of Object.entries(files)) {
  const absolutePath = path.join(root, relativePath);
  mkdirSync(path.dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, content, "utf8");
}

console.log("Sanitized live-only wrapper files.");
