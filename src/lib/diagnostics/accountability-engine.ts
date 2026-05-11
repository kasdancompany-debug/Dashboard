import { assessSalesDealsRisk } from "@/src/lib/risk/deal-risk-engine";
import { PartsSummary, SalesDeal, SalesSummary, ServiceAdvisorPerformance } from "@/src/lib/types/dealership";

export type AccountabilityItem = {
  person: string;
  department: "Sales" | "Service" | "Parts";
  issue: string;
  severity: "low" | "medium" | "high";
  actionRequired: string;
  flaggedCount: number;
};

export function generateAccountabilityItems(input: {
  salesDeals: SalesDeal[];
  salesSummary: SalesSummary;
  serviceAdvisors: ServiceAdvisorPerformance[];
  partsSummary: PartsSummary;
}) {
  const { salesDeals, salesSummary, serviceAdvisors, partsSummary } = input;
  const items: AccountabilityItem[] = [];

  const riskRows = assessSalesDealsRisk(salesDeals, {
    frontAverage: salesSummary.frontAverage,
    backAverage: salesSummary.backAverage,
  }).sort((a, b) => b.risk.score - a.risk.score);

  const salesByPerson = new Map<string, { atRisk: number; riskSum: number; gross: number; units: number }>();
  for (const row of riskRows) {
    const key = row.deal.salesperson;
    const current = salesByPerson.get(key) ?? { atRisk: 0, riskSum: 0, gross: 0, units: 0 };
    current.units += 1;
    current.gross += row.deal.totalGross;
    current.riskSum += row.risk.score;
    if (row.risk.score >= 55) current.atRisk += 1;
    salesByPerson.set(key, current);
  }

  for (const [person, stat] of salesByPerson.entries()) {
    const avgGross = stat.units ? stat.gross / stat.units : 0;
    if (stat.atRisk > 0) {
      items.push({
        person,
        department: "Sales",
        issue: `${stat.atRisk} at-risk deals`,
        severity: stat.atRisk >= 3 ? "high" : "medium",
        actionRequired: "Desk review each flagged deal before funding.",
        flaggedCount: stat.atRisk,
      });
    } else if (avgGross < salesSummary.perCopy * 0.8) {
      items.push({
        person,
        department: "Sales",
        issue: "Low average gross",
        severity: "medium",
        actionRequired: "Coach pricing discipline and front-end structure.",
        flaggedCount: 1,
      });
    }
  }

  for (const advisor of serviceAdvisors) {
    if (advisor.elr < 140) {
      items.push({
        person: advisor.name,
        department: "Service",
        issue: "Below ELR target",
        severity: advisor.elr < 135 ? "high" : "medium",
        actionRequired: "Run pricing/menu compliance coaching before peak hours.",
        flaggedCount: 1,
      });
    }
  }

  if (partsSummary.internalSales / Math.max(1, partsSummary.totalSales) > 0.3) {
    items.push({
      person: "S. Brooks",
      department: "Parts",
      issue: "Special-order exposure",
      severity: "medium",
      actionRequired: "Confirm top SKU commitments and expedite delayed special orders.",
      flaggedCount: 1,
    });
  }

  return items.sort((a, b) => b.flaggedCount - a.flaggedCount);
}

export function groupAccountabilityByDepartment(items: AccountabilityItem[]) {
  return {
    Sales: items.filter((i) => i.department === "Sales"),
    Service: items.filter((i) => i.department === "Service"),
    Parts: items.filter((i) => i.department === "Parts"),
  };
}
