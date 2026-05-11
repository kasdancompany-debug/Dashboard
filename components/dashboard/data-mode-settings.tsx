"use client";

import { useMemo, useState } from "react";
import { DatabaseZap } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function DataModeSettings({ buildMode }: { buildMode: string }) {
  const normalized = useMemo(() => (buildMode || "mock").toLowerCase(), [buildMode]);
  const [displayMode, setDisplayMode] = useState(normalized === "live" ? "live" : "mock");

  return (
    <Card className="bg-white">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-slate-900">
          <DatabaseZap className="h-4 w-4 text-primary" />
          Data Source Mode
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-[16px] text-slate-700">
          This is a display toggle only. Live API safety and credential access stay server-side.
        </p>
        <div className="flex gap-2">
          <button
            className={`rounded-lg px-4 py-2 text-[14px] font-medium ${displayMode === "mock" ? "bg-primary text-white" : "bg-slate-100 text-slate-700"}`}
            onClick={() => setDisplayMode("mock")}
          >
            Mock
          </button>
          <button
            className={`rounded-lg px-4 py-2 text-[14px] font-medium ${displayMode === "live" ? "bg-primary text-white" : "bg-slate-100 text-slate-700"}`}
            onClick={() => setDisplayMode("live")}
          >
            Live
          </button>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[14px] text-slate-600">Build mode (NEXT_PUBLIC_DATA_MODE):</span>
          <Badge variant="outline" className="capitalize">{normalized}</Badge>
        </div>
      </CardContent>
    </Card>
  );
}
