import { getAnnualRows, getLatestRow } from "@/lib/data";
import { getSegmentRows } from "@/lib/segmentData";
import { getCapitalRows } from "@/lib/capitalData";
import { DashboardTabs } from "@/components/Tabs";

export default function HomePage() {
  const annualRows = getAnnualRows();
  const segmentRows = getSegmentRows();
  const capitalRows = getCapitalRows();
  const latest = getLatestRow();

  const latestYear = latest?.year ?? 2025;
  const prevYear = latestYear - 1;

  return (
    <main className="min-h-screen bg-white text-[#1A1A1A]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">

        {/* Header */}
        <div className="border-t-4 border-[#0B2342] pt-6 mb-10">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#888] mb-3">
            Strategic Financial Profile · FY 2016–{latestYear} · SEC EDGAR / RELX Annual Reports
          </p>
          <div className="flex flex-wrap items-baseline gap-4">
            <h1 className="text-4xl font-light tracking-tight text-[#0B2342]">RELX Group</h1>
            <span className="text-sm font-mono text-[#6B7280] tracking-wide">LSE: REL · NYSE: RELX</span>
          </div>
          <p className="mt-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#888]">
            Information Analytics — Risk · Scientific Technical &amp; Medical · Legal · Exhibitions
          </p>
        </div>

        {/* Company brief */}
        <div className="mb-8 border-l-4 border-[#1E5EAA] pl-5">
          <p className="text-sm text-[#2D3748] leading-relaxed">
            RELX is a global provider of information-based analytics and decision tools, serving professional
            and business customers across four segments. Over 70% of revenue is recurring subscriptions and
            electronic content. The company has compounded adj. operating profit at ~9% annually since 2018
            while expanding margins from ~31% to 35% and returning over £12bn to shareholders via buybacks
            and dividends in the last five years. Credit ratings: <strong>S&amp;P A−</strong> ·{" "}
            <strong>Moody&apos;s A3</strong> · <strong>Fitch A−</strong> (all Stable).
          </p>
        </div>

        {/* Currency note */}
        <p className="mb-8 text-[11px] text-[#AAA] leading-relaxed">
          All monetary figures in GBP millions (£m) unless stated. IFRS accounting — adjusted metrics exclude
          amortisation of acquired intangibles and acquisition/disposal-related costs. Sources: SEC EDGAR 20-F
          filings (XBRL + HTML) and RELX Exhibit 15.2 Annual Report, FY{prevYear}–{latestYear} validated.
        </p>

        {/* Main tabs */}
        <DashboardTabs
          annualRows={annualRows}
          segmentRows={segmentRows}
          capitalRows={capitalRows}
        />

        {/* Footer */}
        <div className="mt-16 pt-6 border-t border-[#EBEBEB] flex flex-wrap justify-between gap-2">
          <p className="text-[10px] text-[#BBB] uppercase tracking-[0.12em]">
            Data: SEC EDGAR CIK 0000929869 · IFRS consolidated
          </p>
          <p className="text-[10px] text-[#BBB]">
            For informational purposes only — not investment advice
          </p>
        </div>

      </div>
    </main>
  );
}
