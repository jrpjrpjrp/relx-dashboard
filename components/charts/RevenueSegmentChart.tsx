"use client";

import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, LabelList,
} from "recharts";
import type { AnnualRow } from "@/lib/types";
import type { SegmentRow } from "@/lib/types";

// Segment colours — consistent across all charts
export const SEG_COLORS = {
  Risk:        "#1E5EAA",
  STM:         "#2A8C6B",
  Legal:       "#C84040",
  Exhibitions: "#D47C00",
  Print:       "#8B8B8B",
} as const;

interface Props {
  annualRows: AnnualRow[];
  segmentRows: SegmentRow[];
}

interface ChartRow {
  year: number;
  Risk?: number;
  STM?: number;
  Legal?: number;
  Exhibitions?: number;
  Print?: number;
  total?: number;
  growth?: number;
  underlyingGrowth?: number;
}

export function RevenueSegmentChart({ annualRows, segmentRows }: Props) {
  // Build year-keyed map from annual rows (for total + growth)
  const annualMap = new Map(annualRows.map((r) => [r.year, r]));

  // Build chart data from segment rows — only years where segment data exists
  const yearSet = [...new Set(segmentRows.map((r) => r.year))].sort((a, b) => a - b);

  const data: ChartRow[] = yearSet.map((year) => {
    const segsThisYear = segmentRows.filter((r) => r.year === year);
    const row: ChartRow = { year };
    for (const s of segsThisYear) {
      (row as unknown as Record<string, number>)[s.segment] = s.revenue;
    }
    const ann = annualMap.get(year);
    row.total = ann?.revenue;
    row.growth = ann?.revenueGrowthYoY;
    row.underlyingGrowth = ann?.underlyingRevenueGrowth;
    return row;
  });

  return (
    <div className="w-full">
      <div className="mb-4">
        <p className="text-sm font-bold text-[#0B2342] leading-snug">
          Revenue grows at 8% CAGR (2018–2025), led by Risk and STM digital subscriptions
        </p>
        <p className="text-[11px] text-[#888] italic mt-0.5">
          Stacked bars = segment revenue (£m) · Solid line = reported YoY growth % · Dashed line = underlying growth % (constant FX, excl. acquisitions)
        </p>
      </div>
      <ResponsiveContainer width="100%" height={320}>
        <ComposedChart data={data} margin={{ top: 8, right: 48, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="#EBEBEB" />
          <XAxis dataKey="year" axisLine={false} tickLine={false} tick={{ fontSize: 13 }} />
          <YAxis
            yAxisId="left"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 13 }}
            tickFormatter={(v) => `£${v / 1000 < 1 ? v : (v / 1000).toFixed(0) + "k"}`}
            domain={[0, 12000]}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 13, fill: "#888" }}
            tickFormatter={(v) => `${v.toFixed(0)}%`}
            domain={[-5, 20]}
          />
          <Tooltip
            formatter={(value, name) => {
              const v = value as number;
              const n = String(name ?? "");
              if (n === "growth") return [`${v?.toFixed(1)}%`, "Reported growth"];
              if (n === "underlyingGrowth") return [`${v?.toFixed(0)}%`, "Underlying growth"];
              return [`£${v?.toLocaleString()}m`, n];
            }}
            contentStyle={{ fontSize: 12, border: "1px solid #EBEBEB" }}
          />
          <Legend
            wrapperStyle={{ fontSize: 13, paddingTop: 8 }}
            formatter={(v) => {
              if (v === "growth") return "Reported growth %";
              if (v === "underlyingGrowth") return "Underlying growth %";
              return v;
            }}
          />
          {(["Risk", "STM", "Legal", "Exhibitions", "Print"] as const).map((seg) => (
            <Bar
              key={seg}
              yAxisId="left"
              dataKey={seg}
              stackId="rev"
              fill={SEG_COLORS[seg]}
              name={seg}
            />
          ))}
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="growth"
            name="growth"
            stroke="#0B2342"
            strokeWidth={2}
            dot={{ r: 3, fill: "#0B2342" }}
            connectNulls
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="underlyingGrowth"
            name="underlyingGrowth"
            stroke="#0B2342"
            strokeWidth={1.5}
            strokeDasharray="5 3"
            dot={false}
            connectNulls
          />
        </ComposedChart>
      </ResponsiveContainer>

      {/* Data table */}
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-xs font-mono border-t border-[#EBEBEB]">
          <thead>
            <tr className="text-[#888] text-[10px] uppercase tracking-wide">
              <td className="py-1 pr-3 font-sans font-semibold">Segment (£m)</td>
              {yearSet.slice(-8).map((y) => (
                <td key={y} className="py-1 px-2 text-right">{y}{y === 2024 ? "†" : ""}</td>
              ))}
            </tr>
          </thead>
          <tbody>
            {(["Risk", "STM", "Legal", "Exhibitions", "Print"] as const).map((seg) => (
              <tr key={seg} className="border-t border-[#F3F3F3]">
                <td className="py-1 pr-3 font-sans text-[11px] font-semibold" style={{ color: SEG_COLORS[seg] }}>{seg}</td>
                {yearSet.slice(-8).map((y) => {
                  const row = data.find((d) => d.year === y);
                  const v = row ? (row as unknown as Record<string, number>)[seg] : undefined;
                  return (
                    <td key={y} className="py-1 px-2 text-right text-[#333]">
                      {v != null ? v.toLocaleString() : "—"}
                    </td>
                  );
                })}
              </tr>
            ))}
            <tr className="border-t-2 border-[#EBEBEB] font-semibold">
              <td className="py-1 pr-3 font-sans text-[11px] text-[#0B2342]">Group Total</td>
              {yearSet.slice(-8).map((y) => {
                const row = data.find((d) => d.year === y);
                return (
                  <td key={y} className="py-1 px-2 text-right text-[#0B2342]">
                    {row?.total != null ? row.total.toLocaleString() : "—"}
                  </td>
                );
              })}
            </tr>
            <tr className="border-t border-[#F3F3F3] text-[#6B7280]">
              <td className="py-1 pr-3 font-sans text-[11px]">Reported growth %</td>
              {yearSet.slice(-8).map((y) => {
                const row = data.find((d) => d.year === y);
                return (
                  <td key={y} className="py-1 px-2 text-right">
                    {row?.growth != null ? `${row.growth.toFixed(1)}%` : "—"}
                  </td>
                );
              })}
            </tr>
            <tr className="border-t border-[#F3F3F3] text-[#6B7280]">
              <td className="py-1 pr-3 font-sans text-[11px]">Underlying growth %</td>
              {yearSet.slice(-8).map((y) => {
                const row = data.find((d) => d.year === y);
                return (
                  <td key={y} className="py-1 px-2 text-right">
                    {row?.underlyingGrowth != null ? `${row.underlyingGrowth.toFixed(0)}%` : "—"}
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>
        <p className="mt-2 text-[10px] text-[#AAA] leading-snug">
          † FY2024 restated: STM print activities carved out into separate &apos;Print &amp; Related&apos; line;
          commercial healthcare reclassified to Risk. STM organic growth was +5% in 2024.
        </p>
      </div>
  );
}
