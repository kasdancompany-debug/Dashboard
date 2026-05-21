/** Per sub-line values from department daily tracking sheets (Forecast / Actual / Tracking columns). */
export type DeptGrossSubLineMetrics = {
  forecast: number | null;
  tracking: number | null;
};

export type DeptGrossSubLineMetricsMap = {
  customer: DeptGrossSubLineMetrics;
  warranty: DeptGrossSubLineMetrics;
  internal: DeptGrossSubLineMetrics;
  /** Parts workbook only — wholesale gross row. */
  wholesale: DeptGrossSubLineMetrics;
  /** Parts workbook only — GOG gross row. */
  gog: DeptGrossSubLineMetrics;
  total: DeptGrossSubLineMetrics;
};

export function emptyDeptGrossSubLineMetrics(): DeptGrossSubLineMetricsMap {
  const blank = (): DeptGrossSubLineMetrics => ({ forecast: null, tracking: null });
  return {
    customer: blank(),
    warranty: blank(),
    internal: blank(),
    wholesale: blank(),
    gog: blank(),
    total: blank(),
  };
}
