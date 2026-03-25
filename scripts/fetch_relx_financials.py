"""
fetch_relx_financials.py
Hybrid pipeline for RELX Group plc group-level financials.

Part 1 — XBRL (SEC EDGAR): IFRS metrics for all available years (2016–2025)
Part 2 — HTML (Exhibit 15.2 Annual Report): adjusted/non-IFRS metrics per year

Output: data/relx-financials.json — dict keyed by year, values in GBP millions.

Usage:
    py -3 scripts/fetch_relx_financials.py
    py -3 scripts/fetch_relx_financials.py --no-cache   # re-download HTML
"""

import argparse
import html as html_module
import json
import logging
import re
import time
from pathlib import Path

import requests

# ─── Config ───────────────────────────────────────────────────────────────────

CIK = "0000929869"  # RELX PLC (not RELX NV = 0000929872, which stopped filing in 2017)
XBRL_URL = f"https://data.sec.gov/api/xbrl/companyfacts/CIK{CIK}.json"
HEADERS = {"User-Agent": "ProjectRELX research@example.com"}
REQUEST_DELAY = 2.0  # seconds between EDGAR HTML requests

CACHE_DIR = Path(__file__).parent.parent / "data" / "cache"
OUTPUT_PATH = Path(__file__).parent.parent / "data" / "relx-financials.json"

# Exhibit 15.2 = RELX Annual Report & Accounts (incorporated by reference into 20-F)
# The adjusted figures and FCF bridge live here.
# URL: https://www.sec.gov/Archives/edgar/data/929869/{ACCN_NODASHES}/{DOC}
FILINGS: dict[str, dict[str, str]] = {
    "2025": {"accession": "0001104659-26-017277", "ex152": "relx-20251231xex15d2.htm"},
    "2024": {"accession": "0001558370-25-001178", "ex152": "relx-20241231xex15d2.htm"},
    "2023": {"accession": "0001558370-24-001468", "ex152": "relx-20231231xex15d2.htm"},
    "2022": {"accession": "0001558370-23-001846", "ex152": "relx-20221231xex15d2.htm"},
    "2021": {"accession": "0001193125-22-045453", "ex152": "d171509dex152.htm"},
    "2020": {"accession": "0001193125-21-047466", "ex152": "d848056dex152.htm"},
    "2019": {"accession": "0001193125-20-042817", "ex152": "d813464dex152.htm"},
    "2018": {"accession": "0001193125-19-055997", "ex152": "d687928dex152.htm"},
}

# IFRS XBRL tag map: field_name → [primary_tag, ...fallbacks]
# All monetary tags are in raw GBP (not thousands). EPS in GBP/share.
XBRL_CONCEPTS: dict[str, list[str]] = {
    # Revenue: two-tag strategy — RevenueFromContractsWithCustomers for 2018-2025,
    # Revenue as fallback for 2015-2017 (RELX changed tags when adopting IFRS 15)
    "revenue":          ["RevenueFromContractsWithCustomers", "Revenue"],
    "grossProfit":      ["GrossProfit"],
    "reportedOpProfit": ["ProfitLossFromOperatingActivities"],
    "pbt":              ["ProfitLossBeforeTax"],
    "taxCharge":        ["IncomeTaxExpenseContinuingOperations"],
    "netIncome":        ["ProfitLoss"],
    "epsBasic":         ["BasicEarningsLossPerShare"],      # GBP/shares
    "epsDiluted":       ["DilutedEarningsLossPerShare"],    # GBP/shares
    "operatingCF":      ["CashFlowsFromUsedInOperatingActivities"],
    "investingCF":      ["CashFlowsFromUsedInInvestingActivities"],
    # CapEx = development intangibles + PPE (RELX capex is predominantly dev intangibles)
    "capexDev":         ["PaymentsForDevelopmentProjectExpenditure"],
    "capexPPE":         ["PurchaseOfPropertyPlantAndEquipmentClassifiedAsInvestingActivities"],
    "borrowings":       ["Borrowings"],           # gross debt (bonds + leases)
    "cash":             ["CashAndCashEquivalents"],
    "netDebt":          ["NetDebt"],              # direct IFRS tag — no derivation needed
    "dividendsPaid":    ["DividendsPaid"],
    "employeeCosts":    ["EmployeeBenefitsExpense"],
    "costOfSales":      ["CostOfSales"],
}

# Validation anchors: field, expected GBPm, tolerance GBPm
KNOWN_VALUES: dict[str, list[tuple[str, float, float]]] = {
    "2025": [
        ("revenue",         9590.0, 5.0),
        ("reportedOpProfit", 3027.0, 5.0),
        ("netDebt",          7201.0, 5.0),
    ],
    "2024": [
        ("revenue",          9434.0, 5.0),
        ("reportedOpProfit", 2861.0, 5.0),
    ],
}

logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(message)s")
log = logging.getLogger(__name__)


# ─── XBRL helpers ─────────────────────────────────────────────────────────────

def fetch_xbrl() -> dict:
    log.info("Fetching XBRL facts from %s", XBRL_URL)
    r = requests.get(XBRL_URL, headers=HEADERS, timeout=30)
    r.raise_for_status()
    return r.json()


def extract_ifrs(facts: dict, tags: list[str]) -> dict[str, float]:
    """Try tags in order; return {YYYY-MM-DD: value} for 20-F annual entries, deduped."""
    ifrs = facts.get("facts", {}).get("ifrs-full", {})
    for tag in tags:
        if tag not in ifrs:
            continue
        raw: list[dict] = []
        for _unit, entries in ifrs[tag].get("units", {}).items():
            for e in entries:
                if e.get("form") == "20-F" and e.get("end") and e.get("val") is not None:
                    raw.append({"end": e["end"], "filed": e.get("filed", ""), "val": e["val"]})
        if not raw:
            continue
        # Dedup: keep most recently filed per end-date
        best: dict[str, dict] = {}
        for r2 in raw:
            end = r2["end"]
            if end not in best or r2["filed"] > best[end]["filed"]:
                best[end] = r2
        return {end: r2["val"] for end, r2 in best.items()}
    return {}


def build_xbrl_rows(facts: dict) -> dict[str, dict[str, float]]:
    """Returns {year_str: {field: raw_gbp_value}} for Dec-31 year-ends only."""
    rows: dict[str, dict[str, float]] = {}
    for field, tags in XBRL_CONCEPTS.items():
        series = extract_ifrs(facts, tags)
        for end_date, val in series.items():
            # RELX fiscal year ends Dec 31
            if not end_date.endswith("-12-31"):
                continue
            year = end_date[:4]
            rows.setdefault(year, {})[field] = val
    return rows


# ─── Exhibit 15.2 (adjusted figures) ─────────────────────────────────────────

def ex152_url(year: str) -> str:
    filing = FILINGS[year]
    accn = filing["accession"].replace("-", "")
    return f"https://www.sec.gov/Archives/edgar/data/929869/{accn}/{filing['ex152']}"


def fetch_html(year: str, no_cache: bool) -> str | None:
    """Download and cache Exhibit 15.2 HTML. Returns plain text (tags stripped)."""
    cache_path = CACHE_DIR / f"relx_ex152_{year}.txt"
    if not no_cache and cache_path.exists():
        log.info("  Cache hit: %s", cache_path.name)
        return cache_path.read_text(encoding="utf-8")

    url = ex152_url(year)
    log.info("  Downloading %s", url)
    try:
        r = requests.get(url, headers=HEADERS, timeout=30)
        r.raise_for_status()
    except Exception as exc:
        log.warning("  Failed to fetch Exhibit 15.2 for %s: %s", year, exc)
        return None

    raw = r.content.decode("utf-8", errors="replace")
    # Strip HTML tags + collapse whitespace → plain text for easier regex
    text = re.sub(r"<[^>]+>", " ", raw)
    text = html_module.unescape(text)
    text = re.sub(r"\s+", " ", text).strip()

    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    cache_path.write_text(text, encoding="utf-8")
    time.sleep(REQUEST_DELAY)
    return text


def parse_gbp(s: str) -> float | None:
    """Parse a GBPm string like '3,342' or '(261)' → float. Parentheses = negative."""
    s = s.strip()
    negative = s.startswith("(") and s.endswith(")")
    s = s.strip("()")
    s = s.replace(",", "")
    try:
        val = float(s)
        return -val if negative else val
    except ValueError:
        return None


def parse_pence(s: str) -> float | None:
    """Parse a pence-per-share string like '128.5p' → float pence."""
    s = s.strip().rstrip("p")
    try:
        return float(s)
    except ValueError:
        return None


def parse_ex152(text: str, filing_year: str) -> dict[str, dict[str, float]]:
    """
    Parse the 'RELX financial summary' table from Exhibit 15.2 plain text.
    Returns {year_str: {field: value_gbpm_or_pence}}.
    Each exhibit shows two years (current + prior).
    """
    result: dict[str, dict[str, dict]] = {}  # {year: {field: raw_str}}

    # Locate the financial summary section
    idx = text.find("RELX financial summary")
    if idx < 0:
        log.warning("  'RELX financial summary' not found in Exhibit 15.2 for %s", filing_year)
        return {}

    chunk = text[idx: idx + 4000]

    # Extract year headers — formats vary across filing years:
    #   newer (2023+): "2024 GBPm 2025 GBPm"
    #   older (2022):  "2021 \u200b\u200b 2022 \u200b\u200b ... £m £m"
    #   oldest (2018-2021): "2021 2020 ... £m £m" (current year listed FIRST)
    # Strategy: find all 4-digit years in the summary chunk; use filing_year as anchor.
    years_found = re.findall(r"\b(20\d{2})\b", chunk[:2000])
    years_found = [y for y in dict.fromkeys(years_found) if 2015 <= int(y) <= 2030]
    if len(years_found) < 2:
        log.warning("  Could not parse year headers in Exhibit 15.2 for %s", filing_year)
        return {}
    # The filing_year is the "current" year; the other is prior
    if filing_year in years_found:
        current_year = filing_year
        other = [y for y in years_found if y != filing_year]
        prior_year = other[0] if other else str(int(filing_year) - 1)
    else:
        # Fall back: first year = prior, second = current (most common layout)
        prior_year, current_year = years_found[0], years_found[1]
    # Ensure prior < current
    if int(prior_year) > int(current_year):
        prior_year, current_year = current_year, prior_year

    def extract_two(label_pattern: str) -> tuple[str | None, str | None]:
        """Find label → extract two consecutive numeric values (prior, current)."""
        m = re.search(label_pattern, chunk)
        if not m:
            return None, None
        rest = chunk[m.end():]
        # Match up to 2 numeric tokens (may include commas, parens, decimal)
        tokens = re.findall(r"\([\d,]+(?:\.\d+)?\)|[\d,]+(?:\.\d+)?[p%]?", rest)
        prior_tok = tokens[0] if len(tokens) >= 1 else None
        curr_tok = tokens[1] if len(tokens) >= 2 else None
        return prior_tok, curr_tok

    # Define what to extract: (field_name, regex_pattern, parser_fn)
    EXTRACTIONS = [
        ("adjOperatingProfit",  r"Operating profit\b",        parse_gbp),
        ("ebitda",              r"\bEBITDA\b",                 parse_gbp),
        ("adjNetInterestExp",   r"Net interest expense",       parse_gbp),
        ("adjPBT",              r"Profit before tax\b",        parse_gbp),
        ("adjTax",              r"Tax charge\b",               parse_gbp),
        ("adjNetProfit",        r"Net profit attributable",    parse_gbp),
        ("adjCashFlow",         r"Cash flow\b(?!\s+conversion)",parse_gbp),
        ("adjEPS",              r"Earnings per share",         parse_pence),
        ("dividendPerShare",    r"Ordinary dividend per share",parse_pence),
    ]

    rows: dict[str, dict[str, float]] = {prior_year: {}, current_year: {}}
    for field, pattern, parser in EXTRACTIONS:
        prior_tok, curr_tok = extract_two(pattern)
        if prior_tok:
            val = parser(prior_tok)
            if val is not None:
                rows[prior_year][field] = val
        if curr_tok:
            val = parser(curr_tok)
            if val is not None:
                rows[current_year][field] = val

    # FCF bridge — in a separate section
    fcf_idx = text.find("FREE CASH FLOW YEAR TO 31 DECEMBER", idx)
    if fcf_idx < 0:
        fcf_idx = text.find("Free cash flow before dividends", idx)

    if fcf_idx >= 0:
        fcf_chunk = text[fcf_idx: fcf_idx + 1500]
        fcf_fields = [
            ("adjCashFlow",          r"Adjusted cash flow\b"),
            ("netInterestPaid",      r"Interest paid \(net\)"),
            ("cashTaxPaid",          r"Cash tax paid"),
            ("acqDisposalItems",     r"Acquisition and disposal related"),
            ("fcfBeforeDividends",   r"Free cash flow before dividends"),
            ("dividendsPaidToShareholders", r"Ordinary dividends"),
            ("fcfAfterDividends",    r"Free cash flow after dividends"),
        ]
        for field, pattern in fcf_fields:
            m = re.search(pattern, fcf_chunk)
            if not m:
                continue
            tokens = re.findall(r"\([\d,]+(?:\.\d+)?\)|[\d,]+(?:\.\d+)?", fcf_chunk[m.end():])
            if len(tokens) >= 2:
                prior_val = parse_gbp(tokens[0])
                curr_val = parse_gbp(tokens[1])
                if prior_val is not None:
                    rows[prior_year][field] = prior_val
                if curr_val is not None:
                    rows[current_year][field] = curr_val
            elif len(tokens) == 1:
                # Single value — try to match to current year
                curr_val = parse_gbp(tokens[0])
                if curr_val is not None:
                    rows[current_year][field] = curr_val

    return {yr: d for yr, d in rows.items() if d}


# ─── Merge + output ───────────────────────────────────────────────────────────

def to_gbpm(raw_gbp: float) -> float:
    """Convert raw GBP value (from XBRL) to GBP millions, rounded to 1 dp."""
    return round(raw_gbp / 1_000_000, 1)


def build_output(xbrl_rows: dict, adj_rows: dict) -> dict:
    """Merge XBRL and adjusted data; convert monetary to GBPm; return year-keyed dict."""
    all_years = sorted(set(xbrl_rows) | set(adj_rows))
    out: dict[str, dict] = {}

    for yr in all_years:
        row: dict = {"year": int(yr)}

        # XBRL fields (raw GBP → GBPm)
        x = xbrl_rows.get(yr, {})
        for field, val in x.items():
            if field in ("epsBasic", "epsDiluted"):
                # EPS is GBP/share → convert to pence for consistency with RELX reporting
                row[field] = round(val * 100, 1)
            else:
                row[field] = to_gbpm(val)

        # Derived from XBRL: total capex
        if "capexDev" in row and "capexPPE" in row:
            row["capexTotal"] = round(row["capexDev"] + row["capexPPE"], 1)

        # Adjusted fields (already in GBPm from Exhibit 15.2)
        a = adj_rows.get(yr, {})
        for field, val in a.items():
            # Don't overwrite XBRL values (more authoritative for IFRS fields)
            if field not in row:
                row[field] = round(val, 1)

        out[yr] = row

    return out


def validate(out: dict) -> None:
    ok = True
    for yr, checks in KNOWN_VALUES.items():
        if yr not in out:
            log.warning("VALIDATION: year %s missing", yr)
            ok = False
            continue
        for field, expected, tol in checks:
            actual = out[yr].get(field)
            if actual is None:
                log.warning("VALIDATION MISSING  %s/%s", yr, field)
                ok = False
                continue
            diff = abs(actual - expected)
            status = "OK" if diff <= tol else "MISMATCH"
            if status == "MISMATCH":
                ok = False
            log.info("VALIDATION %s  %s/%s  actual=%.1f  expected=%.1f  diff=%.1f",
                     status, yr, field, actual, expected, diff)
    if ok:
        log.info("All validations passed.")


# ─── Main ─────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--no-cache", action="store_true", help="Re-download all HTML")
    args = parser.parse_args()

    # Part 1: XBRL
    facts = fetch_xbrl()
    xbrl_rows = build_xbrl_rows(facts)
    log.info("XBRL: %d years extracted (%s)", len(xbrl_rows), sorted(xbrl_rows.keys()))

    # Part 2: Exhibit 15.2 — adjusted metrics
    # Dedup: if same year appears in multiple filings, later filing wins
    adj_all: dict[str, dict[str, dict]] = {}  # {year: {field: (filed_year, value)}}
    for filing_year in sorted(FILINGS.keys(), reverse=True):  # newest first
        log.info("Exhibit 15.2 — filing year %s", filing_year)
        text = fetch_html(filing_year, args.no_cache)
        if not text:
            continue
        parsed = parse_ex152(text, filing_year)
        for yr, fields in parsed.items():
            if yr not in adj_all:
                adj_all[yr] = {}
            for field, val in fields.items():
                if field not in adj_all[yr]:  # newest filing already wins (iterating newest first)
                    adj_all[yr][field] = val

    adj_rows = {yr: fields for yr, fields in adj_all.items()}
    log.info("Adjusted: %d years extracted (%s)", len(adj_rows), sorted(adj_rows.keys()))

    # Merge
    output = build_output(xbrl_rows, adj_rows)

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2)
    log.info("Wrote %s (%d years)", OUTPUT_PATH, len(output))

    validate(output)


if __name__ == "__main__":
    main()
