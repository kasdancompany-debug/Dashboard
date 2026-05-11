import type { SourceHealth } from "@/src/lib/velocity/engine/types";

export type MonthlyGrossDepartment = "Sales" | "Service" | "Parts";

export type TrackingStatus = "ahead" | "on-track" | "behind" | "insufficient-data";

export type GrossLineTracking = {
  id: string;
  department: MonthlyGrossDepartment;
  label: string;
  actualGross: number;
  trackingGross: number | null;
  targetGross: number;
  gapToTarget: number | null;
  pacePercent: number | null;
  status: TrackingStatus;
  warning: string | null;
  source: string;
  explanation: string;
};

export type BestWorstTrackingLine = {
  department: MonthlyGrossDepartment;
  label: string;
  trackingGross: number | null;
  targetGross: number;
  gapToTarget: number | null;
  pacePercent: number | null;
  warning: string | null;
  explanation: string;
};

export type DepartmentGrossTracking = {
  department: MonthlyGrossDepartment;
  actualGross: number;
  trackingGross: number | null;
  targetGross: number;
  gapToTarget: number | null;
  pacePercent: number | null;
  status: TrackingStatus;
  warning: string | null;
  bestLine: BestWorstTrackingLine | null;
  worstLine: BestWorstTrackingLine | null;
  lines: GrossLineTracking[];
};

export type MonthlyGrossTracking = {
  month: number;
  year: number;
  daysUsed: number;
  daysAvailable: number;
  totalActualGross: number;
  totalTrackingGross: number | null;
  totalTargetGross: number;
  totalGapToTarget: number | null;
  totalPacePercent: number | null;
  departments: DepartmentGrossTracking[];
  bestTrackingLine: BestWorstTrackingLine | null;
  worstTrackingLine: BestWorstTrackingLine | null;
  lastSynced: string;
  sourceHealth: SourceHealth;
};

