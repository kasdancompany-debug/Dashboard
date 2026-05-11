"use client";

import { useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InsightAlert } from "@/src/lib/insights";

type AlertWithResolution = InsightAlert & { resolved: boolean };

export function AlertsCommandCentre({ alerts }: { alerts: InsightAlert[] }) {
  const [severity, setSeverity] = useState("all");
  const [department, setDepartment] = useState("all");
  const [search, setSearch] = useState("");
  const [resolution, setResolution] = useState<"all" | "resolved" | "unresolved">("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const alertsWithResolution: AlertWithResolution[] = alerts.map((a, idx) => ({
    ...a,
    resolved: idx % 3 === 0,
  }));

  const filtered = useMemo(() => {
    return alertsWithResolution.filter((a) => {
      if (severity !== "all" && a.severity !== severity) return false;
      if (department !== "all" && a.department !== department) return false;
      if (resolution !== "all" && (resolution === "resolved" ? !a.resolved : a.resolved)) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const haystack = [a.title, a.description, a.recommendedAction, a.metricImpact].join(" ").toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [alertsWithResolution, department, resolution, search, severity]);

  const selected = filtered.find((a) => a.id === selectedId) ?? filtered[0];

  return (
    <div className="space-y-6">
      <section className="grid gap-3 rounded-xl bg-white p-4 shadow-[var(--shadow-sm-subtle)] md:grid-cols-5">
        <select value={severity} onChange={(e) => setSeverity(e.target.value)} className="rounded-lg border border-input bg-white px-3 py-2 text-[14px] text-slate-800">
          <option value="all">All severity</option>
          <option value="critical">Critical</option>
          <option value="warning">Warning</option>
          <option value="info">Info</option>
          <option value="win">Win</option>
        </select>
        <select value={department} onChange={(e) => setDepartment(e.target.value)} className="rounded-lg border border-input bg-white px-3 py-2 text-[14px] text-slate-800">
          <option value="all">All departments</option>
          <option value="sales">Sales</option>
          <option value="service">Service</option>
          <option value="parts">Parts</option>
          <option value="store">Store</option>
        </select>
        <select value={resolution} onChange={(e) => setResolution(e.target.value as "all" | "resolved" | "unresolved")} className="rounded-lg border border-input bg-white px-3 py-2 text-[14px] text-slate-800">
          <option value="all">Resolved + Unresolved</option>
          <option value="resolved">Resolved</option>
          <option value="unresolved">Unresolved</option>
        </select>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search alerts..."
          className="rounded-lg border border-input bg-white px-3 py-2 text-[14px] text-slate-800 md:col-span-2"
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.3fr_1fr]">
        <Card className="bg-white">
          <CardHeader>
            <CardTitle className="text-slate-900">All Alerts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {filtered.map((alert) => (
              <button
                key={alert.id}
                onClick={() => setSelectedId(alert.id)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 p-4 text-left hover:border-primary/40"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[16px] font-semibold text-slate-900">{alert.title}</p>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="capitalize">{alert.department}</Badge>
                    <Badge variant="outline" className="capitalize">{alert.severity}</Badge>
                    <Badge className={alert.resolved ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}>
                      {alert.resolved ? "resolved" : "unresolved"}
                    </Badge>
                  </div>
                </div>
                <p className="mt-2 text-[15px] text-slate-700">{alert.description}</p>
              </button>
            ))}
            {filtered.length === 0 && <p className="text-[15px] text-slate-600">No alerts match current filters.</p>}
          </CardContent>
        </Card>

        <Card className="bg-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-slate-900">
              <AlertTriangle className="h-4 w-4 text-primary" />
              Recommended Action Panel
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-[16px] text-slate-700">
            {selected ? (
              <>
                <p className="text-[20px] font-semibold text-slate-900">{selected.title}</p>
                <p>{selected.description}</p>
                <p className="text-primary">Action: {selected.recommendedAction}</p>
                <p className="text-slate-600">Metric impact: {selected.metricImpact}</p>
              </>
            ) : (
              <p>Select an alert to see recommended action details.</p>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
