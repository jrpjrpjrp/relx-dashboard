// Capital allocation data loader — reads relx-capalloc.json.

import type { CapitalAllocationRow } from "./types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let rawData: any[] = [];

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  rawData = require("../data/relx-capalloc.json");
} catch {
  // not yet generated
}

export function getCapitalRows(): CapitalAllocationRow[] {
  if (!rawData.length) return [];
  return (rawData as CapitalAllocationRow[]).sort((a, b) => a.year - b.year);
}
