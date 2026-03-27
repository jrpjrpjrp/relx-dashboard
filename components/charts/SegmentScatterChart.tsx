"use client";

import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, LabelList,
} from "recharts";
import type { SegmentRow } from "@/lib/types";
import { SEG_COLORS } from "./RevenueSegmentChart";

const CORE_SEGS = ["Risk", "STM", "Legal", "Exhibitions"] as const;

interface Props {
  segmentRows: SegmentRow[];
}

export function SegmentScatterChart({ segmentRows }: Props) {
  const latestYear = Math.max(...segmentRows.map((r) => r.year));
  const prevYear = latestYear - 1;

  const data = CORE_SEGS.map((seg) => {
    const latest = segmentRows.find((r) => r.segment === seg && r.year === latestYear);
    return latest
      ? {
          name: seg,
          growth: latest.revenueGrowthYoY ?? 0,
          margin: latest.adjOpMargin,
          fill: SEG_COLORS[seg],
        }
      : null;
  }).filter(Boolean) as { name: string; growth: number; margin: number; fill: string }[];

  return (
    <div className="w-full">
      <div className="mb-4">
        <p className="text-sm font-bold text-[#0B2342] leading-snug">
          Risk and STM occupy the high-margin / high-growth quadrant — Legal trades margin for investment; Exhibitions is recovering
        </p>
        <p className="text-[11px] text-[#888] italic mt-0.5">
          FY{latestYear} · X = YoY revenue growth (%) · Y = adj. op margin (%) · one dot per segment
        </p>
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <ScatterChart margin={{ top: 16, right: 24, bottom: 16, left: 0 }}>
          <CartesianGrid vertical={false} stroke="#EBEBEB" />
          <XAxis
            type="number"
            dataKey="growth"
            name="YoY growth"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 13 }}
            tickFormatter={(v) => `${v.toFixed(0)}%`}
            label={{ value: "YoY revenue growth (%)", position: "insideBottom", offset: -8, style: { fontSize: 11, fill: "#AAA" } }}
            domain={["auto", "auto"]}
          />
          <YAxis
            type="number"
            dataKey="margin"
            name="Adj. margin"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 13 }}
            tickFormatter={(v) => `${v}%`}
            domain={[15, 45]}
            width={44}
          />
          <Tooltip
            cursor={{ strokeDasharray: "3 3" }}
            content={({ payload }) => {
              if (!payload?.length) return null;
              const d = payload[0].payload;
              return (
                <div className="bg-white border border-[#EBEBEB] rounded px-3 py-2 text-xs shadow-sm">
                  <p className="font-semibold mb-1" style={{ color: d.fill }}>{d.name}</p>
                  <p>Revenue growth: <strong>{d.growth.toFixed(1)}%</strong></p>
                  <p>Adj. margin: <strong>{d.margin.toFixed(1)}%</strong></p>
                </div>
              );
            }}
          />
          <Scatter data={data} shape={(props: unknown) => {
            const p = props as { cx: number; cy: number; payload: { name: string; fill: string } };
            return (
              <circle
                cx={p.cx}
                cy={p.cy}
                r={14}
                fill={p.payload.fill}
                fillOpacity={0.85}
              />
            );
          }}>
            <LabelList
              dataKey="name"
              position="center"
              style={{ fontSize: 10, fill: "#fff", fontWeight: 700, fontFamily: "sans-serif" }}
            />
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>

      {/* Table */}
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-xs font-mono border-t border-[#EBEBEB]">
          <thead>
            <tr className="text-[#888] text-[10px] uppercase tracking-wide">
              <td className="py-1 pr-3 font-sans font-semibold">Segment</td>
              <td className="py-1 px-2 text-right">FY{latestYear} Revenue £m</td>
              <td className="py-1 px-2 text-right">YoY growth</td>
              <td className="py-1 px-2 text-right">Adj. margin</td>
              <td className="py-1 px-2 text-right">AOP £m</td>
            </tr>
          </thead>
          <tbody>
            {data.sort((a, b) => b.margin - a.margin).map((d) => {
              const row = segmentRows.find((r) => r.segment === d.name && r.year === latestYear);
              return (
                <tr key={d.name} className="border-t border-[#F3F3F3]">
                  <td className="py-1 pr-3 font-sans text-[11px] font-semibold" style={{ color: d.fill }}>{d.name}</td>
                  <td className="py-1 px-2 text-right">{row?.revenue.toLocaleString() ?? "—"}</td>
                  <td className="py-1 px-2 text-right">{d.growth >= 0 ? "+" : ""}{d.growth.toFixed(1)}%</td>
                  <td className="py-1 px-2 text-right">{d.margin.toFixed(1)}%</td>
                  <td className="py-1 px-2 text-right">{row?.adjOpProfit.toLocaleString() ?? "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="mt-1 text-[10px] text-[#AAA]">
          † FY{latestYear} YoY growth reflects reported GBP revenues. STM growth affected by FY{prevYear} segment restatement.
        </p>
      </div>
    </div>
  );
}
