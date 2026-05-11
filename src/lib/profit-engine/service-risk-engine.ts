import { ServiceAdvisorPerformance, ServiceSummary } from "@/src/lib/types/dealership";
import { DepartmentHealth, HealthStatus, ProfitLeak } from "@/src/lib/profit-engine/types";

const toHealthStatus = (pace: number): HealthStatus => {
  if (pace >= 100) return "ahead";
  if (pace >= 94) return "on-track";
  return "at-risk";
};

export function buildServiceHealth(serviceSummary: ServiceSummary): DepartmentHealth {
  const pacePercent = Math.round((serviceSummary.totalGross / Math.max(1, serviceSummary.forecastGross)) * 100);
  return {
    department: "Service",
    status: toHealthStatus(pacePercent),
    score: Math.max(45, Math.min(99, pacePercent + 2)),
    summary: `ELR objective ${serviceSummary.dailyCpLaborGoal.toFixed(1)} with current CP labour ${serviceSummary.cpLaborActual.toFixed(1)}.`,
    actual: serviceSummary.totalGross,
    target: serviceSummary.forecastGross,
    pacePercent,
  };
}

export function buildServiceLeakSignals(input: {
  serviceSummary: ServiceSummary;
  serviceAdvisors: ServiceAdvisorPerformance[];
}): ProfitLeak[] {
  const { serviceSummary, serviceAdvisors } = input;
  const leaks: ProfitLeak[] = [];

  const grossGap = Math.max(0, serviceSummary.forecastGross - serviceSummary.totalGross);
  if (grossGap > 0) {
    leaks.push({
      department: "Service",
      title: "Service gross under forecast",
      severity: grossGap >= 15000 ? "high" : "medium",
      dollarImpact: grossGap,
      cause: "CP labour pace and advisor load balance are under objective.",
      ownerRole: "Service Manager",
      recommendedAction: "Rebalance advisor load and push high-value maintenance closes today.",
      confidence: grossGap >= 15000 ? "high" : "medium",
    });
  }

  const belowElr = serviceAdvisors.filter((a) => a.elr < 140).length;
  if (belowElr > 0) {
    const impact = belowElr * 2500;
    leaks.push({
      department: "Service",
      title: "Advisor ELR under target",
      severity: belowElr >= 2 ? "medium" : "low",
      dollarImpact: impact,
      cause: `${belowElr} advisor(s) are below ELR threshold.`,
      ownerRole: "Service Manager",
      recommendedAction: "Run pricing/menu compliance coaching before peak traffic.",
      confidence: "medium",
    });
  }

  return leaks;
}
