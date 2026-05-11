export type DealType = "new" | "used" | "unknown";
export type DealStatus = "delivered" | "incoming" | "preorder" | "pending" | "issue";
export type PaceStatus = "ahead" | "on-track" | "at-risk";

export type SalesDeal = {
  id: string;
  date: string;
  customer: string;
  salesperson: string;
  manager: string;
  vehicle: string;
  stockNumber: string;
  dealType: DealType;
  tradeVehicle: string | null;
  acv: number;
  tradeRetail: number;
  businessManager: string;
  estimatedTerm: number;
  frontGross: number;
  backGross: number;
  totalGross: number;
  status: DealStatus;
  notes: string;
};

export type SalesSummary = {
  totalUnits: number;
  newUnits: number;
  usedUnits: number;
  frontGross: number;
  backGross: number;
  totalGross: number;
  frontAverage: number;
  backAverage: number;
  perCopy: number;
  trackingVolume: number;
  trackingGross: number;
  targetUnits: number;
  targetGross: number;
  paceStatus: PaceStatus;
};

export type ServiceSummary = {
  customerSales: number;
  warrantySales: number;
  internalSales: number;
  totalSales: number;
  customerGross: number;
  warrantyGross: number;
  internalGross: number;
  totalGross: number;
  cpLaborActual: number;
  cpLaborTracking: number;
  dailyCpLaborGoal: number;
  forecastSales: number;
  forecastGross: number;
  previousYearSales: number;
  previousYearGross: number;
  paceStatus: PaceStatus;
};

export type ServiceAdvisorPerformance = {
  name: string;
  csiResponses: number;
  csiPerfect: number;
  csiScore: number;
  elr: number;
  hpro: number;
  soldWildcards: number;
  cpRo: number;
  cpLabor: number;
  totalSales: number;
  trackingCpLabor: number;
};

export type PartsSummary = {
  customerSales: number;
  warrantySales: number;
  internalSales: number;
  totalSales: number;
  customerGross: number;
  warrantyGross: number;
  internalGross: number;
  totalGross: number;
  /** Total gross · Tracking from the parts workbook gross summary (when parsed). */
  trackingGross: number;
  forecastSales: number;
  forecastGross: number;
  paceStatus: PaceStatus;
};

export type ExecutiveAlert = {
  id: string;
  severity: "critical" | "warning" | "info" | "win";
  department: "sales" | "service" | "parts" | "store";
  title: string;
  description: string;
  recommendedAction: string;
  createdAt: string;
};

export type DailyBriefing = {
  date: string;
  storeHealthScore: number;
  headline: string;
  wins: string[];
  risks: string[];
  recommendedActions: string[];
  departmentSummaries: {
    sales: string;
    service: string;
    parts: string;
  };
};
