"use client";

import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type PacePoint = { period: string; target: number; actual: number };
type GrossPoint = { name: string; value: number };
type ContributionPoint = { name: string; value: number };

const contributionColors = ["#b91328", "#8d98a8", "#c7ced8"];
const money = (value: number) => `$${Math.round(value).toLocaleString()}`;
const chartGrid = "#e4e7ec";
const axisText = "#556070";
const tooltipStyle = { background: "#ffffff", border: "1px solid #d8dde5", borderRadius: "10px" };
const labelStyle = { fill: axisText, fontSize: 13 };

export function CommandCentreCharts({
  pacing,
  grossBreakdown,
  contribution,
}: {
  pacing: PacePoint[];
  grossBreakdown: GrossPoint[];
  contribution: ContributionPoint[];
}) {
  return (
    <>
      <Card className="rounded-2xl bg-card shadow-sm ring-1 ring-border/70 xl:col-span-2">
        <CardHeader><CardTitle className="text-lg text-foreground">Actual vs target gross pace</CardTitle></CardHeader>
        <CardContent className="h-72 min-h-[300px]">
          <ResponsiveContainer width="100%" height="100%" minHeight={300}>
            <LineChart data={pacing}>
              <CartesianGrid stroke={chartGrid} strokeDasharray="4 4" />
              <XAxis dataKey="period" stroke={axisText} tick={labelStyle} />
              <YAxis stroke={axisText} tick={labelStyle} tickFormatter={money} width={84} />
              <Tooltip formatter={(value) => money(Number(value ?? 0))} contentStyle={tooltipStyle} />
              <Legend verticalAlign="top" align="right" wrapperStyle={{ fontSize: 13, color: axisText }} />
              <Line type="monotone" dataKey="target" stroke="#8d98a8" strokeWidth={2.5} dot={false} />
              <Line type="monotone" dataKey="actual" stroke="#b91328" strokeWidth={3.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="rounded-2xl bg-card shadow-sm ring-1 ring-border/70">
        <CardHeader><CardTitle className="text-lg text-foreground">Gross breakdown</CardTitle></CardHeader>
        <CardContent className="h-72 min-h-[300px]">
          <ResponsiveContainer width="100%" height="100%" minHeight={300}>
            <BarChart data={grossBreakdown} layout="vertical" margin={{ top: 8, right: 10, left: 22, bottom: 8 }}>
              <CartesianGrid stroke={chartGrid} strokeDasharray="4 4" horizontal={false} />
              <XAxis type="number" stroke={axisText} tick={labelStyle} tickFormatter={money} />
              <YAxis type="category" dataKey="name" stroke={axisText} tick={labelStyle} width={96} />
              <Tooltip formatter={(value) => money(Number(value ?? 0))} contentStyle={tooltipStyle} />
              <Bar dataKey="value" radius={[0, 8, 8, 0]}>
                {grossBreakdown.map((_, idx) => <Cell key={`gross-${idx}`} fill={idx === 0 ? "#b91328" : "#8d98a8"} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="rounded-2xl bg-card shadow-sm ring-1 ring-border/70 xl:col-span-3">
        <CardHeader><CardTitle className="text-lg text-foreground">Department contribution</CardTitle></CardHeader>
        <CardContent className="h-64 min-h-[270px]">
          <ResponsiveContainer width="100%" height="100%" minHeight={270}>
            <BarChart data={contribution}>
              <CartesianGrid stroke={chartGrid} strokeDasharray="4 4" />
              <XAxis dataKey="name" stroke={axisText} tick={labelStyle} />
              <YAxis stroke={axisText} tick={labelStyle} tickFormatter={money} width={84} />
              <Tooltip formatter={(value) => money(Number(value ?? 0))} contentStyle={tooltipStyle} />
              <Legend verticalAlign="top" align="right" wrapperStyle={{ fontSize: 13, color: axisText }} />
              <Bar dataKey="value" radius={[10, 10, 0, 0]}>
                {contribution.map((_, idx) => <Cell key={`contrib-${idx}`} fill={contributionColors[idx % contributionColors.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </>
  );
}
