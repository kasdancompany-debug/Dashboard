import type { SalesDeal } from "@/src/lib/types/dealership";

export type ExecutiveDealSignals = {
  unclassifiedDeals: number;
  zeroGrossDeals: number;
  /** Positive total but zero front — often incomplete desk capture */
  missingFrontGrossDeals: number;
  /** Positive total but zero back — F&I capture risk */
  missingBackGrossDeals: number;
};

export function analyzeExecutiveDealSignals(deals: SalesDeal[]): ExecutiveDealSignals {
  let unclassifiedDeals = 0;
  let zeroGrossDeals = 0;
  let missingFrontGrossDeals = 0;
  let missingBackGrossDeals = 0;

  for (const d of deals) {
    if (d.dealType === "unknown") unclassifiedDeals += 1;
    if (d.totalGross <= 0) zeroGrossDeals += 1;
    if (d.totalGross > 0 && d.frontGross === 0) missingFrontGrossDeals += 1;
    if (d.totalGross > 0 && d.backGross === 0) missingBackGrossDeals += 1;
  }

  return {
    unclassifiedDeals,
    zeroGrossDeals,
    missingFrontGrossDeals,
    missingBackGrossDeals,
  };
}
