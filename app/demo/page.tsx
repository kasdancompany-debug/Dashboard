import Link from "next/link";
import { ArrowRight, BriefcaseBusiness, Gauge, ShieldCheck, Sparkles } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const pillars = [
  {
    title: "One Store. One Profit View.",
    detail:
      "Leadership no longer jumps between disconnected spreadsheets. Sales, Service, Parts, people performance, and alerts are unified in one executive-grade workflow.",
    icon: BriefcaseBusiness,
  },
  {
    title: "Live Pacing, Not Rearview Reporting",
    detail:
      "Managers see pace-to-goal, gross quality, and forecast risk continuously, with last-sync confidence and graceful fallback protection.",
    icon: Gauge,
  },
  {
    title: "Action Before Month-End",
    detail:
      "Built-in alert logic surfaces leakage, coaching opportunities, and ownership actions early enough to change outcomes this month.",
    icon: ShieldCheck,
  },
];

export default function DemoPage() {
  return (
    <div className="space-y-8">
      <section className="rounded-2xl bg-white p-8 shadow-[var(--shadow-sm-subtle)]">
        <p className="text-[12px] uppercase tracking-[0.2em] text-slate-500">Boss Demo</p>
        <h1 className="mt-2 text-[40px] font-semibold tracking-tight text-slate-950">Sault Nissan Profit Desk</h1>
        <p className="mt-3 max-w-4xl text-[17px] leading-8 text-slate-700">
          This product turns messy Sales, Service, and Parts sheets into fast executive decisions. It combines live data,
          department intelligence, and manager-ready actions in one high-accountability operating system.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link href="/dashboard/briefing">
            <Button>
              <Sparkles className="h-4 w-4" />
              Open Daily Briefing
            </Button>
          </Link>
          <Link href="/dashboard">
            <Button variant="outline">
              Open Profit Dashboard
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        {pillars.map((pillar) => {
          const Icon = pillar.icon;
          return (
            <Card key={pillar.title} className="bg-white">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-slate-900">
                  <Icon className="h-4 w-4 text-primary" />
                  {pillar.title}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-[16px] leading-7 text-slate-700">{pillar.detail}</CardContent>
            </Card>
          );
        })}
      </section>

      <section>
        <Card className="bg-white">
          <CardHeader>
            <CardTitle className="text-slate-900">Demo Narrative (3 Minutes)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-[16px] text-slate-700">
            <p>- Start on Daily Briefing to show executive context and immediate actions.</p>
            <p>- Move to Dashboard for live pacing, contribution, and store risk visibility.</p>
            <p>- Drill into Sales, Service, and Parts views for accountable execution.</p>
            <p>- Close on Alerts + Reports to show the system drives follow-through, not just visuals.</p>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
