"use client";

import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import type { AnnualRow } from "@/lib/types";
import type { SegmentRow } from "@/lib/types";
import { SEG_COLORS } from "./RevenueSegmentChart";

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
  groupMargin?: number;
}

export function AopSegmentChart({ annualRows, segmentRows }: Props) {
  const annualMap = new Map(annualRows.map((r) => [r.year, r]));
  const yearSet = [...new Set(segmentRows.map((r) => r.year))].sort((a, b) => a - b);

  const data: ChartRow[] = yearSet.map((year) => {
    const segsThisYear = segmentRows.filter((r) => r.year === year);
    const row: ChartRow = { year };
    for (const s of segsThisYear) {
      (row as unknown as Record<string, number>)[s.segment] = s.adjOpProfit;
    }
    const ann = annualMap.get(year);
    row.groupMargin = ann?.adjOperatingMargin;
    return row;
  });

  return (
    <div className="w-full">
      <div className="mb-4">
        <p className="text-sm font-bold text-[#0B2342] leading-snug">
          Adjusted operating margin expands from ~31% to 35%, with Risk and STM well above 37%
        </p>
        <p className="text-[11px] text-[#888] italic mt-0.5">
          Stacked bars = segment adj. op profit (£m) · Line = group adj. op margin %
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
            tickFormatter={(v) => `£${v}m`}
            width={52}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 13, fill: "#888" }}
            tickFormatter={(v) => `${v.toFixed(0)}%`}
            domain={[25, 40]}
          />
          <Tooltip
            formatter={(value, name) => {
              const v = value as number;
              const n = String(name ?? "");
              return n === "groupMargin"
                ? [`${v?.toFixed(1)}%`, "Group adj. margin"]
                : [`£${v?.toLocaleString()}m`, n + " AOP"];
            }}
            contentStyle={{ fontSize: 12, border: "1px solid #EBEBEB" }}
          />
          <Legend
            wrapperStyle={{ fontSize: 13, paddingTop: 8 }}
            formatter={(v) => v === "groupMargin" ? "Group margin %" : v + " AOP"}
          />
          {(["Risk", "STM", "Legal", "Exhibitions", "Print"] as const).map((seg) => (
            <Bar
              key={seg}
              yAxisId="left"
              dataKey={seg}
              stackId="aop"
              fill={SEG_COLORS[seg]}
              name={seg}
            />
          ))}
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="groupMargin"
            name="groupMargin"
            stroke="#0B2342"
            strokeWidth={2}
            dot={{ r: 3, fill: "#0B2342" }}
            connectNulls
          />
        </ComposedChart>
      </ResponsiveContainer>

      {/* Data table */}
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-xs font-mono border-t border-[#EBEBEB]">
          <thead>
            <tr className="text-[#888] text-[10px] uppercase tracking-wide">
              <td className="py-1 pr-3 font-sans font-semibold">Segment AOP (£m)</td>
              {yearSet.slice(-8).map((y) => (
                <td key={y} className="py-1 px-2 text-right">{y}</td>
              ))}
            </tr>
          </thead>
          <tbody>
            {(["Risk", "STM", "Legal", "Exhibitions", "Print"] as const).map((seg) => {
              const segRows = segmentRows.filter((r) => r.segment === seg);
              return (
                <tr key={seg} className="border-t border-[#F3F3F3]">
                  <td className="py-1 pr-3 font-sans text-[11px] font-semibold" style={{ color: SEG_COLORS[seg] }}>{seg}</td>
                  {yearSet.slice(-8).map((y) => {
                    const r = segRows.find((s) => s.year === y);
                    return (
                      <td key={y} className="py-1 px-2 text-right text-[#333]">
                        {r != null ? r.adjOpProfit.toLocaleString() : "—"}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            <tr className="border-t border-[#F3F3F3] text-[#6B7280]">
              <td className="py-1 pr-3 font-sans text-[11px]">Margin %</td>
              {yearSet.slice(-8).map((y) => {
                const ann = annualMap.get(y);
                return (
                  <td key={y} className="py-1 px-2 text-right">
                    {ann?.adjOperatingMargin != null ? `${ann.adjOperatingMargin.toFixed(1)}%` : "—"}
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
