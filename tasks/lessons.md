# ProjectRELX — Lessons Learned

Pre-populated from ProjectSmile (NICE dashboard). RELX-specific findings added as discovered.

---

## EDGAR — RELX Confirmed Findings (researched 2026-03-25)

### Identity
- **RELX PLC**: CIK `0000929869` (SIC 7389 — Services)
- **RELX NV**: CIK `0000929872` — old Dutch entity, last 20-F was FY2017. IGNORE.
- EDGAR XBRL API: `https://data.sec.gov/api/xbrl/companyfacts/CIK0000929869.json`
- Always set User-Agent: `'ProjectRELX research@example.com'`

### 20-F Filing History (CIK 0000929869)
```
FY2025: 0001104659-26-017277  doc=relx-20251231x20f.htm  (filed 2026-02-19)
FY2024: 0001558370-25-001178  doc=relx-20241231x20f.htm  (filed 2025-02-20)
FY2023: 0001558370-24-001468  doc=relx-20231231x20f.htm  (filed 2024-02-22)
FY2022: 0001558370-23-001846  doc=relx-20221231x20f.htm  (filed 2023-02-23)
FY2021: 0001193125-22-045453  doc=d171509d20f.htm         (filed 2022-02-17)
FY2020: 0001193125-21-047466  doc=d848056d20f.htm         (filed 2021-02-18)
FY2019: 0001193125-20-042817  doc=d813464d20f.htm         (filed 2020-02-20)
FY2018: 0001193125-19-055997  doc=d687928d20f.htm         (filed 2019-02-28)
```
HTML URL pattern: `https://www.sec.gov/Archives/edgar/data/929869/{ACCN_NO_DASHES}/{DOC_FILENAME}`

### XBRL Coverage — CONFIRMED WORKING

**Revenue — two-tag strategy required:**
- `ifrs-full:RevenueFromContractsWithCustomers` — use for 2018–2025 (primary)
  - 2025=£9.590B ✓ | 2024=£9.434B | 2023=£9.161B | 2022=£8.553B
  - These entries were retroactively added by most recent filings — all confirmed
- `ifrs-full:Revenue` — use for 2015–2017 backfill only
  - 2015=£5.971B | 2016=£6.889B | 2017=£7.341B

**Full group P&L + cash flow tags with year coverage:**
```
ifrs-full:GrossProfit                           2025=£6.357B  ← directly available
ifrs-full:ProfitLossFromOperatingActivities     2025=£3.027B  ← reported op profit
ifrs-full:ProfitLossBeforeTax                   2025=£2.750B
ifrs-full:IncomeTaxExpenseContinuingOperations  2025 available
ifrs-full:ProfitLoss                            2025=£2.078B  ← net income
ifrs-full:BasicEarningsLossPerShare             2016–2025 ✓ (GBP/shares)
ifrs-full:DilutedEarningsLossPerShare           2016–2025 ✓ (GBP/shares)
ifrs-full:CashFlowsFromUsedInOperatingActivities 2025=£2.836B
ifrs-full:CashFlowsFromUsedInInvestingActivities 2025=-£0.770B
ifrs-full:PaymentsForDevelopmentProjectExpenditure 2025=£0.504B  ← capex on dev intangibles
ifrs-full:PurchaseOfPropertyPlantAndEquipmentClassifiedAsInvestingActivities 2025=£0.021B
ifrs-full:Borrowings                            2025=£7.267B  ← gross debt
ifrs-full:CashAndCashEquivalents                2025=£0.131B
ifrs-full:NetDebt                               2025=£7.201B  ← direct tag! saves derivation
ifrs-full:DividendsPaid                         2025=£1.196B
ifrs-full:EmployeeBenefitsExpense               2025=£3.175B
ifrs-full:CostOfSales                           2025=£3.233B
```

**All monetary values are in GBP (not thousands) — divide by 1e6 for £m display.**

### XBRL Gaps — need HTML scraping
These are RELX's non-IFRS "Adjusted" metrics — critical for the dashboard but NOT in XBRL:
- Adjusted Operating Profit (£3,342m in 2025 vs reported £3,027m)
- Adjusted EPS (company's headline EPS — differs from IFRS EPS)
- Adjusted Cash Flow (£3,301m in 2025 — EBITDA-based)
- FCF Before Dividends (£2,313m in 2025 — company-defined)
- Buybacks / share repurchase amounts (no clear XBRL tag found)

These come from the "Alternative Performance Measures" section of the 20-F and/or annual results press release. Scrape using the same cached HTML approach as ProjectSmile.

### Segment data — HTML scraping (confirmed: no XBRL segment tags)
Zero segment-related XBRL tags exist for RELX. Must scrape 20-F HTML.
Search for "SEGMENT INFORMATION" in the 20-F HTML.
Expected segments: Risk Solutions | STM | Legal | Exhibitions
Data available: Revenue + Adj Operating Profit per segment (confirm year coverage)

### Deduplication rule
Most recent `filed` date wins for any given `end` date period.
`RevenueFromContractsWithCustomers` for 2018-2021 was added retroactively in the 2025 filing (filed 2026-02-19) — so dedup is essential to get the authoritative value.

### EDGAR — Foreign Private Issuers (FPI)
RELX files 20-F, not 10-K. No 10-Q quarterly filings — only 6-K current reports.
IFRS filers use `ifrs-full:` namespace in XBRL, NOT `us-gaap:`.

---

## Data Layer Patterns (from ProjectSmile)

### Currency handling
RELX reports natively in GBP millions. Store all data as £m.
Apply conversion at display time, not at storage time.
Use a single constant: `GBP_TO_USD = 1.25` (Jan 1, 2025 rate) in lib/format.ts.
Never hardcode currency in data files.

### JSON structure
Keep JSON flat: array of objects, one per year (for group data) or one per (year, segment).
Don't nest — flat is easier to iterate in TypeScript and produces smaller files.
All monetary values in native units (£m for RELX).

### HTML cache strategy
Cache downloaded 20-F HTML in `data/cache/` to avoid re-downloading on re-runs.
RELX 20-F files are large (~10MB). Cache saves significant time + avoids EDGAR rate limits.
```python
cache_path = f"data/cache/relx_{year}.htm"
if os.path.exists(cache_path):
    with open(cache_path, encoding='utf-8', errors='replace') as f:
        html = f.read()
else:
    # download and save
```

### GAAP vs non-GAAP distinction
RELX calls their non-IFRS measure "Adjusted" (adj. operating profit, adj. EPS, adj. cash flow).
These are explicitly disclosed in the 20-F and press releases — NOT buried.
Always show both: reported IFRS + adjusted, with clear labeling.
The gap comes from: amortisation of acquired intangibles + acquisition/disposal costs.

---

## Chart Patterns (from ProjectSmile)

### Economist open style
- CartesianGrid: horizontal only, solid light-gray (#EBEBEB), no vertical lines
- XAxis + YAxis: `axisLine={false}` `tickLine={false}`
- No chart border boxes — open layout with bottom border only (border-b #EBEBEB)
- Axis ticks: fontSize ≥ 13; legends fontSize ≥ 13; bar labels fontSize ≥ 11

### Message-first headlines (Zelazny style)
Each chart section has:
1. A bold headline stating the insight ("Risk Solutions drives 39% of group profit on 36% of revenue")
2. A gray italic subhead in format: "[What each axis shows]: [so what for the reader]"
3. FIG label demoted to small mono beside ⓘ button

### CAGR panels
Include a CAGR panel (right side, Bain-style) on all multi-year trend charts.
Show CAGR for the full period and any relevant sub-periods.

### Data tables under charts
Transposed: years as columns, metrics as rows. Font: Roboto Mono text-xs minimum.
Always include a data table — makes the chart auditable.

---

## Deployment (Vercel static export)

Same as ProjectSmile — identical config:
```ts
// next.config.ts
const nextConfig: NextConfig = { output: "export" };
```
Vercel project settings: Output Directory = `out`
GitHub integration: auto-deploy on push to main.

**Critical**: `next/font/google` works with static export — confirmed on ProjectSmile.

---

## Token Efficiency

### Compact JSON
- Round monetary values to 1 decimal place (£m) — no need for full precision in display data
- Segment JSON: store as flat array, not nested objects keyed by year+segment
- Don't store derived metrics in JSON — compute them in data.ts at load time

### Data file sizes
ProjectSmile target: keep each JSON file under 50KB. For 10 years × 4 segments = 40 rows — trivial.
Group financials for 10 years × ~15 fields = well under 10KB.

### Claude API calls (if used for intelligence layer)
Use `claude-haiku-4-5-20251001` for extraction tasks — ~$0.01/year of filings.
Cache Claude results per-year in JSON to avoid re-calling.
Warn after every $1 of estimated spend.

---

## Data Audit Patterns (2026-03-26)

### Root cause: adj op profit 2017–2020 were all wrong
The original data had *reported* operating profits stored in the `adjOperatingProfit` field for 2017–2020, with years shifted by one (2020 reported = 1525 was stored as 2019 adj). Fix: always go to primary source Annual Report "Adjusted figures summary" table and cross-check vs the reconciliation footnote (reported → add amortisation → add acq/disposal costs = adjusted).

### Root cause: Exhibitions 2020/2021 AOP errors
Exhibitions 2020 had value 2252 — this was actually the 2021 group sub-total (not a segment line). Exhibitions 2021 had value 162 = 2022 value duplicated. Always reconcile: sum all segments + unallocated must equal group adj op profit within ~£10m (disclosed central costs). If a segment value is wildly different from trend, treat as suspect.

### Primary source hierarchy for adjusted metrics
1. Annual Report "Adjusted figures summary" table — most reliable, reconciled
2. 20-F "Alternative Performance Measures" section — same numbers, more footnotes
3. Press release results PDF — good for cross-check
4. Never trust a value that can't be traced to one of the above

### Reconciliation check after any data edit
Segment data: `sum(seg_revenue) + unallocated ≈ group_revenue` for every year.
Gaps of -£5m to -£42m are normal (disclosed unallocated central costs).
A gap >£100m = almost certainly a data error.

---

## Component Patterns (2026-03-26)

### Recharts waterfall chart
Use stacked bars with an invisible base:
```tsx
<Bar dataKey="base" stackId="wf" fill="transparent" legendType="none" />
<Bar dataKey="value" stackId="wf" ...>
  {bars.map((b, i) => <Cell key={i} fill={b.color} />)}
</Bar>
```
Pre-compute `base` values by walking a running cursor through the bridge steps.
Totals (FCF before divs, FCF after divs) reset cursor to 0 base.

### Recharts LabelList formatter TypeScript
`formatter` on `<LabelList>` has type `LabelFormatter` which expects `label` parameter typed as `RenderableText` (not `number`). Use `as number` cast:
```tsx
formatter={(v) => `£${(v as number).toLocaleString()}`}
```
Typing `(v: number) =>` directly causes a TS compile error.

### GBP/USD toggle pattern
- Store `currency: "GBP" | "USD"` state in the top-level `DashboardTabs` component
- Import `fmtM(value, currency)` from `lib/format.ts` — already handles conversion at 1.25
- Only wire to KPI monetary values (Revenue, AOP, FCF, Net Debt sub-labels)
- EPS (pence), margins (%), multiples (×) don't need conversion
- Toggle button lives in tab bar right-justified, styled as a small mono pill

### STM 2024 restatement annotation
Add `†` to any year column header that has a known discontinuity: `{y}{y === 2024 ? "†" : ""}`.
Add a footnote paragraph below the table explaining the restatement.
Apply consistently across all charts that show that metric (FIG A1, A2, C1–C3).

---

## RELX-Specific Data (confirmed from Claude app research, FY2025)

### Group P&L 2025 (£m)
| Metric | 2025 | 2024 |
|--------|------|------|
| Revenue | 9,590 | 8,994 |
| Adj. Op Profit | 3,342 | 3,101 |
| Adj. Op Margin | 34.8% | 34.5% |
| Net Income | ~2,200 (est) | — |
| FCF before divs | 2,313 | 2,126 |
| Adj Cash Flow | 3,301 | 3,101 |

### Segment P&L 2025 (£m)
| Segment | Revenue | Adj Op Profit | Margin |
|---------|---------|---------------|--------|
| Risk | 3,485 | 1,305 | 37.4% |
| STM | 2,714 | 1,035 | 38.1% |
| Legal | 1,806 | 415 | 23.0% |
| Exhibitions | 1,186 | 410 | 34.6% |
| Print & Related | 399 | 185 | 46.4% |
| Unallocated | — | (8) | — |

Note: "Print & Related" is residual STM print revenue — not a standalone segment.
Corporate unallocated costs netted within segment line in some presentations.

### Capital structure 2025 (£m at Dec 31)
| Item | Value |
|------|-------|
| Gross debt | 7,267 |
| Cash | 131 |
| Net debt | 7,201 |
| Net debt / EBITDA | 2.0× |
| Effective interest rate | 3.9% (66% fixed) |
| Weighted avg maturity | 4.0 years |
| Undrawn facility | $3.0B (Apr 2027) |
| Credit ratings | S&P A− / Moody's A3 / Fitch A− (all Stable) |

### Capital deployment 2025 (£m)
| Item | 2025 |
|------|------|
| Dividends paid | 1,181 |
| Share buybacks | 1,500 |
| Acquisitions (cash) | 260 |
| VC investments | 42 |
| Net debt change | +638 (increased) |

### Exchange rate
GBP/USD Jan 1, 2025 = 1.25 (used throughout for USD display)

### ROIC (management KPI, from Annual Report adjusted figures summary)
| Year | 2017 | 2018 | 2019 | 2020 | 2021 | 2022 | 2023 | 2024 | 2025 |
|------|------|------|------|------|------|------|------|------|------|
| ROIC | 12.9% | 13.2% | 13.6% | 10.8% | 11.9% | 12.5% | 14.0% | 14.8% | 15.4% |
Source: "Key performance indicators" or "Adjusted figures summary" in each year's Annual Report.
RELX defines ROIC as adjusted operating profit / (average net assets + net debt). Not in XBRL.

### Underlying revenue growth (management KPI, constant FX, excl. acquisitions <12mo, excl. exhibition cycling)
| Year | 2018 | 2019 | 2020 | 2021 | 2022 | 2023 | 2024 | 2025 |
|------|------|------|------|------|------|------|------|------|
| UG % | +4% | +4% | −9% | +7% | +9% | +8% | +7% | +7% |
Source: CEO letter / KPI summary in Annual Report. Not available for 2016–2017 (pre-standard disclosure).
2020 drop (-9%) = COVID impact on Exhibitions. 2022 (+9%) = Exhibitions recovery post-COVID.
