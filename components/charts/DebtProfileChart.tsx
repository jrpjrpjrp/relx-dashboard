"use client";

import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import type { AnnualRow } from "@/lib/types";

interface Props {
  rows: AnnualRow[];
}

export function DebtProfileChart({ rows }: Props) {
  const data = rows
    .filter((r) => r.netDebt != null)
    .map((r) => ({
      year: r.year,
      netDebt: r.netDebt,
      grossDebt: r.borrowings,
      ndEbitda: r.netDebtToEbitda,
    }));

  return (
    <div className="w-full">
      <div className="mb-4">
        <p className="text-sm font-bold text-[#0B2342] leading-snug">
          Net debt stable at 2.0× EBITDA — within A-rated comfort zone despite active buyback programme
        </p>
        <p className="text-[11px] text-[#888] italic mt-0.5">
          Bars = net debt & gross debt (£m) · Line = net debt / EBITDA (×)
        </p>
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart data={data} margin={{ top: 8, right: 48, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="#EBEBEB" />
          <XAxis dataKey="year" axisLine={false} tickLine={false} tick={{ fontSize: 13 }} />
          <YAxis
            yAxisId="left"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 13 }}
            tickFormatter={(v) => `£${v / 1000}k`}
            width={52}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 13, fill: "#C84040" }}
            tickFormatter={(v) => `${v.toFixed(1)}×`}
            domain={[0, 5]}
          />
          <Tooltip
            formatter={(value, name) => {
              const v = value as number;
              const n = String(name ?? "");
              if (n === "ndEbitda") return [`${v?.toFixed(2)}×`, "ND/EBITDA"];
              return [`£${v?.toLocaleString()}m`, n === "netDebt" ? "Net debt" : "Gross debt"];
            }}
            contentStyle={{ fontSize: 12, border: "1px solid #EBEBEB" }}
          />
          <Legend
            wrapperStyle={{ fontSize: 13, paddingTop: 8 }}
            formatter={(v) => v === "netDebt" ? "Net debt" : v === "grossDebt" ? "Gross debt" : "ND/EBITDA ×"}
          />
          <Bar yAxisId="left" dataKey="grossDebt" name="grossDebt" fill="#1E5EAA" opacity={0.3} />
          <Bar yAxisId="left" dataKey="netDebt" name="netDebt" fill="#1E5EAA" />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="ndEbitda"
            name="ndEbitda"
            stroke="#C84040"
            strokeWidth={2}
            dot={{ r: 3, fill: "#C84040" }}
            connectNulls
          />
        </ComposedChart>
      </ResponsiveContainer>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-xs font-mono border-t border-[#EBEBEB]">
          <thead>
            <tr className="text-[#888] text-[10px] uppercase tracking-wide">
              <td className="py-1 pr-3 font-sans font-semibold">Balance sheet</td>
              {data.slice(-8).map((r) => <td key={r.year} className="py-1 px-2 text-right">{r.year}</td>)}
            </tr>
          </thead>
          <tbody>
            {[
              { key: "grossDebt", label: "Gross debt (£m)", color: "#6B7280" },
              { key: "netDebt", label: "Net debt (£m)", color: "#1E5EAA" },
              { key: "ndEbitda", label: "ND/EBITDA (×)", color: "#C84040", fmt: (v: number) => v?.toFixed(2) + "×" },
            ].map(({ key, label, color, fmt }) => (
              <tr key={key} className="border-t border-[#F3F3F3]">
                <td className="py-1 pr-3 font-sans text-[11px] font-semibold" style={{ color }}>{label}</td>
                {data.slice(-8).map((r) => {
                  const v = (r as unknown as Record<string, number>)[key];
                  return (
                    <td key={r.year} className="py-1 px-2 text-right text-[#333]">
                      {v != null ? (fmt ? fmt(v) : v.toLocaleString()) : "—"}
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
