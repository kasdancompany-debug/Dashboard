import "server-only";

import { google } from "googleapis";
import {
  parseTabToCanonicalKey,
  resolveForecastQuarterTab,
  resolveMonthTab,
} from "@/src/lib/google/month-tab-resolver";
import { sources } from "@/src/lib/velocity/source-config";

export type SheetKind = "sales" | "service" | "parts" | "forecast";

/** Parsed tab title from an A1 range like `'MAY 26'!A1:Z2000` or `Sheet1!A1:Z`. */
export function parseTabFromA1Range(range: string): string | null {
  const bang = range.indexOf("!");
  if (bang <= 0) return null;
  let tab = range.slice(0, bang).trim();
  if (tab.startsWith("'")) {
    tab = tab.slice(1, -1).replace(/''/g, "'");
  }
  return tab || null;
}

function getEnv(name: string) {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function getPrivateKey() {
  return getEnv("GOOGLE_PRIVATE_KEY").replace(/\\n/g, "\n");
}

async function fetchSpreadsheetTitle(
  sheets: ReturnType<typeof google.sheets>,
  spreadsheetId: string,
): Promise<string | null> {
  try {
    const response = await sheets.spreadsheets.get({
      spreadsheetId,
      fields: "properties.title",
    });
    return response.data.properties?.title?.trim() || null;
  } catch {
    return null;
  }
}

async function fetchAvailableTabNames(
  sheets: ReturnType<typeof google.sheets>,
  spreadsheetId: string,
): Promise<string[]> {
  try {
    const response = await sheets.spreadsheets.get({
      spreadsheetId,
      fields: "sheets(properties(title))",
    });
    return (response.data.sheets ?? [])
      .map((sheet) => sheet.properties?.title?.trim())
      .filter((title): title is string => Boolean(title));
  } catch {
    return [];
  }
}

function createSheetsClient() {
  const auth = new google.auth.JWT({
    email: getEnv("GOOGLE_SERVICE_ACCOUNT_EMAIL"),
    key: getPrivateKey(),
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });

  return google.sheets({ version: "v4", auth });
}

function mapGoogleError(error: unknown, sheetId: string) {
  const anyErr = error as { code?: number; message?: string };
  if (anyErr?.code === 403) {
    return new Error(
      `Google Sheets permission denied for sheet ${sheetId}. Share the sheet with the service account email and ensure viewer access.`,
    );
  }
  if (anyErr?.code === 404) {
    return new Error(`Google Sheet not found: ${sheetId}. Verify the sheet ID.`);
  }
  return new Error(anyErr?.message ?? "Unknown Google Sheets error.");
}

export function isLiveDataEnabled() {
  return (process.env.LIVE_DATA_ENABLED ?? "false").toLowerCase() === "true";
}

function quoteTabName(tabName: string) {
  return `'${tabName.replace(/'/g, "''")}'`;
}

function monthLabelFromKey(reportingMonth: string) {
  const [year, month] = reportingMonth.split("-").map(Number);
  const full = [
    "january",
    "february",
    "march",
    "april",
    "may",
    "june",
    "july",
    "august",
    "september",
    "october",
    "november",
    "december",
  ][month - 1];
  return `${full[0].toUpperCase()}${full.slice(1)} ${year}`;
}

export type FetchedSheetRows = {
  source: "google-sheets";
  kind: SheetKind;
  /** Google spreadsheet document id */
  sheetId: string;
/** Runtime no longer depends on GID */
  selectedGid: string | null;
  /** Human workbook title when the API returns it */
  workbookTitle: string | null;
  /** Available tabs in workbook */
  availableTabNames: string[];
/** Candidate tab labels attempted for selected month */
  attemptedTabNames: string[];
  /** Resolved A1 range including tab */
  range: string;
  /** Tab title parsed from `range`, when present */
  tabName: string | null;
  resolutionNote: string;
  rows: string[][];
  lastSynced: string;
};

export async function fetchSheetRows(
  kind: SheetKind,
  range = "A1:Z1000",
  options?: { reportingMonth?: string | null },
): Promise<FetchedSheetRows> {
  const sheetId = getEnv(sources[kind].sheetIdEnv);
  const sheets = createSheetsClient();

  try {
    void range;
    const now = new Date();
    const reportingMonth = options?.reportingMonth ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    let resolutionNote = `Resolved via month tab for ${reportingMonth}.`;
    const attemptedTabNames =
      kind === "forecast"
        ? resolveForecastQuarterTab(reportingMonth, []).attemptedTabNames
        : resolveMonthTab(reportingMonth, []).attemptedTabNames;
    const [workbookTitle, availableTabNames] = await Promise.all([
      fetchSpreadsheetTitle(sheets, sheetId),
      fetchAvailableTabNames(sheets, sheetId),
    ]);
    const hasMetadataAccess = Boolean(workbookTitle) || availableTabNames.length > 0;
    if (!hasMetadataAccess) {
      return {
        source: "google-sheets",
        kind,
        sheetId,
        selectedGid: null,
        workbookTitle: null,
        availableTabNames: [],
        attemptedTabNames,
        range: "(metadata unavailable)",
        tabName: null,
        resolutionNote:
          "Unable to read spreadsheet metadata (title/tabs). Verify sheet ID and share with the service account email.",
        rows: [],
        lastSynced: new Date().toISOString(),
      };
    }
    const resolution =
      kind === "forecast"
        ? resolveForecastQuarterTab(reportingMonth, availableTabNames)
        : resolveMonthTab(reportingMonth, availableTabNames);
    if (!resolution.matched || !resolution.matchedTab) {
      return {
        source: "google-sheets",
        kind,
        sheetId,
        selectedGid: null,
        workbookTitle,
        availableTabNames,
        attemptedTabNames: resolution.attemptedTabNames,
        range: "(month tab not resolved)",
        tabName: null,
        resolutionNote: `Could not find ${monthLabelFromKey(reportingMonth)} tab.`,
        rows: [],
        lastSynced: new Date().toISOString(),
      };
    }
    const resolvedParsed = kind === "forecast" ? { key: reportingMonth } : parseTabToCanonicalKey(resolution.matchedTab);
    if (!resolvedParsed || resolvedParsed.key !== reportingMonth) {
      const rejection = `Wrong-month tab rejected: resolved ${resolution.matchedTab} as ${resolvedParsed?.key ?? "unknown"}, selected ${reportingMonth}`;
      return {
        source: "google-sheets",
        kind,
        sheetId,
        selectedGid: null,
        workbookTitle,
        availableTabNames,
        attemptedTabNames: resolution.attemptedTabNames,
        range: "(wrong-month tab rejected)",
        tabName: resolution.matchedTab,
        resolutionNote: rejection,
        rows: [],
        lastSynced: new Date().toISOString(),
      };
    }
    const resolvedRange = `${quoteTabName(resolution.matchedTab)}!A1:Z2000`;
    const valuesResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: resolvedRange,
    });

    return {
      source: "google-sheets",
      kind,
      sheetId,
      selectedGid: null,
      workbookTitle,
      availableTabNames,
      attemptedTabNames: resolution.attemptedTabNames,
      range: resolvedRange,
      tabName: parseTabFromA1Range(resolvedRange),
      resolutionNote,
      rows: valuesResponse.data.values ?? [],
      lastSynced: new Date().toISOString(),
    };
  } catch (error) {
    throw mapGoogleError(error, sheetId);
  }
}
