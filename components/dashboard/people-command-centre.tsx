"use client";

import { useMemo, useState } from "react";
import { MessageSquareWarning, Trophy } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SalesDeal, ServiceAdvisorPerformance } from "@/src/lib/types/dealership";

type Row = {
  name: string;
  role: "Salesperson" | "Business Manager" | "Service Advisor" | "Manager";
  department: string;
  unitsOrDeals: number;
  totalGross: number;
  avgGross: number;
  frontGross?: number;
  backGross?: number;
  issues: number;
  extraA?: string;
  extraB?: string;
};
const emDash = "\u2014";
const money = (value?: number | null) => (typeof value === "number" && Number.isFinite(value) ? `$${value.toLocaleString()}` : emDash);
const normalizeWhitespace = (value: string) => value.replace(/\s+/g, " ").trim();

function canonicalPersonName(raw: string) {
  const cleaned = normalizeWhitespace(raw.replace(/\s*\/\s*/g, " / ").replace(/\s*&\s*/g, " & "));
  if (!cleaned) return emDash;
  return cleaned
    .split(" ")
    .map((token) => {
      if (["/", "&"].includes(token)) return token;
      const plain = token.replace(/[^a-zA-Z'.-]/g, "");
      if (plain.length <= 2) return plain.toUpperCase();
      return plain.charAt(0).toUpperCase() + plain.slice(1).toLowerCase();
    })
    .join(" ")
    .replace(/\s+([/&])\s+/g, " $1 ");
}

function personKey(raw: string) {
  return normalizeWhitespace(raw).toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function PeopleCommandCentre({ deals, advisors }: { deals: SalesDeal[]; advisors: ServiceAdvisorPerformance[] }) {
  const [roleFilter, setRoleFilter] = useState("all");
  const [sortBy, setSortBy] = useState<"gross" | "issues" | "volume">("gross");

  const salespeople = useMemo(() => {
    const grouped = new Map<string, { displayName: string; units: number; gross: number; front: number; back: number; issues: number }>();
    deals.forEach((d) => {
      const key = personKey(d.salesperson);
      const current = grouped.get(key) ?? { displayName: canonicalPersonName(d.salesperson), units: 0, gross: 0, front: 0, back: 0, issues: 0 };
      current.units += 1;
      current.gross += d.totalGross;
      current.front += d.frontGross;
      current.back += d.backGross;
      if (d.frontGross <= 0 || d.totalGross <= 0 || d.status === "issue") current.issues += 1;
      grouped.set(key, current);
    });
    return Array.from(grouped.values()).map((value) => ({
      name: value.displayName,
      role: "Salesperson" as const,
      department: "Sales",
      unitsOrDeals: value.units,
      totalGross: value.gross,
      avgGross: value.units ? Math.round(value.gross / value.units) : 0,
      frontGross: value.front,
      backGross: value.back,
      issues: value.issues,
      extraA: `${value.units} units`,
      extraB: `${value.issues} issue deals`,
    }));
  }, [deals]);

  const businessManagers = useMemo(() => {
    const grouped = new Map<string, { displayName: string; deals: number; backGross: number; terms: number; attachment: number }>();
    deals.forEach((d) => {
      const key = personKey(d.businessManager);
      const current = grouped.get(key) ?? { displayName: canonicalPersonName(d.businessManager), deals: 0, backGross: 0, terms: 0, attachment: 0 };
      current.deals += 1;
      current.backGross += d.backGross;
      current.terms += d.estimatedTerm;
      if (d.backGross < 1000) current.attachment += 1;
      grouped.set(key, current);
    });
    return Array.from(grouped.values()).map((value) => ({
      name: value.displayName,
      role: "Business Manager" as const,
      department: "F&I",
      unitsOrDeals: value.deals,
      totalGross: value.backGross,
      avgGross: value.deals ? Math.round(value.backGross / value.deals) : 0,
      issues: value.attachment,
      extraA: `${value.deals ? Math.round(value.terms / value.deals) : 0} mo avg term`,
      extraB: `${value.attachment} attachment opp`,
    }));
  }, [deals]);

  const serviceAdvisors = useMemo(
    () =>
      Array.from(
        advisors.reduce(
          (acc, a) => {
            const key = personKey(a.name);
            const current = acc.get(key) ?? {
              name: canonicalPersonName(a.name),
              role: "Service Advisor" as const,
              department: "Service",
              unitsOrDeals: 0,
              totalGross: 0,
              avgGross: 0,
              issues: 0,
              elr: 0,
              hpro: 0,
              csi: 0,
              wildcards: 0,
              rows: 0,
            };
            current.unitsOrDeals += a.cpRo;
            current.totalGross += a.totalSales;
            current.issues += Number(a.elr < 140) + Number(a.csiScore < 95);
            current.elr += a.elr;
            current.hpro += a.hpro;
            current.csi += a.csiScore;
            current.wildcards += a.soldWildcards;
            current.rows += 1;
            acc.set(key, current);
            return acc;
          },
          new Map<
            string,
            {
              name: string;
              role: "Service Advisor";
              department: string;
              unitsOrDeals: number;
              totalGross: number;
              avgGross: number;
              issues: number;
              elr: number;
              hpro: number;
              csi: number;
              wildcards: number;
              rows: number;
            }
          >(),
        ).values(),
      ).map((item) => ({
        name: item.name,
        role: item.role,
        department: item.department,
        unitsOrDeals: item.unitsOrDeals,
        totalGross: item.totalGross,
        avgGross: Math.round(item.totalGross / Math.max(1, item.unitsOrDeals)),
        issues: item.issues,
        extraA: `ELR $${(item.elr / item.rows).toFixed(1)} · HPRO ${(item.hpro / item.rows).toFixed(2)}`,
        extraB: `CSI ${(item.csi / item.rows).toFixed(1)} · Wildcards ${item.wildcards}`,
      })),
    [advisors],
  );

  const managers = useMemo(() => {
    const grouped = new Map<string, { displayName: string; deals: number; gross: number; issues: number; departments: Set<string> }>();
    deals.forEach((d) => {
      const key = personKey(d.manager);
      const current = grouped.get(key) ?? { displayName: canonicalPersonName(d.manager), deals: 0, gross: 0, issues: 0, departments: new Set<string>() };
      current.deals += 1;
      current.gross += d.totalGross;
      if (d.frontGross <= 0 || d.totalGross <= 0 || d.status !== "delivered") current.issues += 1;
      current.departments.add("Sales");
      grouped.set(key, current);
    });
    return Array.from(grouped.values()).map((value) => ({
      name: value.displayName,
      role: "Manager" as const,
      department: Array.from(value.departments).join(", "),
      unitsOrDeals: value.deals,
      totalGross: value.gross,
      avgGross: value.deals ? Math.round(value.gross / value.deals) : 0,
      issues: value.issues,
      extraA: `${value.deals} deals managed`,
      extraB: `${value.issues} issue count`,
    }));
  }, [deals]);

  const allRows: Row[] = [...salespeople, ...businessManagers, ...serviceAdvisors, ...managers];
  const filtered = allRows.filter((r) => roleFilter === "all" || r.role === roleFilter);
  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === "issues") return b.issues - a.issues;
    if (sortBy === "volume") return b.unitsOrDeals - a.unitsOrDeals;
    return b.totalGross - a.totalGross;
  });

  const coachingNotes = [
    ...salespeople
      .filter((s) => s.unitsOrDeals >= 2 && (s.issues ?? 0) >= 1)
      .map((s) => `${s.name} is high volume but has ${s.issues} low-front or issue deals needing desk review.`),
    ...serviceAdvisors
      .filter((a) => a.extraA?.includes("ELR $") && Number(a.extraA.split("ELR $")[1]?.split(" ·")[0]) < 145)
      .map((a) => `${a.name} has strong CP activity, but ELR is below target and needs pricing/upsell coaching.`),
    ...businessManagers
      .filter((b) => b.issues >= 1)
      .map((b) => `${b.name} has attachment opportunity on ${b.issues} deals where back-end product penetration is light.`),
  ].slice(0, 6);

  return (
    <div className="space-y-6">
      <section className="grid gap-4 xl:grid-cols-4">
        <SummaryCard title="Salespeople" lines={["Units", "Total Gross", "Avg Gross", "Front/Back", "Issue deals"]} />
        <SummaryCard title="Business Managers" lines={["Back Gross", "Avg Back Gross", "Terms", "Attachment opportunities"]} />
        <SummaryCard title="Service Advisors" lines={["CP Labour", "ELR", "HPRO", "CSI", "Sold wildcards"]} />
        <SummaryCard title="Managers" lines={["Team performance", "Deals managed", "Gross managed", "Issue count"]} />
      </section>

      <section className="flex flex-wrap gap-3 rounded-2xl bg-card p-4 shadow-sm ring-1 ring-border/70">
        <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="rounded-xl border border-input bg-white px-3 py-2.5 text-sm text-foreground">
          <option value="all">All roles</option>
          <option value="Salesperson">Salespeople</option>
          <option value="Business Manager">Business Managers</option>
          <option value="Service Advisor">Service Advisors</option>
          <option value="Manager">Managers</option>
        </select>
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value as "gross" | "issues" | "volume")} className="rounded-xl border border-input bg-white px-3 py-2.5 text-sm text-foreground">
          <option value="gross">Sort by Gross</option>
          <option value="volume">Sort by Volume</option>
          <option value="issues">Sort by Issue Count</option>
        </select>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <Card className="rounded-2xl bg-card shadow-sm ring-1 ring-border/70">
          <CardHeader><CardTitle className="flex items-center gap-2 text-foreground"><Trophy className="h-4 w-4 text-primary" />Leaderboard (sortable + filtered)</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-card">
                <TableRow>
                  <TableHead className="h-12 bg-muted/70">Name</TableHead>
                  <TableHead className="h-12 bg-muted/70">Role</TableHead>
                  <TableHead className="h-12 bg-muted/70 text-right">Volume</TableHead>
                  <TableHead className="h-12 bg-muted/70 text-right">Gross</TableHead>
                  <TableHead className="h-12 bg-muted/70 text-right">Avg Gross</TableHead>
                  <TableHead className="h-12 bg-muted/70 text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((row) => (
                  <TableRow key={`${row.role}-${row.name}`} className={row.totalGross < 0 ? "bg-red-50/70" : ""}>
                    <TableCell className="font-medium text-foreground">{row.name || emDash}</TableCell>
                    <TableCell className="text-muted-foreground">{row.role || emDash}</TableCell>
                    <TableCell className="text-right text-foreground">{row.unitsOrDeals ?? emDash}</TableCell>
                    <TableCell className={`text-right ${row.totalGross < 0 ? "text-red-700" : "text-foreground"}`}>{money(row.totalGross)}</TableCell>
                    <TableCell className="text-right text-foreground">{money(row.avgGross)}</TableCell>
                    <TableCell className="text-right">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${row.issues > 1 ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}`}>
                        {row.issues > 1 ? `Watch (${row.issues})` : "Healthy"}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="rounded-2xl bg-card shadow-sm ring-1 ring-border/70">
          <CardHeader><CardTitle className="flex items-center gap-2 text-foreground"><MessageSquareWarning className="h-4 w-4 text-[#DC2626]" />Coaching Notes</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            {coachingNotes.length > 0 ? coachingNotes.map((note) => <p key={note}>- {note}</p>) : <p>No coaching flags in this snapshot.</p>}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function SummaryCard({ title, lines }: { title: string; lines: string[] }) {
  return (
    <Card className="rounded-2xl bg-card shadow-sm ring-1 ring-border/70">
      <CardHeader><CardTitle className="text-foreground">{title}</CardTitle></CardHeader>
      <CardContent className="space-y-1 text-sm text-muted-foreground">{lines.map((line) => <p key={line}>- {line}</p>)}</CardContent>
    </Card>
  );
}
