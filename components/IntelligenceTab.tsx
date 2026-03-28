"use client";

import { useState, useMemo } from "react";
import corpusRaw from "@/data/relx-intel-corpus.json";

interface Chunk {
  id: string;
  source_file: string;
  source_type: string;
  period: string;
  date: string;
  chunk_type: "management_remark" | "qa_exchange" | "mda_narrative";
  speaker: string | null;
  analyst: string | null;
  analyst_firm: string | null;
  question_text: string | null;
  response_text: string | null;
  text: string;
  lnrs_relevance: "direct" | "indirect";
  topics: string[];
  quant_mentions: string[];
  sentiment: string;
  forward_looking: boolean;
  segment_focus?: string;
}

const corpus = corpusRaw as { chunks: Chunk[]; total_chunks: number; cost_summary: string };

// Canonical period order for sorting
const PERIOD_ORDER = [
  "FY2019","H12019","FY2020","H12020","FY2021","H12021",
  "FY2022","H12022","FY2023","H12023","FY2024","H12024","FY2025","H12025",
  "2018","2021","2022","2023","2024",
];
const periodRank = (p: string) => { const i = PERIOD_ORDER.indexOf(p); return i === -1 ? 99 : i; };

const SOURCE_LABELS: Record<string, string> = {
  earnings_call: "Earnings Call",
  investor_day: "Investor Day",
  investor_day_slides: "Investor Day Slides",
  mda_narrative: "Annual Report (MD&A)",
  presentation: "Presentation",
  unknown: "Other",
};

const SENTIMENT_COLOR: Record<string, string> = {
  positive: "text-emerald-700 bg-emerald-50",
  neutral: "text-gray-600 bg-gray-100",
  cautious: "text-amber-700 bg-amber-50",
  negative: "text-red-700 bg-red-50",
};

type View = "qa" | "narrative" | "search";

export function IntelligenceTab() {
  const [view, setView] = useState<View>("qa");
  const [filterPeriod, setFilterPeriod] = useState("all");
  const [filterTopic, setFilterTopic] = useState("all");
  const [filterSource, setFilterSource] = useState("all");
  const [filterRelevance, setFilterRelevance] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const allChunks: Chunk[] = corpus.chunks;

  // Derived filter options
  const allPeriods = useMemo(() => {
    const ps = [...new Set(allChunks.map((c) => c.period).filter(Boolean))];
    return ps.sort((a, b) => periodRank(a) - periodRank(b));
  }, []);

  const allTopics = useMemo(() => {
    const ts = [...new Set(allChunks.flatMap((c) => c.topics || []))];
    return ts.sort();
  }, []);

  const allSources = useMemo(() => {
    return [...new Set(allChunks.map((c) => c.source_type).filter(Boolean))];
  }, []);

  // Filtered chunks
  const filtered = useMemo(() => {
    return allChunks.filter((c) => {
      if (filterPeriod !== "all" && c.period !== filterPeriod) return false;
      if (filterTopic !== "all" && !(c.topics || []).includes(filterTopic)) return false;
      if (filterSource !== "all" && c.source_type !== filterSource) return false;
      if (filterRelevance !== "all" && c.lnrs_relevance !== filterRelevance) return false;
      if (view === "qa" && c.chunk_type !== "qa_exchange") return false;
      if (view === "narrative" && c.chunk_type === "qa_exchange") return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const haystack = [c.text, c.question_text, c.speaker, c.analyst, ...(c.topics || [])].join(" ").toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [allChunks, filterPeriod, filterTopic, filterSource, filterRelevance, view, searchQuery]);

  // Sort by period
  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => periodRank(a.period) - periodRank(b.period));
  }, [filtered]);

  const toggle = (id: string) => setExpandedId((prev) => (prev === id ? null : id));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-[#EBEBEB] pb-4">
        <h2 className="text-lg font-semibold text-[#1A1A1A]">LNRS Intelligence Corpus</h2>
        <p className="text-sm text-[#888] mt-1">
          {corpus.total_chunks} extracts · earnings calls, investor days &amp; annual reports · 2018–2025
        </p>
      </div>

      {/* View toggle */}
      <div className="flex gap-1 p-1 bg-[#F5F5F5] rounded w-fit">
        {(["qa", "narrative", "search"] as View[]).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`px-4 py-1.5 text-sm rounded transition-colors ${
              view === v ? "bg-white shadow-sm font-medium text-[#1A1A1A]" : "text-[#888] hover:text-[#1A1A1A]"
            }`}
          >
            {v === "qa" ? "Q&A Catalogue" : v === "narrative" ? "Management Narrative" : "Search"}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <select
          value={filterPeriod}
          onChange={(e) => setFilterPeriod(e.target.value)}
          className="text-sm border border-[#EBEBEB] rounded px-3 py-1.5 bg-white text-[#1A1A1A]"
        >
          <option value="all">All Periods</option>
          {allPeriods.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>

        <select
          value={filterTopic}
          onChange={(e) => setFilterTopic(e.target.value)}
          className="text-sm border border-[#EBEBEB] rounded px-3 py-1.5 bg-white text-[#1A1A1A]"
        >
          <option value="all">All Topics</option>
          {allTopics.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>

        <select
          value={filterSource}
          onChange={(e) => setFilterSource(e.target.value)}
          className="text-sm border border-[#EBEBEB] rounded px-3 py-1.5 bg-white text-[#1A1A1A]"
        >
          <option value="all">All Sources</option>
          {allSources.map((s) => <option key={s} value={s}>{SOURCE_LABELS[s] ?? s}</option>)}
        </select>

        <select
          value={filterRelevance}
          onChange={(e) => setFilterRelevance(e.target.value)}
          className="text-sm border border-[#EBEBEB] rounded px-3 py-1.5 bg-white text-[#1A1A1A]"
        >
          <option value="all">Direct + Indirect</option>
          <option value="direct">Direct only</option>
          <option value="indirect">Indirect only</option>
        </select>

        {view === "search" && (
          <input
            type="text"
            placeholder="Search text, speaker, topic..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="text-sm border border-[#EBEBEB] rounded px-3 py-1.5 bg-white text-[#1A1A1A] w-72"
          />
        )}

        <span className="text-sm text-[#AAA] ml-auto">{sorted.length} results</span>
      </div>

      {/* Results */}
      <div className="space-y-3">
        {sorted.length === 0 && (
          <p className="text-sm text-[#AAA] py-8 text-center">No results match the current filters.</p>
        )}

        {sorted.map((chunk) => (
          <ChunkCard
            key={chunk.id}
            chunk={chunk}
            expanded={expandedId === chunk.id}
            onToggle={() => toggle(chunk.id)}
          />
        ))}
      </div>
    </div>
  );
}

function ChunkCard({ chunk, expanded, onToggle }: { chunk: Chunk; expanded: boolean; onToggle: () => void }) {
  const isQA = chunk.chunk_type === "qa_exchange";
  const sentiment = chunk.sentiment ?? "neutral";

  return (
    <div
      className="border border-[#EBEBEB] rounded bg-white hover:border-[#CCC] transition-colors cursor-pointer"
      onClick={onToggle}
    >
      {/* Card header */}
      <div className="flex items-start justify-between gap-4 px-4 py-3">
        <div className="flex-1 min-w-0">
          {/* Meta row */}
          <div className="flex flex-wrap gap-2 items-center mb-1.5">
            <span className="text-xs font-mono text-[#888]">{chunk.period}</span>
            <span className="text-xs text-[#AAA]">·</span>
            <span className="text-xs text-[#888]">{SOURCE_LABELS[chunk.source_type] ?? chunk.source_type}</span>
            {isQA && chunk.analyst && (
              <>
                <span className="text-xs text-[#AAA]">·</span>
                <span className="text-xs text-[#555]">
                  Q: <span className="font-medium">{chunk.analyst}</span>
                  {chunk.analyst_firm ? ` (${chunk.analyst_firm})` : ""}
                </span>
              </>
            )}
            {!isQA && chunk.speaker && (
              <>
                <span className="text-xs text-[#AAA]">·</span>
                <span className="text-xs text-[#555] font-medium">{chunk.speaker}</span>
              </>
            )}
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded font-mono uppercase ${SENTIMENT_COLOR[sentiment] ?? SENTIMENT_COLOR.neutral}`}
            >
              {sentiment}
            </span>
            {chunk.forward_looking && (
              <span className="text-[10px] px-1.5 py-0.5 rounded font-mono bg-blue-50 text-blue-600">fwd</span>
            )}
            {chunk.lnrs_relevance === "direct" && (
              <span className="text-[10px] px-1.5 py-0.5 rounded font-mono bg-[#F5F5F5] text-[#888]">direct</span>
            )}
          </div>

          {/* Preview text */}
          <p className="text-sm text-[#333] line-clamp-2">
            {isQA && chunk.question_text ? (
              <><span className="text-[#AAA]">Q: </span>{chunk.question_text}</>
            ) : (
              chunk.text
            )}
          </p>
        </div>

        {/* Topic pills */}
        <div className="flex flex-wrap gap-1 max-w-[200px] justify-end shrink-0">
          {(chunk.topics || []).slice(0, 4).map((t) => (
            <span key={t} className="text-[10px] px-2 py-0.5 bg-[#F5F5F5] text-[#666] rounded">
              {t}
            </span>
          ))}
        </div>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-[#EBEBEB] px-4 py-4 space-y-4 bg-[#FAFAFA]" onClick={(e) => e.stopPropagation()}>
          {isQA ? (
            <>
              {chunk.question_text && (
                <div>
                  <p className="text-xs font-semibold text-[#888] uppercase tracking-wide mb-1.5">
                    Question — {chunk.analyst}{chunk.analyst_firm ? `, ${chunk.analyst_firm}` : ""}
                  </p>
                  <p className="text-sm text-[#333] leading-relaxed">{chunk.question_text}</p>
                </div>
              )}
              {chunk.response_text && (
                <div>
                  <p className="text-xs font-semibold text-[#888] uppercase tracking-wide mb-1.5">
                    Response — {chunk.speaker ?? "Management"}
                  </p>
                  <p className="text-sm text-[#333] leading-relaxed">{chunk.response_text}</p>
                </div>
              )}
            </>
          ) : (
            <div>
              <p className="text-xs font-semibold text-[#888] uppercase tracking-wide mb-1.5">
                {chunk.speaker ?? "Management"} · {chunk.source_type === "mda_narrative" ? "Annual Report" : "Prepared Remarks"}
              </p>
              <p className="text-sm text-[#333] leading-relaxed">{chunk.text}</p>
            </div>
          )}

          {/* Quant mentions */}
          {(chunk.quant_mentions || []).length > 0 && (
            <div>
              <p className="text-xs font-semibold text-[#888] uppercase tracking-wide mb-1.5">Quantitative mentions</p>
              <div className="flex flex-wrap gap-1.5">
                {chunk.quant_mentions.map((q, i) => (
                  <span key={i} className="text-xs font-mono px-2 py-0.5 bg-white border border-[#EBEBEB] rounded text-[#555]">
                    {q}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* All topics */}
          {(chunk.topics || []).length > 0 && (
            <div className="flex flex-wrap gap-1">
              {chunk.topics.map((t) => (
                <span key={t} className="text-[10px] px-2 py-0.5 bg-[#F0F0F0] text-[#555] rounded">{t}</span>
              ))}
            </div>
          )}

          <p className="text-[10px] font-mono text-[#CCC]">{chunk.id} · {chunk.source_file}</p>
        </div>
      )}
    </div>
  );
}
