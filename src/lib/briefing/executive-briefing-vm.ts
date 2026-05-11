import type { ExecutiveDealSignals } from "@/src/lib/briefing/executive-deal-signals";
import type { SourceHealthPayload } from "@/src/lib/data-pipeline/source-trace";
import type { ProfitLeakFinding } from "@/src/lib/diagnostics/profit-leak-detection";
import type { AccountabilityItem, AtRiskDeal } from "@/src/lib/profit-engine/types";
import type { PaceStatus } from "@/src/lib/types/dealership";

export type MoneyAtRiskRow = {
  id: string;
  rank: number;
  title: string;
  impact: number;
  decision: string;
  tag: string;
};

export type AccountabilityRow = {
  id: string;
  name: string;
  role: string;
  riskAmount: number;
  issueCount: number;
  severity: "high" | "medium" | "low";
};

export type RequiredActionRow = {
  id: string;
  what: string;
  who: string;
  deadline: string;
  impact: number;
  status: string;
};

export type ConfidenceWarning = {
  id: string;
  title: string;
  detail: string;
  decision: string;
  severity: "critical" | "warn" | "info";
};

export type ExecutiveBriefingVM = {
  moneyAtRisk: MoneyAtRiskRow[];
  accountability: AccountabilityRow[];
  requiredActions: RequiredActionRow[];
  confidenceWarnings: ConfidenceWarning[];
  forecast: {
    headline: string;
    paragraphs: string[];
    bullets: string[];
  };
};

export type ForecastInsightsShape = {
  summary: { totalActual: number; totalForecast: number; variance: number; variancePercent: number };
  topAbove: Array<{ metric: string; variance: number; variancePercent: number }>;
  topBelow: Array<{ metric: string; variance: number; variancePercent: number }>;
};

function buildForecastNarrative(params: {
  daysUsed: number;
  daysAvailable: number;
  forecast: ForecastInsightsShape | undefined;
  pace: { sales: PaceStatus; service: PaceStatus; parts: PaceStatus };
}): ExecutiveBriefingVM["forecast"] {
  const { daysUsed, daysAvailable, forecast: fi, pace } = params;
  if (!fi) {
    return {
      headline: "Forecast baseline unavailable",
      paragraphs: ["Connect the forecast workbook tab so pace can be compared to a single monthly target."],
      bullets: [],
    };
  }

  const { variance, variancePercent, totalActual, totalForecast } = fi.summary;
  const calendarPct = daysAvailable > 0 ? Math.round((daysUsed / daysAvailable) * 100) : 0;
  const ahead = variance > 0;
  const headline = ahead
    ? `Above forecast pace by ${Math.abs(variancePercent).toFixed(1)}%`
    : variance < 0
      ? `Below forecast pace by ${Math.abs(variancePercent).toFixed(1)}%`
      : "On forecast baseline";

  const paras: string[] = [];
  paras.push(
    `The calendar is about ${calendarPct}% through the month. Store gross is ${ahead ? "running hot" : variance < 0 ? "trailing" : "aligned"} versus the forecast tab: roughly $${Math.round(totalActual / 1000)}K actual vs $${Math.round(
      totalForecast / 1000,
    )}K forecast.`,
  );

  if (ahead) {
    paras.push(
      "Decision: bank the upside by tightening exceptions—do not buy volume with a weak front-end. Shift management time to protecting F&I quality and fast funding on clean deals.",
    );
  } else if (variance < 0) {
    paras.push(
      "Decision: treat the gap as a mid-month correction, not a month-end surprise. Re-allocate daily stand-up time to the weakest department lines until variance flattens.",
    );
  } else {
    paras.push("Decision: hold the line—keep exception discipline so small slippages in one department do not compound.");
  }

  paras.push(`Department pace flags: Sales ${pace.sales}, Service ${pace.service}, Parts ${pace.parts}.`);

  const bullets: string[] = [];
  fi.topBelow.slice(0, 2).forEach((row) => {
    bullets.push(`${row.metric} is the largest drag (${row.variancePercent.toFixed(1)}% vs forecast)—prioritize manager hours here first.`);
  });
  fi.topAbove.slice(0, 2).forEach((row) => {
    bullets.push(`${row.metric} is carrying upside (${row.variancePercent.toFixed(1)}% vs forecast)—use it to offset weaker lines without lowering standards.`);
  });

  return { headline, paragraphs: paras, bullets };
}

export function buildExecutiveBriefingVm(input: {
  atRiskDeals: AtRiskDeal[];
  profitLeaks: ProfitLeakFinding[];
  accountability: AccountabilityItem[];
  forecastInsights: ForecastInsightsShape | undefined;
  daysUsed: number;
  daysAvailable: number;
  sourceHealth: SourceHealthPayload | undefined;
  dataQuality: { missingTbdFields: number; issues: string[] } | undefined;
  dealSignals: ExecutiveDealSignals | undefined;
  pace: { sales: PaceStatus; service: PaceStatus; parts: PaceStatus };
  deadlineLabel: string;
}): ExecutiveBriefingVM {
  const { atRiskDeals, profitLeaks, accountability, forecastInsights, daysUsed, daysAvailable, sourceHealth, dataQuality, dealSignals, pace, deadlineLabel } = input;

  const combined = [
    ...atRiskDeals.map((d) => ({
      id: `ar-${d.dealId}`,
      title: `${d.customer} · ${d.vehicle}`,
      impact: d.estimatedRecoverableGross,
      decision: d.recommendedAction,
      tag: "At-risk deal",
    })),
    ...profitLeaks.map((l, i) => ({
      id: `pl-${i}-${l.issue.slice(0, 24)}`,
      title: l.issue,
      impact: l.impactValue ?? 0,
      decision: l.recommendation,
      tag: `${l.department} leak`,
    })),
  ]
    .sort((a, b) => b.impact - a.impact)
    .slice(0, 5)
    .map((r, idx) => ({ ...r, rank: idx + 1 }));

  const moneyAtRisk: MoneyAtRiskRow[] = combined.map((r) => ({
    id: r.id,
    rank: r.rank,
    title: r.title,
    impact: r.impact,
    decision: r.decision,
    tag: r.tag,
  }));

  const accountabilityRows: AccountabilityRow[] = accountability
    .map((a, idx) => {
      const sev: AccountabilityRow["severity"] = a.totalDollarImpact >= 35000 ? "high" : a.totalDollarImpact >= 18000 ? "medium" : "low";
      return {
        id: `acc-owner-${idx}`,
        name: a.person || "Unassigned",
        role: a.role || `${a.department} lead`,
        riskAmount: Math.max(0, a.totalDollarImpact ?? 0),
        issueCount: Math.max(0, a.issueCount ?? 0),
        severity: sev,
      };
    })
    .sort((a, b) => b.riskAmount - a.riskAmount)
    .slice(0, 8);

  const requiredActions: RequiredActionRow[] = [
    ...atRiskDeals.slice(0, 4).map((d, i) => ({
      id: `req-deal-${i}`,
      what: d.recommendedAction,
      who: `${d.manager} (desk) · ${d.salesperson} · ${d.businessManager || "BM"}`,
      deadline: deadlineLabel,
      impact: d.estimatedRecoverableGross,
      status: "Required today",
    })),
    ...profitLeaks.slice(0, 4).map((l, i) => ({
      id: `req-leak-${i}`,
      what: l.recommendation,
      who: `${l.department} manager + GM`,
      deadline: deadlineLabel,
      impact: l.impactValue ?? 0,
      status: "Required today",
    })),
    ...accountability.slice(0, 3).map((a, i) => ({
      id: `req-acc-${i}`,
      what: a.recommendedCoachingAction,
      who: `${a.person} (${a.role})`,
      deadline: deadlineLabel,
      impact: a.totalDollarImpact,
      status: "Coaching required",
    })),
  ]
    .sort((a, b) => b.impact - a.impact)
    .slice(0, 8);

  const confidenceWarnings: ConfidenceWarning[] = [];

  sourceHealth?.staleDataWarnings.forEach((w, i) => {
    confidenceWarnings.push({
      id: `stale-${i}`,
      title: "Source tab does not match reporting month",
      detail: w,
      decision: "Open the correct month tab in each workbook before publishing numbers to the principal.",
      severity: "critical",
    });
  });

  sourceHealth?.departments.forEach((d, i) => {
    if (d.freshnessStatus === "stale") {
      confidenceWarnings.push({
        id: `stale-dept-${d.department}-${i}`,
        title: `${d.department}: workbook tab looks like a prior month`,
        detail: d.validationWarning ?? `Tab "${d.sheetTab ?? "—"}" vs reporting month mismatch.`,
        decision: "Switch to the current-month tab or update the dashboard reporting month to match what dealers are actually posting.",
        severity: "critical",
      });
    }
    if (d.freshnessStatus === "error" && d.formulaErrors.length) {
      confidenceWarnings.push({
        id: `fe-${d.department}-${i}`,
        title: `${d.department}: formula errors in grid`,
        detail: d.formulaErrors.slice(0, 3).join(" · "),
        decision: "Repair broken cells before trusting totals; treat dashboard figures as provisional.",
        severity: "critical",
      });
    }
    if (d.monthUnknown && d.sheetTab) {
      confidenceWarnings.push({
        id: `unk-${d.department}-${i}`,
        title: `${d.department}: current-month sheet not confirmed from tab name`,
        detail: `Tab “${d.sheetTab}” could not be matched to the reporting month.`,
        decision: "Rename tab to include month/year (e.g. MAY 26) or confirm range manually.",
        severity: "warn",
      });
    }
  });

  dataQuality?.issues.forEach((issue, i) => {
    if (issue.includes("Formula error")) {
      confidenceWarnings.push({
        id: `dq-fe-${i}`,
        title: "Spreadsheet formula fault",
        detail: issue,
        decision: "Assign workbook owner to clear the error and re-post the row.",
        severity: "critical",
      });
    }
    if (issue.includes("Reporting month mismatch")) {
      confidenceWarnings.push({
        id: `dq-mm-${i}`,
        title: "Month alignment warning",
        detail: issue,
        decision: "Do not present this dashboard as current-month final until sources align.",
        severity: "critical",
      });
    }
  });

  if (dealSignals) {
    if (dealSignals.unclassifiedDeals > 0) {
      confidenceWarnings.push({
        id: "dq-unclassified",
        title: "Unclassified new/used deals",
        detail: `${dealSignals.unclassifiedDeals} deal(s) lack a clear new vs used classification in the log.`,
        decision: "Fix classification today—forecast and mix reporting are unreliable until resolved.",
        severity: "warn",
      });
    }
    if (dealSignals.zeroGrossDeals > 0) {
      confidenceWarnings.push({
        id: "dq-zero",
        title: "Zero-gross deals",
        detail: `${dealSignals.zeroGrossDeals} deal(s) show $0 total gross.`,
        decision: "Validate each is intentional (wholesale/float) or re-desk before funding.",
        severity: "warn",
      });
    }
    if (dealSignals.missingFrontGrossDeals > 0) {
      confidenceWarnings.push({
        id: "dq-front",
        title: "Missing / zero front gross with positive total",
        detail: `${dealSignals.missingFrontGrossDeals} deal(s) carry positive total but $0 front.`,
        decision: "Desk review: confirm front is captured or intentionally back-loaded; fix sheet rows.",
        severity: "warn",
      });
    }
    if (dealSignals.missingBackGrossDeals > 0) {
      confidenceWarnings.push({
        id: "dq-back",
        title: "Missing / zero back gross with positive total",
        detail: `${dealSignals.missingBackGrossDeals} deal(s) carry positive total but $0 back.`,
        decision: "Pull F&I to confirm reserve and product penetration are posted.",
        severity: "warn",
      });
    }
  }

  if ((dataQuality?.missingTbdFields ?? 0) > 0) {
    confidenceWarnings.push({
      id: "dq-tbd",
      title: "TBD / incomplete deal fields",
      detail: `${dataQuality?.missingTbdFields} deal row(s) still show TBD/NT in critical fields.`,
      decision: "Complete stock, BM, and notes fields so risk scoring and funding reviews are trustworthy.",
      severity: "info",
    });
  }

  const forecast = buildForecastNarrative({
    daysUsed,
    daysAvailable,
    forecast: forecastInsights,
    pace,
  });

  return {
    moneyAtRisk,
    accountability: accountabilityRows,
    requiredActions,
    confidenceWarnings,
    forecast,
  };
}
