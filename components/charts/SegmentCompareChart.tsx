"use client";

import {
  ComposedChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import type { SegmentRow, SegmentName } from "@/lib/types";
import { SEG_COLORS } from "./RevenueSegmentChart";

const CORE_SEGS: SegmentName[] = ["Risk", "STM", "Legal", "Exhibitions"];

interface Props {
  segmentRows: SegmentRow[];
  metric: "revenue" | "adjOpMargin" | "revenueGrowthYoY";
  title: string;
  subtitle: string;
  yLabel?: string;
  yFormatter?: (v: number) => string;
}

export function SegmentCompareChart({ segmentRows, metric, title, subtitle, yLabel, yFormatter }: Props) {
  const yearSet = [...new Set(segmentRows.map((r) => r.year))].sort((a, b) => a - b);

  const data = yearSet.map((year) => {
    const row: Record<string, number | undefined> = { year };
    for (const seg of CORE_SEGS) {
      const sr = segmentRows.find((r) => r.year === year && r.segment === seg);
      if (sr) row[seg] = (sr as unknown as Record<string, number>)[metric];
    }
    return row;
  });

  const defaultFmt = metric === "adjOpMargin" || metric === "revenueGrowthYoY"
    ? (v: number) => `${v?.toFixed(1)}%`
    : (v: number) => `£${v?.toLocaleString()}m`;
  const fmt = yFormatter ?? defaultFmt;

  return (
    <div className="w-full">
      <div className="mb-4">
        <p className="text-sm font-bold text-[#0B2342] leading-snug">{title}</p>
        <p className="text-[11px] text-[#888] italic mt-0.5">{subtitle}</p>
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="#EBEBEB" />
          <XAxis dataKey="year" axisLine={false} tickLine={false} tick={{ fontSize: 13 }} />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 13 }}
            tickFormatter={fmt}
            label={yLabel ? { value: yLabel, angle: -90, position: "insideLeft", style: { fontSize: 11 } } : undefined}
            width={56}
          />
          <Tooltip
            formatter={(value, name) => [fmt(value as number), String(name ?? "")]}
            contentStyle={{ fontSize: 12, border: "1px solid #EBEBEB" }}
          />
          <Legend wrapperStyle={{ fontSize: 13, paddingTop: 8 }} />
          {CORE_SEGS.map((seg) => (
            <Line
              key={seg}
              type="monotone"
              dataKey={seg}
              name={seg}
              stroke={SEG_COLORS[seg]}
              strokeWidth={2}
              dot={{ r: 3, fill: SEG_COLORS[seg] }}
              connectNulls
            />
          ))}
        </ComposedChart>
      </ResponsiveContainer>

      {/* Data table */}
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-xs font-mono border-t border-[#EBEBEB]">
          <thead>
            <tr className="text-[#888] text-[10px] uppercase tracking-wide">
              <td className="py-1 pr-3 font-sans font-semibold">Segment</td>
              {yearSet.slice(-8).map((y) => <td key={y} className="py-1 px-2 text-right">{y}</td>)}
            </tr>
          </thead>
          <tbody>
            {CORE_SEGS.map((seg) => (
              <tr key={seg} className="border-t border-[#F3F3F3]">
                <td className="py-1 pr-3 font-sans text-[11px] font-semibold" style={{ color: SEG_COLORS[seg] }}>{seg}</td>
                {yearSet.slice(-8).map((y) => {
                  const row = segmentRows.find((r) => r.year === y && r.segment === seg);
                  const v = row ? (row as unknown as Record<string, number>)[metric] : undefined;
                  return (
                    <td key={y} className="py-1 px-2 text-right text-[#333]">
                      {v != null ? fmt(v) : "—"}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
