import { AccountabilityItem, ProfitEngineInput, ProfitLeak, Severity } from "@/src/lib/profit-engine/types";
import { getTopAtRiskDeals } from "@/src/lib/profit-engine/sales-risk-engine";
import { generateProfitLeaks } from "@/src/lib/profit-engine/profit-leak-engine";

type MutableAccountability = AccountabilityItem & {
  issueTitles: string[];
};

const severityWeight: Record<Severity, number> = { low: 1, medium: 2, high: 3 };

function maxSeverity(a: Severity, b: Severity): Severity {
  return severityWeight[a] >= severityWeight[b] ? a : b;
}

function normalizePersonKey(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function normalizePersonDisplay(value: string) {
  const compact = value.trim().replace(/\s+/g, " ");
  if (!compact) return "Unknown";
  return compact
    .toLowerCase()
    .split(" ")
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(" ");
}

function pushIssue(
  bucket: Map<string, MutableAccountability>,
  key: string,
  seed: Omit<MutableAccountability, "issueTitles" | "issueCount" | "totalDollarImpact" | "topIssue">,
  issueTitle: string,
  dollarImpact: number,
  severity: Severity,
) {
  const current = bucket.get(key);
  if (!current) {
    bucket.set(key, {
      ...seed,
      issueCount: 1,
      totalDollarImpact: Math.max(0, Math.round(dollarImpact)),
      topIssue: issueTitle,
      severity,
      issueTitles: [issueTitle],
    });
    return;
  }
  current.issueCount += 1;
  current.totalDollarImpact += Math.max(0, Math.round(dollarImpact));
  current.severity = maxSeverity(current.severity, severity);
  if (!current.issueTitles.includes(issueTitle)) current.issueTitles.push(issueTitle);
  if (Math.max(0, Math.round(dollarImpact)) > 0) current.topIssue = issueTitle;
  bucket.set(key, current);
}

function assignLeakByRole(leak: ProfitLeak): Array<{ person: string; role: string; department: AccountabilityItem["department"] }> {
  if (leak.department === "Sales") {
    if (leak.ownerRole.includes("F&I")) return [{ person: "F&I Lead", role: "Business Manager", department: "Sales" }];
    if (leak.ownerRole.includes("Desk")) return [{ person: "Sales Desk", role: "Sales Manager", department: "Sales" }];
    return [{ person: "Sales Leadership", role: "Sales Manager", department: "Sales" }];
  }
  if (leak.department === "Service") {
    if (leak.ownerRole.includes("Advisors")) {
      return [
        { person: "J. Martin", role: "Service Advisor", department: "Service" },
        { person: "N. Caron", role: "Service Advisor", department: "Service" },
      ];
    }
    return [{ person: "Service Leadership", role: "Service Manager", department: "Service" }];
  }
  return [{ person: "S. Brooks", role: "Parts Manager", department: "Parts" }];
}

export function generateManagerAccountability(input: ProfitEngineInput): {
  all: AccountabilityItem[];
  groupedByDepartment: Record<"Sales" | "Service" | "Parts", AccountabilityItem[]>;
} {
  const bucket = new Map<string, MutableAccountability>();

  const atRiskDeals =
    input.dealRisks ??
    getTopAtRiskDeals(input.salesDeals, 30, {
      frontAverage: input.salesSummary.frontAverage,
      backAverage: input.salesSummary.backAverage,
    });
  const leaks = generateProfitLeaks({ ...input, dealRisks: atRiskDeals }).slice(0, 8);

  for (const deal of atRiskDeals) {
    const salespersonKey = normalizePersonKey(deal.salesperson);
    const managerKey = normalizePersonKey(deal.manager);
    const bmKey = normalizePersonKey(deal.businessManager);
    pushIssue(
      bucket,
      `salesperson:${salespersonKey}`,
      {
        person: normalizePersonDisplay(deal.salesperson),
        department: "Sales",
        role: "Salesperson",
        recommendedCoachingAction: "Tighten front-end structure and escalate weak deals before funding.",
        severity: deal.riskLevel,
      },
      deal.reasons[0] ?? "At-risk deal structure",
      deal.estimatedRecoverableGross,
      deal.riskLevel,
    );

    pushIssue(
      bucket,
      `manager:${managerKey}`,
      {
        person: normalizePersonDisplay(deal.manager),
        department: "Sales",
        role: "Sales Manager",
        recommendedCoachingAction: "Run same-day desk exception review and approve only corrected structures.",
        severity: deal.riskLevel,
      },
      `Desk oversight: ${deal.reasons[0] ?? "At-risk deals"}`,
      deal.estimatedRecoverableGross,
      deal.riskLevel,
    );

    pushIssue(
      bucket,
      `bm:${bmKey}`,
      {
        person: normalizePersonDisplay(deal.businessManager),
        department: "Sales",
        role: "Business Manager",
        recommendedCoachingAction: "Reduce back-end dependency and complete missing F&I fields at turnover.",
        severity: deal.riskLevel,
      },
      `F&I structure risk on ${deal.dealId}`,
      Math.round(deal.estimatedRecoverableGross * 0.4),
      deal.riskLevel,
    );
  }

  for (const advisor of input.serviceAdvisors) {
    const elrGap = Math.max(0, 140 - advisor.elr);
    const hproGap = Math.max(0, 2.8 - advisor.hpro);
    const csiGap = Math.max(0, 95 - advisor.csiScore);
    const totalImpact = Math.round(elrGap * 220 + hproGap * 1300 + csiGap * 500);
    if (totalImpact <= 0) continue;
    const severity: Severity = totalImpact >= 5000 ? "high" : totalImpact >= 2200 ? "medium" : "low";
    const topIssue = elrGap > 0 ? "ELR below target" : hproGap > 0 ? "HPRO below target" : "CSI pressure risk";

    pushIssue(
      bucket,
      `service:${normalizePersonKey(advisor.name)}`,
      {
        person: normalizePersonDisplay(advisor.name),
        department: "Service",
        role: "Service Advisor",
        recommendedCoachingAction: "Focus on estimate quality, menu conversion, and callback discipline today.",
        severity,
      },
      topIssue,
      totalImpact,
      severity,
    );
  }

  for (const leak of leaks) {
    for (const owner of assignLeakByRole(leak)) {
      pushIssue(
        bucket,
        `leak:${owner.department}:${owner.role}:${owner.person}`,
        {
          person: owner.person,
          department: owner.department,
          role: owner.role,
          recommendedCoachingAction: leak.recommendedAction,
          severity: leak.severity,
        },
        leak.title,
        leak.dollarImpact,
        leak.severity,
      );
    }
  }

  const sorted = Array.from(bucket.values())
    .map(({ issueTitles, ...item }) => ({
      ...item,
      topIssue: item.topIssue || issueTitles[0] || "Operational risk signal",
      totalDollarImpact: Math.round(item.totalDollarImpact),
    }))
    .sort((a, b) => {
      if (severityWeight[b.severity] !== severityWeight[a.severity]) {
        return severityWeight[b.severity] - severityWeight[a.severity];
      }
      if (b.totalDollarImpact !== a.totalDollarImpact) return b.totalDollarImpact - a.totalDollarImpact;
      return b.issueCount - a.issueCount;
    });

  return {
    all: sorted,
    groupedByDepartment: {
      Sales: sorted.filter((i) => i.department === "Sales"),
      Service: sorted.filter((i) => i.department === "Service"),
      Parts: sorted.filter((i) => i.department === "Parts"),
    },
  };
}
