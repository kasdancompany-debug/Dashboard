import { ProfitEngineInput, ProfitLeak, Severity } from "@/src/lib/profit-engine/types";
import { getTopAtRiskDeals } from "@/src/lib/profit-engine/sales-risk-engine";

const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);

const confidenceFrom = (value: number, high: number, medium: number): Severity =>
  value >= high ? "high" : value >= medium ? "medium" : "low";

export function generateProfitLeaks(input: ProfitEngineInput): ProfitLeak[] {
  const leaks: ProfitLeak[] = [];
  const dealRisks =
    input.dealRisks ??
    getTopAtRiskDeals(input.salesDeals, 50, {
      frontAverage: input.salesSummary.frontAverage,
      backAverage: input.salesSummary.backAverage,
    });

  // Sales
  const frontGrossGap = Math.max(0, input.salesSummary.targetGross - input.salesSummary.totalGross);
  if (frontGrossGap > 0) {
    leaks.push({
      department: "Sales",
      title: "Front gross below target",
      severity: confidenceFrom(frontGrossGap, 70000, 30000),
      dollarImpact: frontGrossGap,
      cause: "Current front-end production is below target pace for the month.",
      ownerRole: "Sales Managers",
      recommendedAction: "Escalate all sub-threshold deals and enforce desk minimums before funding.",
      confidence: confidenceFrom(frontGrossGap, 70000, 30000),
    });
  }

  const usedNegativeFront = input.salesDeals.filter((d) => d.dealType === "used" && d.frontGross < 0).length;
  if (usedNegativeFront > 0) {
    const impact = usedNegativeFront * Math.max(1800, Math.round(input.salesSummary.frontAverage * 0.6));
    leaks.push({
      department: "Sales",
      title: "Used front gross negative",
      severity: usedNegativeFront >= 2 ? "high" : "medium",
      dollarImpact: impact,
      cause: `${usedNegativeFront} used deal(s) are carrying negative front-end outcomes.`,
      ownerRole: "Used Car Manager",
      recommendedAction: "Reprice affected units and require pre-funding manager sign-off.",
      confidence: usedNegativeFront >= 2 ? "high" : "medium",
    });
  }

  const backHeavyDeals = input.salesDeals.filter(
    (d) => d.totalGross > 0 && d.backGross / Math.max(1, d.totalGross) > 0.75,
  ).length;
  if (backHeavyDeals > 0) {
    const impact = backHeavyDeals * Math.max(1200, Math.round(input.salesSummary.frontAverage * 0.35));
    leaks.push({
      department: "Sales",
      title: "Back-end dependency too high",
      severity: backHeavyDeals >= 4 ? "high" : "medium",
      dollarImpact: impact,
      cause: `${backHeavyDeals} deal(s) depend on back-end products to carry total gross.`,
      ownerRole: "F&I Director",
      recommendedAction: "Raise front-end floor and audit deal structure mix at desk close.",
      confidence: backHeavyDeals >= 4 ? "medium" : "low",
    });
  }

  const volumeHealthy = input.salesSummary.totalUnits >= Math.round(input.salesSummary.targetUnits * 0.84);
  const perCopyWeak = input.salesSummary.perCopy < input.salesSummary.trackingGross / Math.max(1, input.salesSummary.trackingVolume);
  if (volumeHealthy && perCopyWeak) {
    const benchmarkPerCopy = input.salesSummary.trackingGross / Math.max(1, input.salesSummary.trackingVolume);
    const perCopyGap = Math.max(0, benchmarkPerCopy - input.salesSummary.perCopy);
    const impact = Math.round(perCopyGap * input.salesSummary.totalUnits);
    leaks.push({
      department: "Sales",
      title: "Volume healthy but per-copy weak",
      severity: confidenceFrom(impact, 60000, 25000),
      dollarImpact: impact,
      cause: "Unit pace is acceptable, but deal quality is diluting gross per unit.",
      ownerRole: "Sales Desk",
      recommendedAction: "Shift focus to quality deals and tighten front-end gross discipline.",
      confidence: confidenceFrom(impact, 60000, 25000),
    });
  }

  const missingDataDeals = input.salesDeals.filter(
    (d) =>
      /(TBD|NT)/i.test(d.stockNumber ?? "") ||
      /(TBD|NT)/i.test(d.businessManager ?? "") ||
      /(TBD|NT)/i.test(d.notes ?? ""),
  ).length;
  if (missingDataDeals > 0) {
    const impact = missingDataDeals * 700;
    leaks.push({
      department: "Sales",
      title: "Missing deal data visibility risk",
      severity: missingDataDeals >= 3 ? "medium" : "low",
      dollarImpact: impact,
      cause: `${missingDataDeals} deal(s) include TBD/NT fields that reduce desk visibility.`,
      ownerRole: "Sales Admin",
      recommendedAction: "Complete critical fields before funding and enforce data quality gate.",
      confidence: "medium",
    });
  }

  // Service
  const cpLaborGap = Math.max(0, input.serviceSummary.dailyCpLaborGoal - input.serviceSummary.cpLaborActual);
  if (cpLaborGap > 0) {
    const impact = Math.round(cpLaborGap * 450);
    leaks.push({
      department: "Service",
      title: "CP labour below daily goal",
      severity: cpLaborGap > 5 ? "high" : "medium",
      dollarImpact: impact,
      cause: `CP labour is ${cpLaborGap.toFixed(1)} below daily objective.`,
      ownerRole: "Service Manager",
      recommendedAction: "Rebalance advisor load and push high-value maintenance closes in peak blocks.",
      confidence: cpLaborGap > 5 ? "high" : "medium",
    });
  }

  const cpSalesTarget = Math.round(input.serviceSummary.forecastSales * 0.65);
  const cpSalesGap = Math.max(0, cpSalesTarget - input.serviceSummary.customerSales);
  if (cpSalesGap > 0) {
    leaks.push({
      department: "Service",
      title: "Customer pay behind forecast",
      severity: confidenceFrom(cpSalesGap, 35000, 15000),
      dollarImpact: cpSalesGap,
      cause: "Customer-pay revenue contribution is behind required forecast mix.",
      ownerRole: "Service Advisors",
      recommendedAction: "Increase deferred maintenance menu conversion and same-day close discipline.",
      confidence: confidenceFrom(cpSalesGap, 35000, 15000),
    });
  }

  const warrantyGrossShare = input.serviceSummary.warrantyGross / Math.max(1, input.serviceSummary.totalGross);
  if (warrantyGrossShare > 0.28) {
    const impact = Math.round(input.serviceSummary.totalGross * (warrantyGrossShare - 0.24));
    leaks.push({
      department: "Service",
      title: "Warranty carrying too much gross",
      severity: warrantyGrossShare > 0.32 ? "medium" : "low",
      dollarImpact: impact,
      cause: `Warranty share is ${(warrantyGrossShare * 100).toFixed(1)}% of service gross.`,
      ownerRole: "Service Manager",
      recommendedAction: "Rebalance advisor focus toward customer-pay maintenance and upsell execution.",
      confidence: "medium",
    });
  }

  const elrBelow = input.serviceAdvisors.filter((a) => a.elr < 140);
  if (elrBelow.length > 0) {
    const impact = Math.round(sum(elrBelow.map((a) => (140 - a.elr) * 220)));
    leaks.push({
      department: "Service",
      title: "Advisor ELR below target",
      severity: elrBelow.length >= 2 ? "medium" : "low",
      dollarImpact: impact,
      cause: `${elrBelow.length} advisor(s) are below ELR target.`,
      ownerRole: "Service Manager",
      recommendedAction: "Run pricing compliance coaching and monitor estimate quality by advisor.",
      confidence: "medium",
    });
  }

  const hproBelow = input.serviceAdvisors.filter((a) => a.hpro < 2.8);
  if (hproBelow.length > 0) {
    const impact = hproBelow.length * 1800;
    leaks.push({
      department: "Service",
      title: "Advisor HPRO below target",
      severity: hproBelow.length >= 2 ? "medium" : "low",
      dollarImpact: impact,
      cause: `${hproBelow.length} advisor(s) are below expected hours-per-RO.`,
      ownerRole: "Service Advisors",
      recommendedAction: "Coach job packaging and maintenance menu conversion on active ROs.",
      confidence: "medium",
    });
  }

  const csiRiskCount = input.serviceAdvisors.filter((a) => a.csiScore < 95).length;
  if (csiRiskCount > 0) {
    const impact = csiRiskCount * 1400;
    leaks.push({
      department: "Service",
      title: "CSI pressure risk",
      severity: csiRiskCount >= 2 ? "medium" : "low",
      dollarImpact: impact,
      cause: `${csiRiskCount} advisor(s) are under CSI comfort threshold.`,
      ownerRole: "Service Manager",
      recommendedAction: "Intervene on communication cadence and callback follow-through today.",
      confidence: "low",
    });
  }

  // Parts
  const partsCustomerTarget = Math.round(input.partsSummary.forecastSales * 0.47);
  const customerSalesGap = Math.max(0, partsCustomerTarget - input.partsSummary.customerSales);
  if (customerSalesGap > 0) {
    leaks.push({
      department: "Parts",
      title: "Customer sales behind forecast",
      severity: confidenceFrom(customerSalesGap, 22000, 9000),
      dollarImpact: customerSalesGap,
      cause: "Customer-pay parts revenue is trailing required forecast contribution.",
      ownerRole: "Parts Counter Team",
      recommendedAction: "Push customer-pay pull-through on deferred maintenance and declined work.",
      confidence: confidenceFrom(customerSalesGap, 22000, 9000),
    });
  }

  const grossPct = input.partsSummary.totalGross / Math.max(1, input.partsSummary.totalSales);
  if (grossPct < 0.35) {
    const impact = Math.round((0.35 - grossPct) * input.partsSummary.totalSales);
    leaks.push({
      department: "Parts",
      title: "Gross percentage below expectation",
      severity: grossPct < 0.32 ? "high" : "medium",
      dollarImpact: impact,
      cause: `Gross percentage is ${(grossPct * 100).toFixed(1)}%, below expected range.`,
      ownerRole: "Parts Manager",
      recommendedAction: "Audit discounting and margin exceptions on high-turn SKUs.",
      confidence: "high",
    });
  }

  const wholesaleStrong = input.partsSummary.warrantySales > input.partsSummary.customerSales * 0.5;
  const marginWeak = grossPct < 0.35;
  if (wholesaleStrong && marginWeak) {
    const impact = Math.round(input.partsSummary.warrantySales * 0.06);
    leaks.push({
      department: "Parts",
      title: "Wholesale strong but margin weak",
      severity: "medium",
      dollarImpact: impact,
      cause: "Higher wholesale/warranty volume is not converting to expected gross.",
      ownerRole: "Parts Manager",
      recommendedAction: "Renegotiate wholesale pricing bands and protect margin on high-demand parts.",
      confidence: "medium",
    });
  }

  const internalMix = input.partsSummary.internalSales / Math.max(1, input.partsSummary.totalSales);
  if (internalMix > 0.3) {
    const impact = Math.round(input.partsSummary.totalGross * 0.07);
    leaks.push({
      department: "Parts",
      title: "Internal/GOG/category imbalance",
      severity: internalMix > 0.35 ? "high" : "medium",
      dollarImpact: impact,
      cause: `Internal mix is ${(internalMix * 100).toFixed(1)}%, reducing retail margin capture.`,
      ownerRole: "Parts Manager",
      recommendedAction: "Rebalance category focus toward customer-pay and fast-turn retail lines.",
      confidence: "medium",
    });
  }

  const inventoryExposure = dealRisks.filter((d) => d.riskLevel === "high").length >= 3;
  if (inventoryExposure) {
    const impact = Math.round(input.partsSummary.totalGross * 0.05);
    leaks.push({
      department: "Parts",
      title: "Special-order or inventory exposure",
      severity: "medium",
      dollarImpact: impact,
      cause: "High concentration of risky deals increases likelihood of parts delays and special-order misses.",
      ownerRole: "Parts Manager",
      recommendedAction: "Lock top special-order commitments and escalate late suppliers immediately.",
      confidence: "low",
    });
  }

  return leaks.sort((a, b) => b.dollarImpact - a.dollarImpact);
}
