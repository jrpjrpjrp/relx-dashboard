// Shared formatting helpers (GBP-native, optional USD display)

export const GBP_TO_USD = 1.25; // Jan 1, 2025 rate used throughout

type Currency = "GBP" | "USD";

export function fmtM(value: number | undefined, currency: Currency = "GBP", decimals = 1): string {
  if (value === undefined || isNaN(value)) return "—";
  const v = currency === "USD" ? value * GBP_TO_USD : value;
  const sym = currency === "USD" ? "$" : "£";
  if (Math.abs(v) >= 1000) return `${sym}${(v / 1000).toFixed(1)}B`;
  return `${sym}${v.toFixed(decimals)}M`;
}

export function fmtPct(value: number | undefined, decimals = 1): string {
  if (value === undefined || isNaN(value)) return "—";
  return `${value.toFixed(decimals)}%`;
}

export function fmtX(value: number | undefined, decimals = 1): string {
  if (value === undefined || isNaN(value)) return "—";
  return `${value.toFixed(decimals)}×`;
}

export function fmtP(pence: number | undefined): string {
  if (pence === undefined || isNaN(pence)) return "—";
  return `${pence.toFixed(1)}p`;
}
