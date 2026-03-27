# ProjectRELX — Task Tracker

## Goal
Financial dashboard for RELX Group plc and its 4 portfolio businesses:
Risk Solutions, STM (Scientific Technical & Medical), LexisNexis Legal, and Exhibitions.

Audience: strategic / M&A analysis. Bain-style clean design. Economist open chart style.
Model: ProjectSmile (NICE dashboard) — same stack, same patterns, adapted for RELX.

---

## Active Backlog

### Phase 1 — Scaffold ✅ COMPLETE
- [x] Directory structure, config files, app shell, lib stubs, tasks/

### Phase 2 — Data Pipeline ✅ COMPLETE
Research outcome needed before building scripts.
See tasks/lessons.md §RELX EDGAR for confirmed findings once research completes.

#### 2a — Group financials (scripts/fetch_relx_financials.py)
Goal: data/relx-financials.json — annual rows 2016–2025
ARCHITECTURE DECISION (confirmed 2026-03-25): HYBRID — XBRL for IFRS metrics + HTML scrape for Adjusted metrics

XBRL pipeline (CIK 0000929869):
- [ ] Revenue: merge `RevenueFromContractsWithCustomers` (2018-2025) + `Revenue` (2015-2017 backfill)
- [ ] Gross Profit, Reported Op Profit, PBT, Tax, Net Income: all via XBRL ✓
- [ ] EPS (basic + diluted GBP/shares): XBRL 2016-2025 ✓
- [ ] Op CF, Inv CF: XBRL ✓
- [ ] CapEx: PaymentsForDevelopmentProjectExpenditure + PurchaseOfPropertyPlantAndEquipment
- [ ] Net Debt (direct tag!), Borrowings, Cash: XBRL ✓
- [ ] Dividends Paid: XBRL ✓
- [ ] Dedup: always keep most-recently-filed value per end-date

HTML scrape (from cached 20-F HTML, "Alternative Performance Measures" section):
- [ ] Adjusted Operating Profit (2025=£3,342m — target for validation)
- [ ] Adjusted Cash Flow (2025=£3,301m)
- [ ] FCF Before Dividends (2025=£2,313m)
- [ ] Adjusted EPS (company's headline metric)
- [ ] Buybacks / share repurchase

- [ ] Output schema: AnnualRow[] as defined in lib/types.ts (GBP millions)
- [ ] Validate: 2025 revenue=£9,590m | adj op profit=£3,342m | net debt=£7,201m | EPS diluted=112p

#### 2b — Segment data (scripts/fetch_relx_segments.py)
Goal: data/relx-segments.json — SegmentRow[] for all 4 segments, all available years
RELX segment note is in 20-F (analogous to NICE Note 16 REPORTABLE SEGMENTS)
- [ ] Identify segment note number in FY2025 20-F HTML
- [ ] Build scraper: download + cache 20-F HTML, extract segment Revenue + Adj Op Profit per year
- [ ] Confirm years with data: expect FY2016–2025 (10 years)
- [ ] Validate 2025: Risk £3,485m / STM £2,714m / Legal £1,806m / Exhibitions £1,186m
- [ ] Validate 2025 adj. op profit: Risk £1,305m / STM £1,035m / Legal £415m / Exhibitions £410m

#### 2c — Capital allocation (scripts/fetch_relx_capalloc.py OR manual JSON)
Goal: data/relx-capalloc.json — dividends, buybacks, acquisitions per year
Sources: cash flow statement in 20-F + press releases
- [ ] Scrape or manually enter: 2020–2025 sufficient for first version
- [ ] Validate 2025: buybacks £1,500m | dividends £1,181m | acquisitions £260m

### Phase 3 — TypeScript types & data loaders ✅ COMPLETE
- [x] AnnualRow, SegmentRow, CapitalAllocationRow finalized — field names match JSON
- [x] lib/data.ts, lib/segmentData.ts, lib/capitalData.ts — all loading and computing derived metrics
- [x] TERM_DEFINITIONS populated

### Phase 4 — Group Overview tab (Tab 1) ✅ COMPLETE (MVP)
- [x] KPI strip: Revenue, Adj margin, FCF, ND/EBITDA, Adj EPS, DPS
- [x] FIG A1: RevenueSegmentChart — stacked bars + growth line
- [x] FIG A2: AopSegmentChart — stacked AOP + group margin line
- [ ] FIG A3: "Life of a Pound" P&L subway map — TODO (deferred to Phase 7)

### Phase 5 — Capital Allocation tab (Tab 2) ✅ COMPLETE (MVP)
- [x] FIG B1: FcfBridgeChart — adj cash flow vs FCF before dividends trend
- [x] FIG B2: CashDeploymentChart — stacked: buybacks / dividends / acquisitions
- [x] FIG B3: DebtProfileChart — net debt, gross debt, ND/EBITDA trend

### Phase 6 — Segment Comparison tab (Tab 3) ✅ COMPLETE (MVP)
- [x] FIG C1: SegmentCompareChart(revenue) — 4-line revenue trend
- [x] FIG C2: SegmentCompareChart(adjOpMargin) — 4-line margin trend
- [x] FIG C3: SegmentCompareChart(revenueGrowthYoY) — 4-line growth trend
- [x] FIG C4: Latest year snapshot table — revenue, share, AOP, margin

### Phase 6.5 — Dashboard Enhancements (from audit, 2026-03-26)
Data bugs — FIXED:
- [x] Exhibitions 2020 AOP: 2252 → -164 (was group sub-total, not segment value)
- [x] Exhibitions 2021 AOP: 162 → 10 (FY2022 value was duplicated into 2021)
- [x] Group adj op profit 2016–2020: all wrong (reported values mixed with adj, off by year)
  - 2016: added 2114 (was missing) | 2017: 1964→2284 | 2018: 2101→2346
  - 2019: 1525→2491 | 2020: 1884→2076
- [x] Adj PBT/net/cash/EPS 2017–2020: fixed to match primary source Annual Reports
- [x] Revenue 2015–2017: added (5971/6889/7341) — was missing, broke margin calc
- [x] Removed garbage EBITDA values for 2018–2019 (were storing ND/EBITDA ratios)
- [x] STM 2024 discontinuity: annotated † on all segment charts + footnote

Value-add backlog (from 2026-03-26 brainstorm):
- [x] Add cumulative capital returns chart (FIG B4 — stacked area + total line, 2020–2025)
- [x] Add cash conversion KPI card (adjCashFlow / adjOpProfit — replaces DPS in Group Overview strip)
- [x] Add scatter plot: segment adj margin vs. YoY growth (FIG C5, Tab 3)
- [x] GBP/USD toggle — toggle button in tab bar, fmtM() wired to KPI monetary values
- [x] Add underlying growth field to AnnualRow — 2018–2025 from primary Annual Reports; dashed line on FIG A1
- [x] Add ROIC KPI card — 2017–2025 from Annual Reports; 7th card in Group Overview strip
- [x] Full FCF waterfall — FIG B5: adjCashFlow → interest → tax → acq/disposal → FCF before divs → dividends → FCF after divs

### Phase 7 — Individual Segment Tabs (Tabs 4–7)
One tab per segment: Risk Solutions | STM | Legal | Exhibitions
Each tab contains:
- [x] KPI strip: Revenue, AOP, Margin, Share of Group, CAGR
- [x] Revenue trend chart (bars + growth line)
- [x] Margin trend chart (segment vs group average, with premium row)
- [x] Business brief: description, key facts, competitive moat

- [x] Tab 4: Risk Solutions (2026-03-26) — SegmentDeepDiveTab component (reusable)
- [x] Tab 5: STM (2026-03-26)
- [x] Tab 6: Legal (2026-03-26)
- [x] Tab 7: Exhibitions (2026-03-26)

### Phase 8 — Intelligence layer (optional, post-MVP)
Analogous to FCC Intelligence tab in ProjectSmile:
- [ ] Scrape MD&A passages per segment from 20-F HTML
- [ ] Claude API extraction: strategic narrative, risks, growth drivers per segment per year
- [ ] "By Year" + "Compare by Topic" modes in a dedicated Intelligence tab
Note: RELX earnings transcripts available via Seeking Alpha / Insider Monkey for qualitative layer.

### Phase 9 — Deploy
- [ ] npm run build passes clean
- [ ] Push to GitHub repo (create: relx-dashboard)
- [ ] Connect Vercel — Output Directory = out, same as ProjectSmile
- [ ] Auto-deploy on push to main

---

## Completed
- [x] Phase 1 scaffold (2026-03-24)
- [x] Phase 2 data pipeline (2026-03-24): relx-financials.json, relx-segments.json, relx-capalloc.json
- [x] Phase 3 TypeScript loaders (2026-03-24)
- [x] Phases 4–6 dashboard MVP (2026-03-24): 3 tabs, 8 charts, KPI strip, data tables
- [x] Phase 6.5 data audit & fixes (2026-03-26): 3 data bugs fixed, 2016–2020 adj metrics corrected from primary sources, STM restatement annotated

---

## Known Constraints
- RELX is GBP-native. All data stored in £m. USD display at 1.25 (Jan 1 2025 rate).
- RELX files 20-F as Foreign Private Issuer → IFRS not US GAAP → different XBRL tags
- Segment data likely requires HTML scraping (confirmed pattern from NICE experience)
- "Print & Related" is a 5th revenue line in 2025 (£399m) but not a reported segment —
  it is residual from legacy STM print business. Include in STM or as "Other" TBD.
- Fiscal year = calendar year (Dec 31)
