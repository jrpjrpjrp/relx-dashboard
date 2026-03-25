// Data loader — reads relx-financials.json (dict keyed by year string) and
// computes derived metrics. Returns AnnualRow[] sorted ascending by year.

import type { AnnualRow } from "./types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let rawDict: Record<string, any> = {};

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  rawDict = require("../data/relx-financials.json");
} catch {
  // data file not yet generated — return empty
}

function deriveMetrics(rows: AnnualRow[]): AnnualRow[] {
  return rows.map((row, i) => {
    const prev = rows[i - 1];
    const derived: Partial<AnnualRow> = {};

    if (prev) {
      derived.revenueGrowthYoY = (row.revenue - prev.revenue) / prev.revenue * 100;
    }
    if (row.adjOperatingProfit != null) {
      derived.adjOperatingMargin = row.adjOperatingProfit / row.revenue * 100;
    }
    if (row.reportedOpProfit != null) {
      derived.reportedOperatingMargin = row.reportedOpProfit / row.revenue * 100;
    }
    if (row.netIncome != null) {
      derived.netMargin = row.netIncome / row.revenue * 100;
    }
    if (row.fcfBeforeDividends != null) {
      derived.fcfMargin = row.fcfBeforeDividends / row.revenue * 100;
      if (row.netIncome != null && row.netIncome > 0) {
        derived.fcfConversion = row.fcfBeforeDividends / row.netIncome * 100;
      }
    }
    if (row.netDebt != null && row.ebitda != null && row.ebitda > 0) {
      derived.netDebtToEbitda = row.netDebt / row.ebitda;
    }

    return { ...row, ...derived };
  });
}

let _cached: AnnualRow[] | null = null;

export function getAnnualRows(): AnnualRow[] {
  if (_cached) return _cached;
  if (!Object.keys(rawDict).length) return [];

  const rows: AnnualRow[] = Object.values(rawDict)
    .sort((a, b) => a.year - b.year) as AnnualRow[];

  _cached = deriveMetrics(rows);
  return _cached;
}

/** Latest year with full data */
export function getLatestRow(): AnnualRow | undefined {
  const rows = getAnnualRows();
  return rows[rows.length - 1];
}
