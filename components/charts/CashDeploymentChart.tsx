"use client";

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import type { CapitalAllocationRow } from "@/lib/types";

interface Props {
  rows: CapitalAllocationRow[];
}

export function CashDeploymentChart({ rows }: Props) {
  return (
    <div className="w-full">
      <div className="mb-4">
        <p className="text-sm font-bold text-[#0B2342] leading-snug">
          Shareholder returns accelerate: buybacks + dividends exceed £2.5bn in 2024–25
        </p>
        <p className="text-[11px] text-[#888] italic mt-0.5">
          Stacked bars = annual cash deployment (£m) by category
        </p>
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="#EBEBEB" />
          <XAxis dataKey="year" axisLine={false} tickLine={false} tick={{ fontSize: 13 }} />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 13 }}
            tickFormatter={(v) => `£${v}m`}
            width={56}
          />
          <Tooltip
            formatter={(value, name) => [`£${(value as number)?.toLocaleString()}m`, String(name ?? "")]}
            contentStyle={{ fontSize: 12, border: "1px solid #EBEBEB" }}
          />
          <Legend wrapperStyle={{ fontSize: 13, paddingTop: 8 }} />
          <Bar dataKey="buybacks" name="Share buybacks" stackId="cap" fill="#1E5EAA" />
          <Bar dataKey="dividendsPaid" name="Dividends" stackId="cap" fill="#2A8C6B" />
          <Bar dataKey="acquisitions" name="Acquisitions" stackId="cap" fill="#D47C00" />
        </BarChart>
      </ResponsiveContainer>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-xs font-mono border-t border-[#EBEBEB]">
          <thead>
            <tr className="text-[#888] text-[10px] uppercase tracking-wide">
              <td className="py-1 pr-3 font-sans font-semibold">£m</td>
              {rows.map((r) => (
                <td key={r.year} className="py-1 px-2 text-right">{r.year}</td>
              ))}
            </tr>
          </thead>
          <tbody>
            {[
              { key: "buybacks", label: "Share buybacks", color: "#1E5EAA" },
              { key: "dividendsPaid", label: "Dividends", color: "#2A8C6B" },
              { key: "acquisitions", label: "Acquisitions", color: "#D47C00" },
            ].map(({ key, label, color }) => (
              <tr key={key} className="border-t border-[#F3F3F3]">
                <td className="py-1 pr-3 font-sans text-[11px] font-semibold" style={{ color }}>{label}</td>
                {rows.map((r) => {
                  const v = (r as unknown as Record<string, number>)[key];
                  return <td key={r.year} className="py-1 px-2 text-right text-[#333]">{v?.toLocaleString() ?? "—"}</td>;
                })}
              </tr>
            ))}
            <tr className="border-t-2 border-[#EBEBEB] font-semibold text-[#0B2342]">
              <td className="py-1 pr-3 font-sans text-[11px]">Total deployed</td>
              {rows.map((r) => (
                <td key={r.year} className="py-1 px-2 text-right">
                  {(r.buybacks + r.dividendsPaid + r.acquisitions).toLocaleString()}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
