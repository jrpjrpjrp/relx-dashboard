"use client";

import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import type { AnnualRow, SegmentRow, SegmentName } from "@/lib/types";
import { KpiCard } from "./KpiCard";
import { SEG_COLORS } from "./charts/RevenueSegmentChart";

// ─── Static segment content ───────────────────────────────────────────────────

interface SegmentContent {
  fullName: string;
  tagline: string;
  description: string;
  keyFacts: { label: string; value: string }[];
  moat: string;
  revenueHeadline: (cagr: string) => string;
  marginHeadline: string;
}

const SEGMENT_CONTENT: Record<string, SegmentContent> = {
  Risk: {
    fullName: "Risk Solutions",
    tagline: "LexisNexis Risk Solutions · Global leader in data-driven risk decisioning",
    description:
      "Risk Solutions provides information-based analytics and decision tools to businesses, government agencies, and consumers evaluating and managing risk. " +
      "The segment operates across four verticals: Business Services (fraud detection, identity verification, KYC/AML compliance, financial crime); " +
      "Insurance (contributory databases including CLUE auto claims and MVR driving records, risk scoring, underwriting analytics); " +
      "Government (public records, law enforcement analytics, background screening); and " +
      "Specialised Industry Data Services (Cirium aviation analytics, derivatives and commodity data).",
    keyFacts: [
      { label: "Primary geography", value: "~80% North America" },
      { label: "Revenue model", value: "Subscription + transactional" },
      { label: "Key brands", value: "LexisNexis Risk, Cirium, ThreatMetrix, Emailage" },
      { label: "Competitive position", value: "Verticals #1 in fraud/identity, insurance data" },
    ],
    moat:
      "The core structural advantage is the contributory database flywheel: insurance carriers and financial institutions share proprietary claims " +
      "and transaction data in exchange for access to the pooled dataset. This creates a network that grows more accurate with every participant " +
      "and is structurally impossible for a new entrant to replicate from scratch. This is reinforced by deep API-level integration into " +
      "customer underwriting, compliance, and fraud-decisioning workflows — making replacement costly and disruptive. " +
      "Risk has outgrown every other RELX segment in every year since 2018, driven by pricing power, share gains in fraud/identity, " +
      "and expansion into financial crime compliance via the ThreatMetrix and Emailage acquisitions.",
    revenueHeadline: (cagr) =>
      `Revenue compounds at ${cagr} CAGR (2018–2025) in GBP — outperforming every other segment`,
    marginHeadline:
      "Risk margin is remarkably stable at ~37% — the narrowing premium over the group reflects the group average rising toward Risk, not Risk softening",
  },
  STM: {
    fullName: "Scientific, Technical & Medical",
    tagline: "Elsevier · Global #1 in research information and analytics",
    description:
      "STM provides information and analytics to research institutions, academic and corporate libraries, scientists, and healthcare professionals. " +
      "Key products include ScienceDirect (the world's largest full-text scientific database), Scopus (abstract and citation database), " +
      "ClinicalKey (clinical decision support), and a growing portfolio of workflow tools for research, peer review, and grant management. " +
      "From FY2024, the Print & Related business (legacy journal subscriptions and print products) was carved out as a separate reporting line.",
    keyFacts: [
      { label: "Primary geography", value: "Global — Europe & North America largest" },
      { label: "Revenue model", value: "~90% institutional subscriptions (multi-year)" },
      { label: "Key brands", value: "Elsevier, ScienceDirect, Scopus, ClinicalKey, Mendeley" },
      { label: "Competitive position", value: "Global #1 in STM journal publishing and research analytics" },
    ],
    moat:
      "STM's moat rests on the largest archive of peer-reviewed scientific content in the world and deeply embedded researcher workflows. " +
      "Institutions sign multi-year 'big deal' subscription agreements covering thousands of journals — high switching costs and strong renewal rates. " +
      "The growing analytics layer (Scopus citations, SciVal benchmarking, Pure research management) layers proprietary institutional data on top of content, " +
      "shifting value from content access to workflow intelligence. Open-access headwinds are a structural risk, partially offset by article processing charges " +
      "and the move to transformative agreements.",
    revenueHeadline: (cagr) =>
      `Revenue compounds at ${cagr} CAGR (2018–2025) in GBP — note FY2024 break from segment restatement`,
    marginHeadline:
      "Margin consistently above 37% — highest in the group — reflecting high subscription mix and digital operating leverage",
  },
  Legal: {
    fullName: "Legal",
    tagline: "LexisNexis Legal & Professional · US #2, International #1 or #2",
    description:
      "Legal provides legal, regulatory, and business information and analytics to law firms, corporate legal departments, government bodies, and individual practitioners. " +
      "Core products include Lexis+ (US legal research platform), LexisNexis+ UK, Pacific (Asia-Pacific), and a growing suite of " +
      "practice management tools and legal analytics. The segment has been undergoing a multi-year digital transformation " +
      "from print and CD-ROM to cloud-native, AI-augmented research tools.",
    keyFacts: [
      { label: "Primary geography", value: "US ~55%, International ~45%" },
      { label: "Revenue model", value: "Subscription-led, transitioning to platform" },
      { label: "Key brands", value: "LexisNexis, Lexis+, LexisNexis+ UK, Pacific, Lex Machina" },
      { label: "Competitive position", value: "US #2 (vs Thomson Reuters Westlaw); International #1 or #2" },
    ],
    moat:
      "Legal's competitive position rests on breadth of primary legal content (case law, statutes, regulations) built up over decades, " +
      "combined with practitioner familiarity and multi-year institutional subscriptions. " +
      "The strategic risk is Thomson Reuters Westlaw's dominant US position and aggressive AI investment (Thomson Reuters acquired Casetext in 2023). " +
      "RELX is responding with Lexis+ AI and continued workflow integrations, but Legal's margin (23%) reflects the heavier investment needed to close the gap. " +
      "International (UK, ANZ, Asia) is structurally stronger — LexisNexis is #1 or #2 in most markets outside the US.",
    revenueHeadline: (cagr) =>
      `Revenue grows at ${cagr} CAGR (2018–2025) — lowest in the group, reflecting competitive pressure and digital transition costs`,
    marginHeadline:
      "Margin at 23% lags Risk and STM by 14pp — investment-heavy transformation phase and US competitive dynamics",
  },
  Exhibitions: {
    fullName: "Exhibitions (RX)",
    tagline: "RX · Global #2 trade events organiser",
    description:
      "Exhibitions (rebranded RX in 2021) organises over 400 trade shows and events annually across 22 countries, " +
      "serving industries including jewellery (JCK), food and hospitality, health and wellness, beauty, technology, and construction. " +
      "The segment was severely impacted by COVID-19 in 2020–2021, recovering to pre-pandemic revenue levels by 2024. " +
      "RX is building a hybrid model combining face-to-face events with digital year-round engagement tools (matchmaking, lead generation, virtual content). " +
      "Unlike the other three segments, Exhibitions revenue is inherently transactional and subject to event cycling effects.",
    keyFacts: [
      { label: "Primary geography", value: "Global — US, Europe, Asia-Pacific" },
      { label: "Revenue model", value: "Transactional (exhibitor fees, visitor tickets)" },
      { label: "Key brands", value: "RX, JCK, Reed Exhibitions" },
      { label: "Competitive position", value: "Global #2 (vs Informa/Clarion Events, Reed Midem)" },
    ],
    moat:
      "Exhibitions moats are thinner than the other three segments — they are primarily long-standing brand equity within specific verticals (JCK is the world's largest jewellery show), " +
      "buyer-seller network density (once an industry converges on a single annual event, switching is costly for both sides), " +
      "and know-how in event logistics and marketing. " +
      "The structural risk is that digital matching platforms (LinkedIn, industry-specific B2B marketplaces) can disintermediate the discovery and transaction functions " +
      "that trade shows historically served. RX's digital-first strategy is an attempt to capture share of that shift. " +
      "The margin recovery from -45% (2020) to 35% (2025) reflects operating leverage as events resumed — " +
      "fixed costs are high, so even modest revenue growth from the 2020 trough produces disproportionate profit recovery.",
    revenueHeadline: (cagr) =>
      `Revenue recovers to pre-COVID levels by 2024 after the 2020 collapse — reported CAGR (${cagr}) masks the disruption`,
    marginHeadline:
      "Margin recovered from -45% (2020 COVID loss) to 35% by 2025 — operating leverage as events restarted",
  },
};

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  segmentName: SegmentName;
  segmentRows: SegmentRow[];
  annualRows: AnnualRow[];
  figPrefix: string; // e.g. "D" for Risk, "E" for STM
}

function cagrPct(start: number, end: number, years: number): string {
  return `${(((end / start) ** (1 / years)) - 1) * 100 >= 0 ? "+" : ""}${((((end / start) ** (1 / years)) - 1) * 100).toFixed(1)}%`;
}

export function SegmentDeepDiveTab({ segmentName, segmentRows, annualRows, figPrefix }: Props) {
  const content = SEGMENT_CONTENT[segmentName];
  const color = SEG_COLORS[segmentName];

  // Segment rows sorted ascending
  const rows = segmentRows
    .filter((r) => r.segment === segmentName)
    .sort((a, b) => a.year - b.year);

  const latest = rows[rows.length - 1];
  const prev = rows[rows.length - 2];

  // Group rows for margin comparison
  const annualMap = new Map(annualRows.map((r) => [r.year, r]));

  // Group total revenue for share calculation
  const latestGroup = annualMap.get(latest?.year);
  const groupShare = latestGroup?.revenue ? (latest.revenue / latestGroup.revenue) * 100 : null;

  // CAGR 2018–latest
  const base2018 = rows.find((r) => r.year === 2018);
  const cagr = base2018
    ? cagrPct(base2018.revenue, latest.revenue, latest.year - 2018)
    : null;

  // Chart data for revenue + growth
  const revChartData = rows.map((r) => ({
    year: r.year,
    revenue: r.revenue,
    growth: r.revenueGrowthYoY,
  }));

  // Chart data for margin vs group
  const marginChartData = rows.map((r) => {
    const grp = annualMap.get(r.year);
    return {
      year: r.year,
      segMargin: r.adjOpMargin,
      groupMargin: grp?.adjOperatingMargin,
    };
  });

  if (!content || !latest) return null;

  return (
    <div>
      {/* ── Business brief ───────────────────────────────────────────────────── */}
      <div className="mb-10 border-l-4 pl-5 py-1" style={{ borderColor: color }}>
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#888] mb-1">
          {content.tagline}
        </p>
        <p className="text-sm text-[#2D3748] leading-relaxed mb-4">
          {content.description}
        </p>

        {/* Key facts row */}
        <div className="flex flex-wrap gap-x-8 gap-y-1 mb-4">
          {content.keyFacts.map((f) => (
            <div key={f.label}>
              <span className="text-[10px] font-semibold uppercase tracking-wide text-[#AAA]">{f.label} </span>
              <span className="text-[11px] text-[#2D3748]">{f.value}</span>
            </div>
          ))}
        </div>

        {/* Competitive moat */}
        <div className="bg-[#F8F9FB] rounded px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#888] mb-1">Competitive moat</p>
          <p className="text-[11px] text-[#4A5568] leading-relaxed">{content.moat}</p>
        </div>
      </div>

      {/* ── KPI strip ────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-6 mb-10">
        <KpiCard
          label="Revenue"
          value={`£${(latest.revenue / 1000).toFixed(2)}bn`}
          sub={`FY${latest.year}`}
          delta={prev ? `${latest.revenueGrowthYoY != null && latest.revenueGrowthYoY >= 0 ? "+" : ""}${latest.revenueGrowthYoY?.toFixed(1)}% YoY` : undefined}
          deltaPositive={latest.revenueGrowthYoY != null && latest.revenueGrowthYoY >= 0}
          accent={color}
        />
        <KpiCard
          label="Adj. op profit"
          value={`£${(latest.adjOpProfit / 1000).toFixed(2)}bn`}
          sub={`FY${latest.year}`}
          delta={prev ? `${latest.adjOpProfit >= prev.adjOpProfit ? "+" : ""}${((latest.adjOpProfit - prev.adjOpProfit) / prev.adjOpProfit * 100).toFixed(1)}% YoY` : undefined}
          deltaPositive={prev ? latest.adjOpProfit >= prev.adjOpProfit : undefined}
          accent={color}
        />
        <KpiCard
          label="Adj. margin"
          value={`${latest.adjOpMargin.toFixed(1)}%`}
          sub={prev ? `${(latest.adjOpMargin - prev.adjOpMargin).toFixed(1)}pp vs prior year` : undefined}
          delta={undefined}
          accent={color}
        />
        <KpiCard
          label="Share of group"
          value={groupShare != null ? `${groupShare.toFixed(1)}%` : "—"}
          sub={`of group revenue FY${latest.year}`}
          accent={color}
        />
        <KpiCard
          label={`CAGR ${2018}–${latest.year}`}
          value={cagr ?? "—"}
          sub="Revenue, reported GBP"
          accent={color}
        />
      </div>

      {/* ── FIG 1: Revenue trend ─────────────────────────────────────────────── */}
      <div className="mb-12">
        <div className="flex items-center gap-2 mb-6">
          <span className="text-[10px] font-mono text-[#AAA]">FIG {figPrefix}1</span>
          <div className="flex-1 h-px bg-[#EBEBEB]" />
        </div>
        <div className="mb-4">
          <p className="text-sm font-bold text-[#0B2342] leading-snug">
            {cagr ? content.revenueHeadline(cagr) : content.revenueHeadline("—")}
          </p>
          <p className="text-[11px] text-[#888] italic mt-0.5">
            Revenue (£m) · bars = annual · line = YoY growth %
          </p>
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={revChartData} margin={{ top: 8, right: 48, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="#EBEBEB" />
            <XAxis dataKey="year" axisLine={false} tickLine={false} tick={{ fontSize: 13 }} />
            <YAxis
              yAxisId="left"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 13 }}
              tickFormatter={(v) => `£${(v / 1000).toFixed(1)}bn`}
              width={56}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 13, fill: "#888" }}
              tickFormatter={(v) => `${v.toFixed(0)}%`}
              domain={[-30, 40]}
            />
            <Tooltip
              formatter={(value, name) => {
                const v = value as number;
                return name === "growth"
                  ? [`${v?.toFixed(1)}%`, "YoY growth"]
                  : [`£${v?.toLocaleString()}m`, "Revenue"];
              }}
              contentStyle={{ fontSize: 12, border: "1px solid #EBEBEB" }}
            />
            <Legend wrapperStyle={{ fontSize: 13, paddingTop: 8 }}
              formatter={(v) => v === "growth" ? "YoY growth %" : "Revenue £m"}
            />
            <Bar yAxisId="left" dataKey="revenue" name="revenue" fill={color} radius={[2, 2, 0, 0]} />
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
          </ComposedChart>
        </ResponsiveContainer>

        {/* Data table */}
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-xs font-mono border-t border-[#EBEBEB]">
            <thead>
              <tr className="text-[#888] text-[10px] uppercase tracking-wide">
                <td className="py-1 pr-3 font-sans font-semibold">Year</td>
                {rows.slice(-8).map((r) => <td key={r.year} className="py-1 px-2 text-right">{r.year}</td>)}
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-[#F3F3F3]">
                <td className="py-1 pr-3 font-sans text-[11px] font-semibold" style={{ color }}>Revenue £m</td>
                {rows.slice(-8).map((r) => <td key={r.year} className="py-1 px-2 text-right">{r.revenue.toLocaleString()}</td>)}
              </tr>
              <tr className="border-t border-[#F3F3F3] text-[#6B7280]">
                <td className="py-1 pr-3 font-sans text-[11px]">Growth %</td>
                {rows.slice(-8).map((r) => (
                  <td key={r.year} className="py-1 px-2 text-right">
                    {r.revenueGrowthYoY != null ? `${r.revenueGrowthYoY >= 0 ? "+" : ""}${r.revenueGrowthYoY.toFixed(1)}%` : "—"}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ── FIG 2: Margin profile ─────────────────────────────────────────────── */}
      <div className="mb-12">
        <div className="flex items-center gap-2 mb-6">
          <span className="text-[10px] font-mono text-[#AAA]">FIG {figPrefix}2</span>
          <div className="flex-1 h-px bg-[#EBEBEB]" />
        </div>
        <div className="mb-4">
          <p className="text-sm font-bold text-[#0B2342] leading-snug">
            {content.marginHeadline}
          </p>
          <p className="text-[11px] text-[#888] italic mt-0.5">
            Adj. op margin (%) · solid = segment · dashed = group average
          </p>
        </div>
        <ResponsiveContainer width="100%" height={260}>
          <ComposedChart data={marginChartData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="#EBEBEB" />
            <XAxis dataKey="year" axisLine={false} tickLine={false} tick={{ fontSize: 13 }} />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 13 }}
              tickFormatter={(v) => `${v}%`}
              domain={[20, 45]}
              width={44}
            />
            <Tooltip
              formatter={(value, name) => {
                const v = value as number;
                return [`${v?.toFixed(1)}%`, name === "segMargin" ? `${segmentName} margin` : "Group margin"];
              }}
              contentStyle={{ fontSize: 12, border: "1px solid #EBEBEB" }}
            />
            <Legend
              wrapperStyle={{ fontSize: 13, paddingTop: 8 }}
              formatter={(v) => v === "segMargin" ? `${segmentName} adj. margin` : "Group adj. margin"}
            />
            <Line
              type="monotone"
              dataKey="segMargin"
              name="segMargin"
              stroke={color}
              strokeWidth={2.5}
              dot={{ r: 3, fill: color }}
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="groupMargin"
              name="groupMargin"
              stroke="#0B2342"
              strokeWidth={1.5}
              strokeDasharray="4 3"
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
                <td className="py-1 pr-3 font-sans font-semibold">Year</td>
                {rows.slice(-8).map((r) => <td key={r.year} className="py-1 px-2 text-right">{r.year}</td>)}
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-[#F3F3F3]">
                <td className="py-1 pr-3 font-sans text-[11px] font-semibold" style={{ color }}>{segmentName} margin</td>
                {rows.slice(-8).map((r) => <td key={r.year} className="py-1 px-2 text-right">{r.adjOpMargin.toFixed(1)}%</td>)}
              </tr>
              <tr className="border-t border-[#F3F3F3] text-[#6B7280]">
                <td className="py-1 pr-3 font-sans text-[11px]">Group margin</td>
                {rows.slice(-8).map((r) => {
                  const grp = annualMap.get(r.year);
                  return (
                    <td key={r.year} className="py-1 px-2 text-right">
                      {grp?.adjOperatingMargin != null ? `${grp.adjOperatingMargin.toFixed(1)}%` : "—"}
                    </td>
                  );
                })}
              </tr>
              <tr className="border-t border-[#F3F3F3] font-semibold" style={{ color }}>
                <td className="py-1 pr-3 font-sans text-[11px]">Premium (pp)</td>
                {rows.slice(-8).map((r) => {
                  const grp = annualMap.get(r.year);
                  const premium = grp?.adjOperatingMargin != null ? r.adjOpMargin - grp.adjOperatingMargin : null;
                  return (
                    <td key={r.year} className="py-1 px-2 text-right">
                      {premium != null ? `+${premium.toFixed(1)}` : "—"}
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
