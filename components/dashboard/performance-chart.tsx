"use client";

import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Point = { day: string; sales: number; service: number; parts: number };

export function PerformanceChart({ data }: { data: Point[] }) {
  return (
    <Card className="rounded-2xl bg-card shadow-sm ring-1 ring-border/70">
      <CardHeader>
        <CardTitle className="text-lg text-foreground">14-day performance trend</CardTitle>
      </CardHeader>
      <CardContent className="h-80 min-h-[320px]">
        <ResponsiveContainer width="100%" height="100%" minHeight={320}>
          <LineChart data={data}>
            <CartesianGrid stroke="#e4e7ec" strokeDasharray="4 4" />
            <XAxis dataKey="day" stroke="#556070" tick={{ fill: "#556070", fontSize: 13 }} />
            <YAxis stroke="#556070" tick={{ fill: "#556070", fontSize: 13 }} />
            <Tooltip contentStyle={{ background: "#ffffff", border: "1px solid #d8dde5", borderRadius: "10px" }} />
            <Legend verticalAlign="top" align="right" wrapperStyle={{ fontSize: 13, color: "#556070" }} />
            <Line type="monotone" dataKey="sales" stroke="#b91328" strokeWidth={2.75} dot={false} />
            <Line type="monotone" dataKey="service" stroke="#6782a3" strokeWidth={2.5} dot={false} />
            <Line type="monotone" dataKey="parts" stroke="#8d98a8" strokeWidth={2.5} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
