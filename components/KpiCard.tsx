"use client";

interface KpiCardProps {
  label: string;
  value: string;
  sub?: string;
  delta?: string;
  deltaPositive?: boolean;
  accent?: string;
}

export function KpiCard({ label, value, sub, delta, deltaPositive, accent = "#1E5EAA" }: KpiCardProps) {
  return (
    <div className="border-l-2 pl-4 py-1" style={{ borderColor: accent }}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#888]">{label}</p>
      <p className="text-2xl font-light text-[#0B2342] mt-0.5 leading-none">{value}</p>
      {sub && <p className="text-[11px] text-[#6B7280] mt-0.5">{sub}</p>}
      {delta && (
        <p className={`text-[11px] font-semibold mt-0.5 ${deltaPositive ? "text-emerald-600" : "text-red-600"}`}>
          {delta}
        </p>
      )}
    </div>
  );
}
