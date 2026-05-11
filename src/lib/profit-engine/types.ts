import {
  PartsSummary,
  SalesDeal,
  SalesSummary,
  ServiceAdvisorPerformance,
  ServiceSummary,
} from "@/src/lib/types/dealership";

export type Department = "Sales" | "Service" | "Parts";
export type Severity = "low" | "medium" | "high";
export type HealthStatus = "ahead" | "on-track" | "at-risk";

export type DepartmentHealth = {
  department: Department;
  status: HealthStatus;
  score: number;
  summary: string;
  actual: number;
  target: number;
  pacePercent: number;
};

export type AtRiskDeal = {
  dealId: string;
  customer: string;
  vehicle: string;
  salesperson: string;
  manager: string;
  businessManager: string;
  frontGross: number;
  backGross: number;
  totalGross: number;
  riskScore: number;
  riskLevel: Severity;
  reasons: string[];
  recommendedAction: string;
  estimatedRecoverableGross: number;
};

export type ProfitLeak = {
  department: Department;
  title: string;
  severity: Severity;
  dollarImpact: number;
  cause: string;
  ownerRole: string;
  recommendedAction: string;
  confidence: Severity;
};

export type AccountabilityItem = {
  person: string;
  department: Department;
  role: string;
  issueCount: number;
  totalDollarImpact: number;
  topIssue: string;
  recommendedCoachingAction: string;
  severity: Severity;
};

export type SinceYesterdayChange = {
  label: string;
  value: number;
  direction: "up" | "down";
  impactArea: "gross" | "volume" | "risk";
};

export type RecommendedAction = {
  id: string;
  department: Department | "Store";
  priority: 1 | 2 | 3 | 4 | 5;
  title: string;
  rationale: string;
  expectedImpactValue: number;
  ownerRole: string;
};

export type ProjectedClose = {
  projectedGross: number;
  targetGross: number;
  gapToTarget: number;
  daysRemaining: number;
  atRiskValue: number;
};

export type GmBriefing = {
  headline: string;
  currentStatus: string;
  risks: string[];
  opportunities: string[];
  priorities: string[];
};

export type ProfitEngineInput = {
  salesDeals: SalesDeal[];
  salesSummary: SalesSummary;
  serviceSummary: ServiceSummary;
  serviceAdvisors: ServiceAdvisorPerformance[];
  partsSummary: PartsSummary;
  dealRisks?: AtRiskDeal[];
  daysUsed: number;
  daysAvailable: number;
  sinceYesterday?: SinceYesterdayChange[];
};

export type ProfitEngineOutput = {
  departmentHealth: DepartmentHealth[];
  atRiskDeals: AtRiskDeal[];
  profitLeaks: ProfitLeak[];
  accountability: {
    groupedByDepartment: Record<Department, AccountabilityItem[]>;
    all: AccountabilityItem[];
  };
  projectedClose: ProjectedClose;
  sinceYesterdayChanges: SinceYesterdayChange[];
  recommendedActions: RecommendedAction[];
  dailyGmBriefing: GmBriefing;
};
