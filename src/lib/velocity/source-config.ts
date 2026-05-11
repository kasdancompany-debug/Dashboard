type SourceKey = "sales" | "service" | "parts" | "forecast";

export const sources: Record<
  SourceKey,
  {
    label: string;
    sheetIdEnv: string;
    required: boolean;
  }
> = {
  sales: {
    label: "Sales",
    sheetIdEnv: "SALES_SHEET_ID",
    required: true,
  },
  service: {
    label: "Service",
    sheetIdEnv: "SERVICE_SHEET_ID",
    required: true,
  },
  parts: {
    label: "Parts",
    sheetIdEnv: "PARTS_SHEET_ID",
    required: true,
  },
  forecast: {
    label: "Forecast",
    sheetIdEnv: "FORECAST_SHEET_ID",
    required: false,
  },
};

