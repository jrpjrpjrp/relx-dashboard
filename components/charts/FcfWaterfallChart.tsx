"use client";

import {
  ComposedChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Cell, ResponsiveContainer, LabelList,
} from "recharts";
import type { AnnualRow } from "@/lib/types";

interface Props {
  row: AnnualRow;
}

interface WaterfallBar {
  label: string;
  base: number;    // invisible base (stacked below)
  value: number;   // visible bar
  color: string;
  isTotal: boolean;
}

export function FcfWaterfallChart({ row }: Props) {
  if (
    row.adjCashFlow == null ||
    row.netInterestPaid == null ||
    row.cashTaxPaid == null ||
    row.fcfBeforeDividends == null
  ) {
    return (
      <p className="text-sm text-[#888] italic">
        Insufficient data for waterfall — need adjCashFlow, netInterestPaid, cashTaxPaid, fcfBeforeDividends.
      </p>
    );
  }

  // All values in £m. netInterestPaid and cashTaxPaid are stored as negative in the JSON
  // (reflecting outflows), so we negate them to get the deduction magnitude.
  const adjCashFlow   = row.adjCashFlow;
  const interest      = Math.abs(row.netInterestPaid);    // deduction
  const tax           = Math.abs(row.cashTaxPaid);         // deduction
  // acqDisposalItems: typically negative (outflow). Store as deduction magnitude.
  const acqDisposal   = row.acqDisposalItems != null ? Math.abs(row.acqDisposalItems) : 0;
  const fcfBefore     = row.fcfBeforeDividends;
  // dividendsPaidToShareholders: stored as negative. Use abs for display.
  const divs          = row.dividendsPaidToShareholders != null ? Math.abs(row.dividendsPaidToShareholders) : 0;
  const fcfAfter      = row.fcfAfterDividends;

  // Build waterfall steps
  type Step = { label: string; value: number; isDeduction: boolean; isTotal: boolean };
  const steps: Step[] = [
    { label: "Adj. cash flow",       value: adjCashFlow, isDeduction: false, isTotal: false },
    { label: "Net interest paid",    value: interest,    isDeduction: true,  isTotal: false },
    { label: "Cash tax paid",        value: tax,         isDeduction: true,  isTotal: false },
  ];
  if (acqDisposal > 0) {
    steps.push({ label: "Acq. / disposal", value: acqDisposal, isDeduction: true, isTotal: false });
  }
  steps.push({ label: "FCF before divs", value: fcfBefore, isDeduction: false, isTotal: true });
  if (divs > 0) {
    steps.push({ label: "Dividends paid", value: divs, isDeduction: true, isTotal: false });
  }
  if (fcfAfter != null) {
    steps.push({ label: "FCF after divs", value: fcfAfter, isDeduction: false, isTotal: true });
  }

  // Compute running cursor to determine base for non-total bars
  const bars: WaterfallBar[] = [];
  let cursor = 0;

  for (const step of steps) {
    if (step.isTotal) {
      bars.push({
        label: step.label,
        base: 0,
        value: step.value,
        color: step.label.startsWith("FCF after") ? "#0B2342" : "#1E5EAA",
        isTotal: true,
      });
      cursor = step.value;
    } else if (step.isDeduction) {
      const base = cursor - step.value;
      bars.push({
        label: step.label,
        base,
        value: step.value,
        color: "#C84040",
        isTotal: false,
      });
      cursor -= step.value;
    } else {
      // positive increment (only adjCashFlow start)
      bars.push({
        label: step.label,
        base: 0,
        value: step.value,
        color: "#2A8C6B",
        isTotal: false,
      });
      cursor = step.value;
    }
  }

  const maxVal = Math.max(...bars.map((b) => b.base + b.value)) * 1.1;

  return (
    <div className="w-full">
      <div className="mb-4">
        <p className="text-sm font-bold text-[#0B2342] leading-snug">
          FCF bridge FY{row.year}: £{(adjCashFlow / 1000).toFixed(1)}bn adj. cash flow converts to £{(fcfBefore / 1000).toFixed(1)}bn FCF before dividends
        </p>
        <p className="text-[11px] text-[#888] italic mt-0.5">
          Adj. cash flow → net interest → cash tax → acq./disposal items → FCF before divs → dividends → FCF after divs · £m
        </p>
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={bars} margin={{ top: 16, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="#EBEBEB" />
          <XAxis
            dataKey="label"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11 }}
            interval={0}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 13 }}
            tickFormatter={(v) => `£${(v / 1000).toFixed(1)}bn`}
            domain={[0, maxVal]}
            width={56}
          />
          <Tooltip
            content={({ payload }) => {
              if (!payload?.length) return null;
              const d = payload[0].payload as WaterfallBar;
              return (
                <div className="bg-white border border-[#EBEBEB] rounded px-3 py-2 text-xs shadow-sm">
                  <p className="font-semibold mb-1 text-[#0B2342]">{d.label}</p>
                  <p>£{d.value.toLocaleString()}m</p>
                </div>
              );
            }}
          />
          {/* Invisible base bar */}
          <Bar dataKey="base" stackId="wf" fill="transparent" legendType="none" />
          {/* Visible value bar */}
          <Bar dataKey="value" stackId="wf" radius={[2, 2, 0, 0]} legendType="none">
            {bars.map((b, i) => (
              <Cell key={i} fill={b.color} fillOpacity={b.isTotal ? 1 : 0.85} />
            ))}
            <LabelList
              dataKey="value"
              position="top"
              formatter={(v) => `£${(v as number).toLocaleString()}`}
              style={{ fontSize: 10, fill: "#555", fontFamily: "monospace" }}
            />
          </Bar>
        </ComposedChart>
      </ResponsiveContainer>

      {/* Summary table */}
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-xs font-mono border-t border-[#EBEBEB]">
          <thead>
            <tr className="text-[#888] text-[10px] uppercase tracking-wide">
              <td className="py-1 pr-3 font-sans font-semibold">FY{row.year} bridge (£m)</td>
              <td className="py-1 px-2 text-right">Amount</td>
              <td className="py-1 px-2 text-right">% of adj. CF</td>
            </tr>
          </thead>
          <tbody>
            {bars.map((b, i) => (
              <tr
                key={i}
                className={b.isTotal ? "border-t-2 border-[#EBEBEB] font-semibold text-[#0B2342]" : "border-t border-[#F3F3F3]"}
              >
                <td
                  className="py-1 pr-3 font-sans text-[11px]"
                  style={{ color: b.isTotal ? "#0B2342" : b.color === "#C84040" ? "#C84040" : "#2A8C6B" }}
                >
                  {b.isTotal ? "" : b.color === "#C84040" ? "− " : ""}{b.label}
                </td>
                <td className="py-1 px-2 text-right">
                  {b.color === "#C84040" ? "−" : ""}£{b.value.toLocaleString()}m
                </td>
                <td className="py-1 px-2 text-right text-[#888]">
                  {(b.value / adjCashFlow * 100).toFixed(0)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
