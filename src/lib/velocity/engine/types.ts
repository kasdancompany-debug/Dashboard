import type { SourceFreshnessStatus } from "@/src/lib/data-pipeline/source-trace";
import type { PartsSummary, SalesDeal, SalesSummary, ServiceAdvisorPerformance, ServiceSummary } from "@/src/lib/types/dealership";

export type Department = "Sales" | "Service" | "Parts" | "Store";
export type Severity = "low" | "medium" | "high";
export type Confidence = "low" | "medium" | "high";
export type HealthStatus = "ahead" | "on-track" | "at-risk";

export type SourceHealth = {
  connectionLabel: "Live data connected" | "Live data partially connected";
  reportingMonth: string;
  reportingMonthLabel: string;
  overallFreshness: SourceFreshnessStatus;
  staleDataWarnings: string[];
  fallbackNotices: string[];
  departments: Array<{
    department: "sales" | "service" | "parts";
    workbookTitle: string | null;
    workbookId: string;
    sheetTab: string | null;
    range: string;
    freshnessStatus: SourceFreshnessStatus;
    monthAligned: boolean;
    extractedSheetMonthKey: string | null;
  }>;
  sources: Array<{
    source: "sales" | "service" | "parts";
    enabled: boolean;
    connected: boolean;
    rowCount: number;
    lastFetched: string | null;
    parserConfidence: number;
    errors: string[];
    warningCount: number;
  }>;
};

export type StorePulse = {
  summary: string;
  status: HealthStatus;
  severity: Severity;
  confidence: Confidence;
  reason: string;
};

export type ProjectionSummary = {
  projectedGross: number;
  targetGross: number;
  gapToTarget: number;
  daysRemaining: number;
  atRiskValue: number;
  severity: Severity;
  confidence: Confidence;
  owner: string;
  recommendedAction: string;
  reason: string;
};

export type PrimaryThreat = {
  title: string;
  department: Department;
  severity: Severity;
  dollarImpact: number | null;
  owner: string;
  recommendedAction: string;
  reason: string;
  confidence: Confidence;
} | null;

export type ActionQueueItem = {
  id: string;
  rank: number;
  department: Department;
  title: string;
  severity: Severity;
  dollarImpact: number | null;
  owner: string;
  people: string[];
  whyItMatters: string;
  recommendedAction: string;
  ctaLabel: string;
  ctaHref: string;
};

export type AtRiskDeal = {
  id: string;
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

export type ProfitLeakDecision = {
  department: Department;
  severity: Severity;
  dollarImpact: number | null;
  owner: string;
  recommendedAction: string;
  reason: string;
  confidence: Confidence;
  title: string;
};

export type AccountabilityItem = {
  person: string;
  role: string;
  department: Department;
  issueCount: number;
  dollarImpact: number | null;
  topIssue: string;
  recommendedCoachingAction: string;
  severity: Severity;
};

export type DepartmentPulse = {
  department: Department;
  severity: Severity;
  dollarImpact: number | null;
  owner: string;
  recommendedAction: string;
  reason: string;
  confidence: Confidence;
  status: HealthStatus;
  score: number;
  summary: string;
  actual: number;
  target: number;
  pacePercent: number;
};

export type TrendSignal = {
  id: string;
  department: Department;
  severity: Severity;
  dollarImpact: number | null;
  owner: string;
  title: string;
  reason: string;
  recommendedAction: string;
  confidence: Confidence;
  direction: "up" | "down" | "flat";
};

export type MeetingBriefing = {
  headline: string;
  currentStatus: string;
  priorities: ActionQueueItem[];
  risks: ProfitLeakDecision[];
  opportunities: DepartmentPulse[];
};

export type DataConfidence = {
  department: Department;
  severity: Severity;
  dollarImpact: number | null;
  owner: string;
  recommendedAction: string;
  reason: string;
  confidence: Confidence;
  score: number;
  classification: "healthy" | "warning" | "unreliable";
  label: "High confidence" | "Medium confidence" | "Low confidence";
  estimated: boolean;
  estimationReason: string | null;
};

export type VelocityData = {
  lastSynced: string;
  sourceHealth: SourceHealth;
  dataConfidence: DataConfidence;
  storePulse: StorePulse;
  currentProjection: number;
  targetProjection: number;
  gapToTarget: number;
  recoverableToday: number;
  primaryThreat: PrimaryThreat;
  actionQueue: ActionQueueItem[];
  atRiskDeals: AtRiskDeal[];
  accountability: AccountabilityItem[];
  departmentPulse: DepartmentPulse[];
  trendSignals: TrendSignal[];
  meetingBriefing: MeetingBriefing;
};

export type VelocityEngineInput = {
  salesDeals: SalesDeal[];
  salesSummary: SalesSummary;
  serviceSummary: ServiceSummary;
  serviceAdvisors: ServiceAdvisorPerformance[];
  partsSummary: PartsSummary;
  daysUsed: number;
  daysAvailable: number;
};

export type VelocityEngineOutput = {
  primaryThreat: PrimaryThreat;
  actionQueue: ActionQueueItem[];
  atRiskDeals: AtRiskDeal[];
  profitLeaks: ProfitLeakDecision[];
  recoverableGrossEstimate: number;
  accountabilityItems: AccountabilityItem[];
  projectedClose: ProjectionSummary;
  departmentHealth: DepartmentPulse[];
  meetingBriefing: MeetingBriefing;
};
