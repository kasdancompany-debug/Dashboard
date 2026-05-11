import {
  PartsSummary,
  SalesDeal,
  SalesSummary,
  ServiceAdvisorPerformance,
  ServiceSummary,
} from "@/src/lib/types/dealership";
import { assessSalesDealsRisk } from "@/src/lib/risk/deal-risk-engine";

export type InsightAlert = {
  id: string;
  severity: "critical" | "warning" | "info" | "win";
  department: "sales" | "service" | "parts" | "store";
  title: string;
  description: string;
  recommendedAction: string;
  metricImpact: string;
};

export type DealershipDataBundle = {
  salesDeals: SalesDeal[];
  salesSummary: SalesSummary;
  serviceSummary: ServiceSummary;
  advisorPerformance: ServiceAdvisorPerformance[];
  partsSummary: PartsSummary;
  daysUsed: number;
  daysAvailable: number;
};

export function calculatePacing(actual: number, target: number, daysUsed: number, daysAvailable: number) {
  const paceTarget = (target / Math.max(1, daysAvailable)) * daysUsed;
  const variance = actual - paceTarget;
  const paceRatio = paceTarget === 0 ? 0 : actual / paceTarget;
  const projection = (actual / Math.max(1, daysUsed)) * daysAvailable;
  const status = paceRatio >= 1.03 ? "ahead" : paceRatio >= 0.97 ? "on-track" : "at-risk";
  return { paceTarget, variance, paceRatio, projection, status };
}

export function generateSalesAlerts(salesDeals: SalesDeal[], salesSummary: SalesSummary): InsightAlert[] {
  const alerts: InsightAlert[] = [];
  const riskRows = assessSalesDealsRisk(salesDeals, {
    frontAverage: salesSummary.frontAverage,
    backAverage: salesSummary.backAverage,
  }).sort((a, b) => b.risk.score - a.risk.score);
  const topRiskDeal = riskRows[0];
  const negativeFront = salesDeals.filter((d) => d.frontGross < 0);
  const zeroGross = salesDeals.filter((d) => d.totalGross === 0);
  const tbdData = salesDeals.filter((d) => [d.stockNumber, d.businessManager, d.notes].some((f) => f.toUpperCase().includes("TBD") || f.toUpperCase().includes("NT")));
  const incoming = salesDeals.filter((d) => d.status === "incoming" || d.status === "preorder");
  const usedBackHeavy = salesDeals.filter((d) => d.dealType === "used" && d.backGross > Math.max(1, d.frontGross) * 1.5);

  if (negativeFront.length > 0) {
    alerts.push({
      id: "sales-negative-front",
      severity: "critical",
      department: "sales",
      title: "Negative front gross deals detected",
      description: `${negativeFront.length} deals are below zero front gross, led by ${negativeFront[0].id}.`,
      recommendedAction: "Review all negative-front deals at desk close and enforce manager override notes before funding.",
      metricImpact: `Estimated front-end drag: $${Math.abs(negativeFront.reduce((a, d) => a + d.frontGross, 0)).toLocaleString()}`,
    });
  }

  if (salesSummary.backAverage < 1700) {
    alerts.push({
      id: "sales-low-back-copy",
      severity: "warning",
      department: "sales",
      title: "Back gross per copy below target",
      description: `Back average is $${salesSummary.backAverage.toLocaleString()} vs expected $1,700+ benchmark.`,
      recommendedAction: "Coach F&I turnover quality and menu presentation on high-probability approval profiles.",
      metricImpact: `Opportunity gap: ~$${((1700 - salesSummary.backAverage) * salesSummary.totalUnits).toLocaleString()}`,
    });
  }

  if (zeroGross.length > 0) {
    alerts.push({
      id: "sales-zero-gross",
      severity: "warning",
      department: "sales",
      title: "Zero total gross deals in pipeline",
      description: `${zeroGross.length} deals currently show zero total gross.`,
      recommendedAction: "Require desk validation on pack, reserve, and product fields before deal posting.",
      metricImpact: `At-risk gross: $${(zeroGross.length * salesSummary.perCopy).toLocaleString()} potential`,
    });
  }

  if (tbdData.length > 0 || incoming.length > 0 || usedBackHeavy.length > 0) {
    alerts.push({
      id: "sales-data-quality",
      severity: "info",
      department: "sales",
      title: "Sales pipeline quality checks required",
      description: `${tbdData.length} deals with TBD/NT fields, ${incoming.length} incoming/preorders, ${usedBackHeavy.length} back-heavy used deals.`,
      recommendedAction: "Run daily data cleanup and rebalance used deal gross mix before tomorrow's desk meeting.",
      metricImpact: "Improves close predictability and protects gross quality.",
    });
  }

  if (topRiskDeal && topRiskDeal.risk.score >= 65) {
    alerts.push({
      id: "sales-risk-engine",
      severity: "critical",
      department: "sales",
      title: "Deal Risk Engine flagged high-risk deal structure",
      description: `${topRiskDeal.deal.id} scores ${topRiskDeal.risk.score}/100 (${topRiskDeal.risk.level}) with ${topRiskDeal.risk.reasons.slice(0, 2).join(" and ")}.`,
      recommendedAction: topRiskDeal.risk.recommendedAction,
      metricImpact: "High-risk desked deal can materially affect month-end gross quality.",
    });
  }

  return alerts;
}

export function generateServiceAlerts(serviceSummary: ServiceSummary, advisorPerformance: ServiceAdvisorPerformance[]): InsightAlert[] {
  const alerts: InsightAlert[] = [];
  const lowElrAdvisors = advisorPerformance.filter((a) => a.elr < 140);
  const lowCsiAdvisors = advisorPerformance.filter((a) => a.csiScore < 95);

  if (serviceSummary.cpLaborActual < serviceSummary.dailyCpLaborGoal) {
    alerts.push({
      id: "service-cp-labor",
      severity: "critical",
      department: "service",
      title: "CP labour below daily goal",
      description: `CP labour actual is $${serviceSummary.cpLaborActual.toFixed(1)} vs goal $${serviceSummary.dailyCpLaborGoal.toFixed(1)}.`,
      recommendedAction: "Audit sold hours by advisor before noon and push same-day maintenance upsell closes.",
      metricImpact: `Daily gap: $${(serviceSummary.dailyCpLaborGoal - serviceSummary.cpLaborActual).toFixed(1)} ELR equivalent`,
    });
  }

  if (serviceSummary.totalGross > serviceSummary.forecastGross * 0.9 && serviceSummary.customerSales < serviceSummary.totalSales * 0.65) {
    alerts.push({
      id: "service-mix-risk",
      severity: "warning",
      department: "service",
      title: "Service gross ahead but customer-pay mix soft",
      description: "Total gross is healthy, but customer-pay is lagging relative to total service sales mix.",
      recommendedAction: "Reinforce advisor CP menu discipline and target deferred maintenance opportunities.",
      metricImpact: `CP share: ${((serviceSummary.customerSales / serviceSummary.totalSales) * 100).toFixed(1)}%`,
    });
  }

  if (lowElrAdvisors.length > 0 || lowCsiAdvisors.length > 0) {
    alerts.push({
      id: "service-advisor-performance",
      severity: "warning",
      department: "service",
      title: "Advisor coaching required",
      description: `${lowElrAdvisors.length} advisors below ELR target and ${lowCsiAdvisors.length} below CSI expectation.`,
      recommendedAction: "Schedule same-day coaching with low ELR/CSI advisors and review pricing consistency.",
      metricImpact: `ELR/CSI risk: ${[...new Set([...lowElrAdvisors, ...lowCsiAdvisors].map((a) => a.name))].join(", ")}`,
    });
  }

  return alerts;
}

export function generatePartsAlerts(partsSummary: PartsSummary): InsightAlert[] {
  const alerts: InsightAlert[] = [];
  const salesPacing = calculatePacing(partsSummary.totalSales, partsSummary.forecastSales, 29, 30);
  const grossPacing = calculatePacing(partsSummary.totalGross, partsSummary.forecastGross, 29, 30);
  const warrantyMix = partsSummary.warrantySales / Math.max(1, partsSummary.totalSales);

  if (salesPacing.status === "at-risk") {
    alerts.push({
      id: "parts-forecast-behind",
      severity: "warning",
      department: "parts",
      title: "Parts sales forecast behind pace",
      description: `Current pace projects $${Math.round(salesPacing.projection).toLocaleString()} vs $${partsSummary.forecastSales.toLocaleString()} forecast.`,
      recommendedAction: "Prioritize customer-pay parts pull-through and review overdue special-order completions.",
      metricImpact: `Forecast variance: $${Math.abs(Math.round(salesPacing.variance)).toLocaleString()}`,
    });
  }

  if (warrantyMix > 0.28) {
    alerts.push({
      id: "parts-warranty-overdependency",
      severity: "info",
      department: "parts",
      title: "Warranty overdependency risk",
      description: `Warranty sales are ${(warrantyMix * 100).toFixed(1)}% of total parts sales.`,
      recommendedAction: "Increase retail counter campaigns and advisor-led maintenance kits to balance mix.",
      metricImpact: "Mix concentration risk if warranty flow slows.",
    });
  }

  if (grossPacing.status === "at-risk") {
    alerts.push({
      id: "parts-gross-behind",
      severity: "warning",
      department: "parts",
      title: "Parts gross behind pace",
      description: `Gross pace is below month-end objective by $${Math.abs(Math.round(grossPacing.variance)).toLocaleString()}.`,
      recommendedAction: "Audit margin exceptions and adjust pricing on high-turn SKUs before close.",
      metricImpact: `Gross projection: $${Math.round(grossPacing.projection).toLocaleString()}`,
    });
  }

  return alerts;
}

export function calculateStoreHealthScore(allData: DealershipDataBundle) {
  const salesPacing = calculatePacing(allData.salesSummary.totalGross, allData.salesSummary.targetGross, allData.daysUsed, allData.daysAvailable);
  const servicePacing = calculatePacing(allData.serviceSummary.totalGross, allData.serviceSummary.forecastGross, allData.daysUsed, allData.daysAvailable);
  const partsPacing = calculatePacing(allData.partsSummary.totalGross, allData.partsSummary.forecastGross, allData.daysUsed, allData.daysAvailable);
  const boundedPct = (ratio: number) => Math.max(0, Math.min(110, ratio * 100));
  const baseScore =
    boundedPct(salesPacing.paceRatio) * 0.4 +
    boundedPct(servicePacing.paceRatio) * 0.35 +
    boundedPct(partsPacing.paceRatio) * 0.25;

  const tbdPenalty =
    allData.salesDeals.filter((d) => {
      const stock = d.stockNumber.toLowerCase();
      const manager = d.businessManager.toLowerCase();
      return stock === "tbd" || stock === "nt" || manager === "tbd" || manager === "nt";
    }).length * 1.5;
  const unclassifiedPenalty = allData.salesDeals.filter((d) => d.dealType === "unknown").length * 0.8;
  const negativeFrontPenalty = allData.salesDeals.filter((d) => d.frontGross < 0).length * 2;

  const score = Math.max(0, Math.min(100, Math.round(baseScore - tbdPenalty - unclassifiedPenalty - negativeFrontPenalty)));
  return score;
}

export function generateStoreBriefing(allData: DealershipDataBundle) {
  const salesAlerts = generateSalesAlerts(allData.salesDeals, allData.salesSummary);
  const serviceAlerts = generateServiceAlerts(allData.serviceSummary, allData.advisorPerformance);
  const partsAlerts = generatePartsAlerts(allData.partsSummary);
  const alerts = [...salesAlerts, ...serviceAlerts, ...partsAlerts];
  const storeHealthScore = calculateStoreHealthScore(allData);

  const topRisks = alerts.filter((a) => a.severity === "critical" || a.severity === "warning").slice(0, 3);
  const headline =
    "Service gross is carrying month-end pace while used front gross and parts mix quality remain the biggest controllable risks.";

  return {
    storeHealthScore,
    headline,
    wins: [
      `Service gross pacing is stable at $${allData.serviceSummary.totalGross.toLocaleString()}.`,
      `Sales back-end performance remains strong at $${allData.salesSummary.backAverage.toLocaleString()} per copy.`,
      "Parts team is maintaining operational continuity despite mix pressure.",
    ],
    risks: topRisks.map((r) => r.title),
    recommendedActions: topRisks.map((r) => r.recommendedAction),
    alerts,
  };
}
