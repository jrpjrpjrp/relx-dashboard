// Segment data loader — reads relx-segments.json scraped from 20-F HTML.
// Returns SegmentRow[] with revenueGrowthYoY computed per segment.

import type { SegmentRow, SegmentName } from "./types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let rawData: any[] = [];

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  rawData = require("../data/relx-segments.json");
} catch {
  // not yet generated
}

let _cached: SegmentRow[] | null = null;

function computeGrowth(rows: SegmentRow[]): SegmentRow[] {
  // Group by segment, compute YoY growth
  const bySegment: Record<string, SegmentRow[]> = {};
  for (const row of rows) {
    (bySegment[row.segment] ??= []).push(row);
  }
  const result: SegmentRow[] = [];
  for (const segs of Object.values(bySegment)) {
    segs.sort((a, b) => a.year - b.year);
    for (let i = 0; i < segs.length; i++) {
      const prev = segs[i - 1];
      result.push({
        ...segs[i],
        revenueGrowthYoY: prev
          ? (segs[i].revenue - prev.revenue) / prev.revenue * 100
          : undefined,
      });
    }
  }
  return result.sort((a, b) => a.year - b.year || a.segment.localeCompare(b.segment));
}

export function getSegmentRows(): SegmentRow[] {
  if (_cached) return _cached;
  if (!rawData.length) return [];
  _cached = computeGrowth(rawData as SegmentRow[]);
  return _cached;
}

export function getSegmentRowsBySegment(segment: SegmentName): SegmentRow[] {
  return getSegmentRows()
    .filter((r) => r.segment === segment)
    .sort((a, b) => a.year - b.year);
}

/** Returns rows for all segments for a given year */
export function getSegmentRowsByYear(year: number): SegmentRow[] {
  return getSegmentRows().filter((r) => r.year === year);
}

/** All years available in segment data */
export function getSegmentYears(): number[] {
  return [...new Set(getSegmentRows().map((r) => r.year))].sort((a, b) => a - b);
}
