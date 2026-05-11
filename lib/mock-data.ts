import { subDays } from "date-fns";

export type KpiItem = {
  label: string;
  value: string;
  delta: string;
  trend: "up" | "down" | "flat";
};

export type AlertItem = {
  title: string;
  description: string;
  severity: "critical" | "warning" | "info";
  time: string;
};

export const kpis: KpiItem[] = [
  { label: "MTD Gross", value: "$418,200", delta: "+9.4%", trend: "up" },
  { label: "Units Delivered", value: "84", delta: "+6 units", trend: "up" },
  { label: "Service ELR", value: "$132.40", delta: "-2.1%", trend: "down" },
  { label: "Parts Fill Rate", value: "92.8%", delta: "+1.2%", trend: "up" },
];

export const departmentHealth = [
  { name: "Sales", score: 87, detail: "Strong lead conversion this week" },
  { name: "Service", score: 78, detail: "Backlog risk in Saturday slots" },
  { name: "Parts", score: 91, detail: "Inventory quality above target" },
];

export const pacing = [
  { label: "Sales to Goal", value: "84 / 96", pct: 87 },
  { label: "RO Count to Goal", value: "1,128 / 1,240", pct: 91 },
  { label: "Parts GP to Goal", value: "$176k / $205k", pct: 86 },
];

export const insights = [
  "Fleet channel volume is rising faster than retail; protect front-end gross on high-demand trims.",
  "Aged used inventory over 45 days increased by 3 units; prioritize digital merchandising refresh.",
  "Service upsell acceptance is strongest on Tuesday mornings, suggesting advisor staffing leverage.",
];

export const alerts: AlertItem[] = [
  {
    title: "High Priority Appointment Overflow",
    description: "Service calendar is above 96% utilization for next 3 business days.",
    severity: "critical",
    time: "5m ago",
  },
  {
    title: "Declining Lead Response Time",
    description: "Median first response moved from 6m to 11m in the last 24h.",
    severity: "warning",
    time: "22m ago",
  },
  {
    title: "Data Feed Last Updated",
    description: "Sheets sync heartbeat nominal; no missing rows detected.",
    severity: "info",
    time: "1h ago",
  },
];

export const leaderboard = [
  { name: "A. Patel", department: "Sales", metric: "Units", value: "14" },
  { name: "J. Martin", department: "Service", metric: "ELR", value: "$149" },
  { name: "S. Brooks", department: "Parts", metric: "GP", value: "$28,400" },
  { name: "D. Khan", department: "Sales", metric: "Closing %", value: "31%" },
];

export const performanceSeries = Array.from({ length: 14 }, (_, idx) => ({
  day: subDays(new Date(), 13 - idx).toLocaleDateString("en-CA", {
    month: "short",
    day: "numeric",
  }),
  sales: 58 + idx * 2 + (idx % 3) * 3,
  service: 72 + idx + (idx % 4) * 2,
  parts: 44 + idx + (idx % 2) * 4,
}));
