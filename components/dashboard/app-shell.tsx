import { ReactNode } from "react";
import { DashboardSummaryStrip } from "@/components/dashboard/dashboard-summary-strip";
import { SourceHealthPanel } from "@/components/dashboard/source-health-panel";
import { Sidebar } from "@/components/dashboard/sidebar";
import { TopBar } from "@/components/dashboard/top-bar";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#e4e7ec] text-slate-900 antialiased">
      <div className="mx-auto flex w-full max-w-[1920px]">
        <Sidebar />
        <main className="min-w-0 flex-1 px-4 pb-10 pt-4 md:px-6 md:pt-5">
          <div className="mx-auto w-full max-w-[1380px]">
            <div className="sticky top-0 z-50 mb-5 rounded-xl border border-slate-200/80 bg-white/92 px-4 pb-3 pt-3 shadow-[0_12px_40px_-18px_rgba(15,23,42,0.18)] backdrop-blur-md backdrop-saturate-150 transition-shadow duration-200 md:px-5">
              <TopBar embedded />
              <DashboardSummaryStrip />
            </div>
            <SourceHealthPanel />
            <div className="mt-5">{children}</div>
          </div>
        </main>
      </div>
    </div>
  );
}
