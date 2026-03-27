"use client";

import {
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import type { CapitalAllocationRow } from "@/lib/types";

interface Props {
  rows: CapitalAllocationRow[];
}

export function CumulativeReturnsChart({ rows }: Props) {
  const sorted = [...rows].sort((a, b) => a.year - b.year);

  let cumBuybacks = 0;
  let cumDividends = 0;

  const data = sorted.map((r) => {
    cumBuybacks += r.buybacks;
    cumDividends += r.dividendsPaid;
    return {
      year: r.year,
      cumBuybacks,
      cumDividends,
      cumTotal: cumBuybacks + cumDividends,
    };
  });

  const total = data[data.length - 1]?.cumTotal ?? 0;
  const startYear = sorted[0]?.year;
  const endYear = sorted[sorted.length - 1]?.year;

  return (
    <div className="w-full">
      <div className="mb-4">
        <p className="text-sm font-bold text-[#0B2342] leading-snug">
          £{(total / 1000).toFixed(1)}bn returned to shareholders via buybacks + dividends ({startYear}–{endYear})
        </p>
        <p className="text-[11px] text-[#888] italic mt-0.5">
          Cumulative capital returns (£m) · stacked areas = buybacks + dividends
        </p>
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="#EBEBEB" />
          <XAxis dataKey="year" axisLine={false} tickLine={false} tick={{ fontSize: 13 }} />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 13 }}
            tickFormatter={(v) => `£${(v / 1000).toFixed(0)}bn`}
            width={52}
          />
          <Tooltip
            formatter={(value, name) => {
              const labels: Record<string, string> = {
                cumDividends: "Cumulative dividends",
                cumBuybacks: "Cumulative buybacks",
                cumTotal: "Total returned",
              };
              return [`£${(value as number)?.toLocaleString()}m`, labels[String(name)] ?? String(name)];
            }}
            contentStyle={{ fontSize: 12, border: "1px solid #EBEBEB" }}
          />
          <Legend
            wrapperStyle={{ fontSize: 13, paddingTop: 8 }}
            formatter={(v) => ({ cumDividends: "Dividends", cumBuybacks: "Buybacks", cumTotal: "Total" }[v as string] ?? v)}
          />
          <Area
            type="monotone"
            dataKey="cumDividends"
            name="cumDividends"
            stackId="ret"
            stroke="#2A8C6B"
            fill="#2A8C6B"
            fillOpacity={0.25}
            strokeWidth={1.5}
          />
          <Area
            type="monotone"
            dataKey="cumBuybacks"
            name="cumBuybacks"
            stackId="ret"
            stroke="#1E5EAA"
            fill="#1E5EAA"
            fillOpacity={0.25}
            strokeWidth={1.5}
          />
          <Line
            type="monotone"
            dataKey="cumTotal"
            name="cumTotal"
            stroke="#0B2342"
            strokeWidth={2}
            dot={{ r: 3, fill: "#0B2342" }}
          />
        </ComposedChart>
      </ResponsiveContainer>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-xs font-mono border-t border-[#EBEBEB]">
          <thead>
            <tr className="text-[#888] text-[10px] uppercase tracking-wide">
              <td className="py-1 pr-3 font-sans font-semibold">£m cumulative</td>
              {data.map((r) => <td key={r.year} className="py-1 px-2 text-right">{r.year}</td>)}
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-[#F3F3F3]">
              <td className="py-1 pr-3 font-sans text-[11px] font-semibold" style={{ color: "#2A8C6B" }}>Dividends</td>
              {data.map((r) => <td key={r.year} className="py-1 px-2 text-right">{r.cumDividends.toLocaleString()}</td>)}
            </tr>
            <tr className="border-t border-[#F3F3F3]">
              <td className="py-1 pr-3 font-sans text-[11px] font-semibold" style={{ color: "#1E5EAA" }}>Buybacks</td>
              {data.map((r) => <td key={r.year} className="py-1 px-2 text-right">{r.cumBuybacks.toLocaleString()}</td>)}
            </tr>
            <tr className="border-t-2 border-[#EBEBEB] font-semibold text-[#0B2342]">
              <td className="py-1 pr-3 font-sans text-[11px]">Total returned</td>
              {data.map((r) => <td key={r.year} className="py-1 px-2 text-right">{r.cumTotal.toLocaleString()}</td>)}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
