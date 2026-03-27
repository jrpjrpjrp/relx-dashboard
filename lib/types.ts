// ─── Group-level annual row ───────────────────────────────────────────────────
// All monetary values in GBP millions (native RELX reporting currency).
// Field names match relx-financials.json output from fetch_relx_financials.py.

export interface AnnualRow {
  year: number;

  // IFRS P&L
  revenue: number;
  grossProfit?: number;
  reportedOpProfit?: number;
  pbt?: number;
  taxCharge?: number;
  netIncome?: number;
  epsBasic?: number;
  epsDiluted?: number;

  // IFRS cash flow
  operatingCF?: number;
  investingCF?: number;
  capexDev?: number;     // dev intangibles capex
  capexPPE?: number;     // property, plant & equipment capex
  capexTotal?: number;   // capexDev + capexPPE
  dividendsPaid?: number;

  // IFRS balance sheet
  borrowings?: number;   // gross debt
  cash?: number;
  netDebt?: number;

  // IFRS other
  employeeCosts?: number;
  costOfSales?: number;
  ebitda?: number;

  // Adjusted (non-IFRS) — from Exhibit 15.2
  adjOperatingProfit?: number;
  adjNetInterestExp?: number;
  adjPBT?: number;
  adjTax?: number;
  adjNetProfit?: number;
  adjCashFlow?: number;
  adjEPS?: number;           // pence
  dividendPerShare?: number; // pence
  netInterestPaid?: number;
  cashTaxPaid?: number;
  acqDisposalItems?: number;
  fcfBeforeDividends?: number;
  dividendsPaidToShareholders?: number;
  fcfAfterDividends?: number;

  // Management KPIs (from Annual Report adjusted figures summary)
  underlyingRevenueGrowth?: number; // % — excludes FX, acquisitions, exhibition cycling
  roic?: number;                    // % — return on invested capital (company definition)

  // Derived (computed in data.ts)
  revenueGrowthYoY?: number;        // %
  adjOperatingMargin?: number;      // %
  reportedOperatingMargin?: number; // %
  netMargin?: number;               // %
  fcfMargin?: number;               // %
  fcfConversion?: number;           // % = fcfBeforeDividends / netIncome
  netDebtToEbitda?: number;         // x
}

// ─── Segment annual row ───────────────────────────────────────────────────────
// One row per (year, segment). Field names match relx-segments.json.

export type SegmentName = "Risk" | "STM" | "Legal" | "Exhibitions" | "Print";

export interface SegmentRow {
  year: number;
  segment: SegmentName;
  revenue: number;        // £m
  adjOpProfit: number;    // £m
  adjOpMargin: number;    // %
  revenueGrowthYoY?: number; // % (computed in segmentData.ts)
}

// ─── Capital allocation row ───────────────────────────────────────────────────
export interface CapitalAllocationRow {
  year: number;
  dividendsPaid: number;  // £m
  buybacks: number;       // £m
  acquisitions: number;   // £m (cash spent on M&A, net of disposals)
  netDebtChange?: number; // £m (positive = debt increased)
}

// ─── Glossary ─────────────────────────────────────────────────────────────────
export const TERM_DEFINITIONS: Record<string, string> = {
  "Adjusted Operating Profit":
    "Operating profit before amortisation of acquired intangible assets and acquisition/disposal-related costs. RELX's preferred profit measure for comparing underlying performance year-over-year.",
  "Adjusted EPS":
    "Diluted EPS calculated on adjusted operating profit, adjusted net finance costs, and a normalised tax rate. Excludes acquisition-related charges.",
  "Adjusted Cash Flow":
    "Cash generated from operations before tax, adjusted for working capital movements. Conversion to FCF then deducts interest, tax, and acquisition-related costs.",
  "FCF Before Dividends":
    "Free cash flow after interest and tax but before dividend payments. Bridge: Adjusted Cash Flow − net interest paid − cash tax paid − acquisition/disposal items.",
  "Net Debt / EBITDA":
    "Gross debt minus cash, divided by adjusted EBITDA. RELX targets ~2×. At 2.0× it has significant headroom given A-rated credit and $3B undrawn facility.",
  "Revenue":
    "Total external revenue from all business segments: Risk, STM, Legal, Exhibitions (and Print & Related from 2025).",
  "Adj. Operating Margin":
    "Adjusted operating profit as % of revenue — strips out M&A amortisation noise for clean cross-year comparison.",
};
