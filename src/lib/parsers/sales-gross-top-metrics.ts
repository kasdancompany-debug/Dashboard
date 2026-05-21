import {
  SheetMatrix,
  compactRow,
  isEmptyRow,
  normalizeCell,
  parseCurrency,
  parseNumber,
} from "@/src/lib/parsers/parse-utils";

function parseNumericCell(cell: unknown) {
  const cleaned = String(cell ?? "").replace(/[,$\s]/g, "");
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function findNumericByLabel(
  rows: string[][],
  label: string,
  options?: { min?: number; max?: number; maxRowIndex?: number },
) {
  const needle = label.toLowerCase();
  const min = options?.min ?? Number.NEGATIVE_INFINITY;
  const max = options?.max ?? Number.POSITIVE_INFINITY;
  const maxRowIndex = options?.maxRowIndex ?? rows.length - 1;
  const inRange = (value: number) => value >= min && value <= max;

  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    if (rowIndex > maxRowIndex) break;
    const row = rows[rowIndex];
    const rowLower = row.map((cell) => String(cell ?? "").toLowerCase());
    const labelIndex = rowLower.findIndex((cell) => cell.includes(needle));
    if (labelIndex === -1) continue;

    for (let offset = 1; offset <= 4; offset += 1) {
      const idx = labelIndex + offset;
      if (idx >= row.length) break;
      const parsed = parseNumericCell(row[idx]);
      if (parsed !== null && inRange(parsed)) return parsed;
    }
    for (let offset = 1; offset <= 2; offset += 1) {
      const idx = labelIndex - offset;
      if (idx < 0) break;
      const parsed = parseNumericCell(row[idx]);
      if (parsed !== null && inRange(parsed)) return parsed;
    }
    for (const cell of row) {
      const parsed = parseNumericCell(cell);
      if (parsed !== null && inRange(parsed)) return parsed;
    }
  }
  return null;
}

const NEW_VEHICLE_ACTUAL_NEEDLES = [
  "total new vehicle gross",
  "new vehicle gross profit",
  "new vehicle gross",
];
const USED_VEHICLE_ACTUAL_NEEDLES = [
  "total used vehicle gross",
  "used vehicle gross profit",
  "used vehicle gross",
];
const NEW_VEHICLE_TRACKING_NEEDLES = ["new vehicle tracking", "new vehicle gross tracking"];
const USED_VEHICLE_TRACKING_NEEDLES = ["used vehicle tracking", "used vehicle gross tracking"];

function firstNeedleValue(rows: SheetMatrix, needles: string[], options?: { min?: number; maxRowIndex?: number }) {
  for (const needle of needles) {
    const hit = findNumericByLabel(rows, needle, options);
    if (hit !== null) return hit;
  }
  return null;
}

function scanLabeledNeedleRows(rows: SheetMatrix, maxRowIndex: number): SalesGrossTopMetricsMap {
  const metrics = emptySalesGrossTopMetrics();
  const opts = { min: 500, maxRowIndex };

  const newActual = firstNeedleValue(rows, NEW_VEHICLE_ACTUAL_NEEDLES, opts);
  const usedActual = firstNeedleValue(rows, USED_VEHICLE_ACTUAL_NEEDLES, opts);
  const newTracking = firstNeedleValue(rows, NEW_VEHICLE_TRACKING_NEEDLES, opts);
  const usedTracking = firstNeedleValue(rows, USED_VEHICLE_TRACKING_NEEDLES, opts);

  if (newActual !== null) metrics.newVehicle.actual = newActual;
  if (usedActual !== null) metrics.usedVehicle.actual = usedActual;
  if (newTracking !== null) metrics.newVehicle.tracking = newTracking;
  if (usedTracking !== null) metrics.usedVehicle.tracking = usedTracking;

  return metrics;
}

export type SalesGrossSubLineMetrics = {
  actual: number | null;
  forecast: number | null;
  tracking: number | null;
};

export type SalesGrossTopMetricsMap = {
  newVehicle: SalesGrossSubLineMetrics;
  usedVehicle: SalesGrossSubLineMetrics;
  front: SalesGrossSubLineMetrics;
  back: SalesGrossSubLineMetrics;
  total: SalesGrossSubLineMetrics;
};

function blankLine(): SalesGrossSubLineMetrics {
  return { actual: null, forecast: null, tracking: null };
}

export function emptySalesGrossTopMetrics(): SalesGrossTopMetricsMap {
  return {
    newVehicle: blankLine(),
    usedVehicle: blankLine(),
    front: blankLine(),
    back: blankLine(),
    total: blankLine(),
  };
}

function readAtNullable(row: string[], index: number): number | null {
  if (index < 0) return null;
  const candidates = [index, index + 1, index - 1, index + 2].filter((i) => i >= 0);
  for (const i of candidates) {
    const parsed = parseCurrency(row[i]) ?? parseNumber(row[i]);
    if (parsed !== null) return parsed;
    const mergedForward = `${row[i] ?? ""}${row[i + 1] ?? ""}`;
    const mergedBackward = `${row[i - 1] ?? ""}${row[i] ?? ""}`;
    const merged = parseCurrency(mergedForward) ?? parseCurrency(mergedBackward);
    if (merged !== null) return merged;
  }
  return null;
}

function firstLabelCell(row: string[]) {
  for (let i = 0; i < Math.min(6, row.length); i += 1) {
    const cell = normalizeCell(row[i]);
    if (!cell || cell === "$") continue;
    if (parseNumber(cell) !== null) continue;
    return cell;
  }
  return "";
}

function findAnchor(row: string[], tokens: string[]) {
  return row.findIndex((cell) => tokens.some((token) => normalizeCell(cell).includes(token)));
}

function classifySalesGrossLabel(label: string): keyof SalesGrossTopMetricsMap | null {
  const norm = label.toLowerCase();
  if (!norm || norm === "gross") return null;
  if (/per\s*copy|gross\s*per/.test(norm)) return null;
  if (/total/.test(norm) && (/new/.test(norm) || /used/.test(norm) || /&/.test(norm))) return "total";
  if (/^total\b/.test(norm) || norm === "total gross" || norm === "total") return "total";
  if (/used/.test(norm) && !/new\s*&\s*used|new\s+and\s+used/.test(norm) && /vehicle|gross|profit|total/.test(norm)) {
    return "usedVehicle";
  }
  if (/new/.test(norm) && !/used/.test(norm) && /vehicle|gross|profit|total/.test(norm)) return "newVehicle";
  if (/front/.test(norm) && /gross/.test(norm)) return "front";
  if (/back/.test(norm) && /gross/.test(norm)) return "back";
  return null;
}

function applyMetrics(
  map: SalesGrossTopMetricsMap,
  key: keyof SalesGrossTopMetricsMap,
  actual: number | null,
  forecast: number | null,
  tracking: number | null,
) {
  const line = map[key];
  if (actual !== null) line.actual = actual;
  if (forecast !== null) line.forecast = forecast;
  if (tracking !== null) line.tracking = tracking;
}

/** Daily Log layout: label in column D/E, dollars in the next populated cells (no F/C/T header row). */
function scanDailyLogLabelRows(rows: SheetMatrix, maxRowIndex: number): SalesGrossTopMetricsMap {
  const metrics = emptySalesGrossTopMetrics();

  for (let rowIndex = 0; rowIndex < rows.length && rowIndex <= maxRowIndex; rowIndex += 1) {
    const row = compactRow(rows[rowIndex]);
    for (let labelCol = 0; labelCol < Math.min(8, row.length); labelCol += 1) {
      const key = classifySalesGrossLabel(firstLabelCellFrom(row, labelCol));
      if (!key) continue;

      const numbers: number[] = [];
      for (let col = labelCol + 1; col < row.length; col += 1) {
        const parsed = parseCurrency(row[col]) ?? parseNumber(row[col]);
        if (parsed !== null && Math.abs(parsed) >= 1) numbers.push(parsed);
      }
      if (!numbers.length) continue;

      const line = metrics[key];
      if (numbers.length === 1) {
        if (line.actual === null) line.actual = numbers[0];
        continue;
      }
      if (numbers.length === 2) {
        if (line.forecast === null) line.forecast = numbers[0];
        if (line.actual === null) line.actual = numbers[1];
        continue;
      }
      if (line.forecast === null) line.forecast = numbers[0];
      if (line.actual === null) line.actual = numbers[1];
      if (line.tracking === null) line.tracking = numbers[numbers.length - 1];
    }
  }

  for (let rowIndex = 0; rowIndex < rows.length && rowIndex <= Math.min(maxRowIndex, 120); rowIndex += 1) {
    const row = compactRow(rows[rowIndex]);
    const joined = row.map(normalizeCell).join(" ").toLowerCase();
    if (!/used\s+vehicle|used\s+gross/.test(joined) || /\bnew\b/.test(joined)) continue;

    const numbers: number[] = [];
    for (const cell of row) {
      const parsed = parseCurrency(cell) ?? parseNumber(cell);
      if (parsed !== null && Math.abs(parsed) >= 5000) numbers.push(parsed);
    }
    if (!numbers.length) continue;
    const line = metrics.usedVehicle;
    if (line.actual === null) line.actual = numbers[0];
    if (numbers.length >= 2 && line.tracking === null) line.tracking = numbers[numbers.length - 1];
  }

  return metrics;
}

function firstLabelCellFrom(row: string[], startCol: number) {
  for (let i = startCol; i < Math.min(startCol + 3, row.length); i += 1) {
    const cell = normalizeCell(row[i]);
    if (!cell || cell === "$") continue;
    if (parseNumber(cell) !== null) continue;
    return cell;
  }
  return "";
}

function mergeSalesGrossMetrics(primary: SalesGrossTopMetricsMap, secondary: SalesGrossTopMetricsMap): SalesGrossTopMetricsMap {
  const keys: (keyof SalesGrossTopMetricsMap)[] = ["newVehicle", "usedVehicle", "front", "back", "total"];
  for (const key of keys) {
    for (const field of ["actual", "forecast", "tracking"] as const) {
      if (primary[key][field] === null && secondary[key][field] !== null) {
        primary[key][field] = secondary[key][field];
      }
    }
  }
  return primary;
}

function parseSalesGrossWideGrid(rows: SheetMatrix, maxRowIndex: number): SalesGrossTopMetricsMap {
  const metrics = emptySalesGrossTopMetrics();
  let section: "gross" | null = null;
  let forecastCol = 5;
  let actualCol = 7;
  let trackingCol = 12;

  for (let rowIndex = 0; rowIndex < rows.length && rowIndex <= maxRowIndex; rowIndex += 1) {
    const rawRow = rows[rowIndex];
    if (isEmptyRow(rawRow)) continue;
    const row = compactRow(rawRow);
    const rowText = row.map(normalizeCell).join(" ");
    const label = firstLabelCell(row);
    const forecastAnchor = findAnchor(row, ["forecast"]);
    const actualAnchor = findAnchor(row, ["actual"]);
    const trackingAnchor = findAnchor(row, ["tracking"]);
    if (forecastAnchor >= 0) forecastCol = forecastAnchor;
    if (actualAnchor >= 0) actualCol = actualAnchor;
    if (trackingAnchor >= 0) trackingCol = trackingAnchor;

    if (/\bgross\b/.test(rowText) && /\bforecast\b/.test(rowText)) {
      section = "gross";
      continue;
    }
    if (section !== "gross") continue;

    const key = classifySalesGrossLabel(label);
    if (!key) continue;

    applyMetrics(
      metrics,
      key,
      readAtNullable(row, actualCol),
      readAtNullable(row, forecastCol),
      readAtNullable(row, trackingCol),
    );
  }

  return metrics;
}

/** Parse sales gross lines from Daily Log label rows and optional F/C/T grid headers. */
export function parseSalesGrossTopMetrics(rows: SheetMatrix, options?: { maxRowIndex?: number }): SalesGrossTopMetricsMap {
  const maxRowIndex = options?.maxRowIndex ?? 250;
  const needleMetrics = scanLabeledNeedleRows(rows, maxRowIndex);
  const labelMetrics = scanDailyLogLabelRows(rows, maxRowIndex);
  const wideMetrics = parseSalesGrossWideGrid(rows, maxRowIndex);
  return mergeSalesGrossMetrics(mergeSalesGrossMetrics(wideMetrics, labelMetrics), needleMetrics);
}
