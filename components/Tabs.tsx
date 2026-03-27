"use client";

import { useState } from "react";
import type { AnnualRow, SegmentRow, CapitalAllocationRow } from "@/lib/types";
import { fmtM, GBP_TO_USD } from "@/lib/format";
import { KpiCard } from "./KpiCard";
import { RevenueSegmentChart } from "./charts/RevenueSegmentChart";
import { AopSegmentChart } from "./charts/AopSegmentChart";
import { CashDeploymentChart } from "./charts/CashDeploymentChart";
import { FcfBridgeChart } from "./charts/FcfBridgeChart";
import { DebtProfileChart } from "./charts/DebtProfileChart";
import { SegmentCompareChart } from "./charts/SegmentCompareChart";
import { SegmentScatterChart } from "./charts/SegmentScatterChart";
import { CumulativeReturnsChart } from "./charts/CumulativeReturnsChart";
import { FcfWaterfallChart } from "./charts/FcfWaterfallChart";
import { SegmentDeepDiveTab } from "./SegmentDeepDiveTab";

const TABS = [
  "Group Overview",
  "Capital Allocation",
  "Segment Comparison",
  "Risk Solutions",
  "STM",
  "Legal",
  "Exhibitions",
] as const;
type Tab = (typeof TABS)[number];

function Section({ fig, children }: { fig: string; children: React.ReactNode }) {
  return (
    <div className="mb-12">
      <div className="flex items-center gap-2 mb-6">
        <span className="text-[10px] font-mono text-[#AAA]">{fig}</span>
        <div className="flex-1 h-px bg-[#EBEBEB]" />
      </div>
      {children}
    </div>
  );
}

interface Props {
  annualRows: AnnualRow[];
  segmentRows: SegmentRow[];
  capitalRows: CapitalAllocationRow[];
}

export function DashboardTabs({ annualRows, segmentRows, capitalRows }: Props) {
  const [active, setActive] = useState<Tab>("Group Overview");
  const [currency, setCurrency] = useState<"GBP" | "USD">("GBP");

  const latest = annualRows[annualRows.length - 1];
  const prev = annualRows[annualRows.length - 2];

  return (
    <div>
      {/* Tab bar */}
      <div className="mb-8 border-b border-[#EBEBEB]">
        <div className="flex flex-wrap items-end gap-0 justify-between">
          <div className="flex flex-wrap items-end gap-0">
            {TABS.map((tab) => {
              const isActive = active === tab;
              return (
                <button
                  key={tab}
                  onClick={() => setActive(tab)}
                  className={[
                    "px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.12em] transition-all cursor-pointer select-none",
                    isActive
                      ? "bg-[#0B2342] text-white -mb-px pb-[11px]"
                      : "text-[#6B7280] hover:text-[#0B2342] hover:bg-[#F5F7FA]",
                  ].join(" ")}
                >
                  {tab}
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-1 pb-2 pr-1">
            {(["GBP", "USD"] as const).map((c) => (
              <button
                key={c}
                onClick={() => setCurrency(c)}
                className={[
                  "px-3 py-1 text-[10px] font-mono font-semibold rounded transition-all cursor-pointer",
                  currency === c
                    ? "bg-[#0B2342] text-white"
                    : "text-[#6B7280] border border-[#EBEBEB] hover:border-[#0B2342]",
                ].join(" ")}
              >
                {c === "GBP" ? "£ GBP" : `$ USD (×${GBP_TO_USD})`}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── TAB 1: Group Overview ─────────────────────────────────────────────── */}
      {active === "Group Overview" && (
        <div>
          {/* KPI strip */}
          {latest && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-6 mb-10">
              <KpiCard
                label="Revenue"
                value={fmtM(latest.revenue, currency)}
                sub={`FY${latest.year}`}
                delta={latest.revenueGrowthYoY != null ? `+${latest.revenueGrowthYoY.toFixed(1)}% YoY` : undefined}
                deltaPositive
              />
              <KpiCard
                label="Adj. op margin"
                value={latest.adjOperatingMargin != null ? `${latest.adjOperatingMargin.toFixed(1)}%` : "—"}
                sub={`${fmtM(latest.adjOperatingProfit, currency)} AOP`}
                delta={prev?.adjOperatingMargin != null && latest.adjOperatingMargin != null
                  ? `${(latest.adjOperatingMargin - prev.adjOperatingMargin).toFixed(1)}pp vs prior year`
                  : undefined}
                deltaPositive={
                  prev?.adjOperatingMargin != null && latest.adjOperatingMargin != null
                    ? latest.adjOperatingMargin >= prev.adjOperatingMargin
                    : undefined
                }
                accent="#2A8C6B"
              />
              <KpiCard
                label="FCF before divs"
                value={fmtM(latest.fcfBeforeDividends, currency)}
                sub={latest.fcfMargin != null ? `${latest.fcfMargin.toFixed(1)}% FCF margin` : undefined}
                accent="#1E5EAA"
              />
              <KpiCard
                label="Net debt / EBITDA"
                value={latest.netDebtToEbitda != null ? `${latest.netDebtToEbitda.toFixed(1)}×` : "—"}
                sub={latest.netDebt != null ? `${fmtM(latest.netDebt, currency)} net debt` : undefined}
                accent="#C84040"
              />
              <KpiCard
                label="Adj. EPS"
                value={latest.adjEPS != null ? `${latest.adjEPS.toFixed(0)}p` : "—"}
                sub={latest.epsDiluted != null ? `${latest.epsDiluted.toFixed(0)}p diluted IFRS EPS` : undefined}
                accent="#D47C00"
              />
              <KpiCard
                label="Cash conversion"
                value={latest.adjCashFlow != null && latest.adjOperatingProfit != null
                  ? `${(latest.adjCashFlow / latest.adjOperatingProfit * 100).toFixed(0)}%`
                  : "—"}
                sub="Adj. cash flow / adj. op profit"
                accent="#8B8B8B"
              />
              <KpiCard
                label="ROIC"
                value={latest.roic != null ? `${latest.roic.toFixed(1)}%` : "—"}
                sub={prev?.roic != null && latest.roic != null
                  ? `${(latest.roic - prev.roic) >= 0 ? "+" : ""}${(latest.roic - prev.roic).toFixed(1)}pp vs prior year`
                  : "Return on invested capital"}
                deltaPositive={prev?.roic != null && latest.roic != null ? latest.roic >= prev.roic : undefined}
                accent="#6B3FA0"
              />
            </div>
          )}

          <Section fig="FIG A1">
            <RevenueSegmentChart annualRows={annualRows} segmentRows={segmentRows} />
          </Section>
          <Section fig="FIG A2">
            <AopSegmentChart annualRows={annualRows} segmentRows={segmentRows} />
          </Section>
        </div>
      )}

      {/* ── TAB 2: Capital Allocation ─────────────────────────────────────────── */}
      {active === "Capital Allocation" && (
        <div>
          <Section fig="FIG B1">
            <FcfBridgeChart rows={annualRows} />
          </Section>
          <Section fig="FIG B2">
            <CashDeploymentChart rows={capitalRows} />
          </Section>
          <Section fig="FIG B3">
            <DebtProfileChart rows={annualRows} />
          </Section>
          <Section fig="FIG B4">
            <CumulativeReturnsChart rows={capitalRows} />
          </Section>
          {latest && (
            <Section fig="FIG B5">
              <FcfWaterfallChart row={latest} />
            </Section>
          )}
        </div>
      )}

      {/* ── TAB 3: Segment Comparison ─────────────────────────────────────────── */}
      {active === "Segment Comparison" && (
        <div>
          <Section fig="FIG C1">
            <SegmentCompareChart
              segmentRows={segmentRows}
              metric="revenue"
              title="Risk leads on revenue scale; STM now closing the gap after healthcare reclassification"
              subtitle="Revenue by segment (£m) — 4 core segments, annual trend"
            />
          </Section>
          <Section fig="FIG C2">
            <SegmentCompareChart
              segmentRows={segmentRows}
              metric="adjOpMargin"
              title="Risk and STM command 37–38% margins; Legal lags at 23% — structural mix shift opportunity"
              subtitle="Adjusted operating margin by segment (%) — annual trend"
            />
          </Section>
          <Section fig="FIG C3">
            <SegmentCompareChart
              segmentRows={segmentRows}
              metric="revenueGrowthYoY"
              title="Risk outgrows the group every year; Exhibitions volatile (COVID) then recovered sharply"
              subtitle="YoY revenue growth by segment (%) — annual trend"
            />
          </Section>

          <Section fig="FIG C5">
            <SegmentScatterChart segmentRows={segmentRows} />
          </Section>

          {/* Latest year snapshot table */}
          {(() => {
            const latestYear = Math.max(...segmentRows.map((r) => r.year));
            const segsLatest = segmentRows.filter((r) => r.year === latestYear);
            const totalRev = segsLatest.reduce((s, r) => s + r.revenue, 0);
            return (
              <div className="mt-4">
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-[10px] font-mono text-[#AAA]">FIG C4</span>
                  <div className="flex-1 h-px bg-[#EBEBEB]" />
                </div>
                <p className="text-sm font-bold text-[#0B2342] mb-1">
                  {latestYear} snapshot — Risk + STM = 65% of revenue but generate 71% of group profit
                </p>
                <p className="text-[11px] text-[#888] italic mb-4">
                  All four segments · Revenue, profit, margin, share of group
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border border-[#EBEBEB] rounded">
                    <thead className="bg-[#F8F9FB] text-[10px] uppercase tracking-wide text-[#888]">
                      <tr>
                        <th className="py-2 px-3 text-left font-semibold">Segment</th>
                        <th className="py-2 px-3 text-right">Revenue £m</th>
                        <th className="py-2 px-3 text-right">Rev share %</th>
                        <th className="py-2 px-3 text-right">AOP £m</th>
                        <th className="py-2 px-3 text-right">AOP margin %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {segsLatest.sort((a, b) => b.revenue - a.revenue).map((seg) => (
                        <tr key={seg.segment} className="border-t border-[#F3F3F3]">
                          <td className="py-2 px-3 font-semibold text-sm" style={{ color: ({ Risk: "#1E5EAA", STM: "#2A8C6B", Legal: "#C84040", Exhibitions: "#D47C00", Print: "#8B8B8B" } as Record<string, string>)[seg.segment] }}>
                            {seg.segment}
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-sm">{seg.revenue.toLocaleString()}</td>
                          <td className="py-2 px-3 text-right font-mono text-sm">{(seg.revenue / totalRev * 100).toFixed(1)}%</td>
                          <td className="py-2 px-3 text-right font-mono text-sm">{seg.adjOpProfit.toLocaleString()}</td>
                          <td className="py-2 px-3 text-right font-mono text-sm">{seg.adjOpMargin.toFixed(1)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* ── TAB 4: Risk Solutions ──────────────────────────────────────────────── */}
      {active === "Risk Solutions" && (
        <SegmentDeepDiveTab segmentName="Risk" segmentRows={segmentRows} annualRows={annualRows} figPrefix="D" />
      )}

      {/* ── TAB 5: STM ────────────────────────────────────────────────────────── */}
      {active === "STM" && (
        <SegmentDeepDiveTab segmentName="STM" segmentRows={segmentRows} annualRows={annualRows} figPrefix="E" />
      )}

      {/* ── TAB 6: Legal ──────────────────────────────────────────────────────── */}
      {active === "Legal" && (
        <SegmentDeepDiveTab segmentName="Legal" segmentRows={segmentRows} annualRows={annualRows} figPrefix="F" />
      )}

      {/* ── TAB 7: Exhibitions ────────────────────────────────────────────────── */}
      {active === "Exhibitions" && (
        <SegmentDeepDiveTab segmentName="Exhibitions" segmentRows={segmentRows} annualRows={annualRows} figPrefix="G" />
      )}
    </div>
  );
}
