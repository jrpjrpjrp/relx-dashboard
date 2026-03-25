"use client";

import type { AnnualRow } from "@/lib/types";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";

interface Props {
  rows: AnnualRow[];
}

export function FcfBridgeChart({ rows }: Props) {
  // Show adj cash flow, FCF before dividends, FCF after dividends trend
  const data = rows
    .filter((r) => r.adjCashFlow != null && r.fcfBeforeDividends != null)
    .map((r) => ({
      year: r.year,
      adjCashFlow: r.adjCashFlow,
      fcfBeforeDividends: r.fcfBeforeDividends,
      fcfMargin: r.fcfMargin,
    }));

  return (
    <div className="w-full">
      <div className="mb-4">
        <p className="text-sm font-bold text-[#0B2342] leading-snug">
          FCF before dividends grows to £2.3bn — 24% of revenue, highly cash-generative
        </p>
        <p className="text-[11px] text-[#888] italic mt-0.5">
          Adj. cash flow vs FCF before dividends (£m) — gap = interest + tax + acquisition items
        </p>
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap="30%">
          <CartesianGrid vertical={false} stroke="#EBEBEB" />
          <XAxis dataKey="year" axisLine={false} tickLine={false} tick={{ fontSize: 13 }} />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 13 }}
            tickFormatter={(v) => `£${v}m`}
            width={60}
            domain={[0, 3800]}
          />
          <Tooltip
            formatter={(value, name) => [
              `£${(value as number)?.toLocaleString()}m`,
              String(name ?? "") === "adjCashFlow" ? "Adj. cash flow" : "FCF before dividends",
            ]}
            contentStyle={{ fontSize: 12, border: "1px solid #EBEBEB" }}
          />
          <ReferenceLine yAxisId={undefined} y={0} stroke="#EBEBEB" />
          <Bar dataKey="adjCashFlow" name="adjCashFlow" fill="#1E5EAA" opacity={0.5} />
          <Bar dataKey="fcfBeforeDividends" name="fcfBeforeDividends" fill="#1E5EAA" />
        </BarChart>
      </ResponsiveContainer>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-xs font-mono border-t border-[#EBEBEB]">
          <thead>
            <tr className="text-[#888] text-[10px] uppercase tracking-wide">
              <td className="py-1 pr-3 font-sans font-semibold">£m</td>
              {data.map((r) => <td key={r.year} className="py-1 px-2 text-right">{r.year}</td>)}
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-[#F3F3F3]">
              <td className="py-1 pr-3 font-sans text-[11px] text-[#6B7280]">Adj. cash flow</td>
              {data.map((r) => <td key={r.year} className="py-1 px-2 text-right text-[#333]">{r.adjCashFlow?.toLocaleString() ?? "—"}</td>)}
            </tr>
            <tr className="border-t border-[#F3F3F3] font-semibold text-[#0B2342]">
              <td className="py-1 pr-3 font-sans text-[11px]">FCF before dividends</td>
              {data.map((r) => <td key={r.year} className="py-1 px-2 text-right">{r.fcfBeforeDividends?.toLocaleString() ?? "—"}</td>)}
            </tr>
            <tr className="border-t border-[#F3F3F3] text-[#6B7280]">
              <td className="py-1 pr-3 font-sans text-[11px]">FCF margin %</td>
              {data.map((r) => <td key={r.year} className="py-1 px-2 text-right">{r.fcfMargin != null ? `${r.fcfMargin.toFixed(1)}%` : "—"}</td>)}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
