"""
fetch_relx_segments.py
Scrapes RELX 20-F annual reports to extract segment revenue and adjusted
operating profit for Risk, STM, Legal, Exhibitions, and Print (from 2025).

The segment table in the MD&A shows 3 years per filing (current + 2 prior).
Strategy: scrape all filings; dedup by year (most recently filed wins).

Output: data/relx-segments.json — list of segment rows.

Usage:
    py -3 scripts/fetch_relx_segments.py
    py -3 scripts/fetch_relx_segments.py --no-cache
    py -3 scripts/fetch_relx_segments.py --year 2025
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

CIK = "929869"
HEADERS = {"User-Agent": "ProjectRELX research@example.com"}
REQUEST_DELAY = 2.5

CACHE_DIR = Path(__file__).parent.parent / "data" / "cache"
OUTPUT_PATH = Path(__file__).parent.parent / "data" / "relx-segments.json"

# Main 20-F HTML files — the segment table lives in the MD&A section
FILINGS: dict[str, dict[str, str]] = {
    "2025": {"accession": "0001104659-26-017277", "doc": "relx-20251231x20f.htm"},
    "2024": {"accession": "0001558370-25-001178", "doc": "relx-20241231x20f.htm"},
    "2023": {"accession": "0001558370-24-001468", "doc": "relx-20231231x20f.htm"},
    "2022": {"accession": "0001558370-23-001846", "doc": "relx-20221231x20f.htm"},
    "2021": {"accession": "0001193125-22-045453", "doc": "d171509d20f.htm"},
    "2020": {"accession": "0001193125-21-047466", "doc": "d848056d20f.htm"},
    "2019": {"accession": "0001193125-20-042817", "doc": "d813464d20f.htm"},
    "2018": {"accession": "0001193125-19-055997", "doc": "d687928d20f.htm"},
}

# Validation: known segment revenue (GBPm) from manual verification
KNOWN: dict[str, dict[str, float]] = {
    "2025": {"Risk": 3485, "STM": 2714, "Legal": 1806, "Exhibitions": 1186, "Print": 399},
    "2024": {"Risk": 3336, "STM": 2624, "Legal": 1718, "Exhibitions": 1239, "Print": 517},
    "2023": {"Risk": 3224, "STM": 2581, "Legal": 1655, "Exhibitions": 1115, "Print": 586},
}

SEGMENT_NAMES = ["Risk", "STM", "Legal", "Exhibitions", "Print"]

# Regex aliases to match segment names in 20-F text
SEGMENT_PATTERNS = {
    "Risk":        r"Risk\b",
    "STM":         r"Scientific,?\s+Technical\s*(?:&amp;|&|and)\s*Medical",
    "Legal":       r"Legal\b",
    "Exhibitions": r"Exhibitions\b",
    "Print":       r"Print\s*(?:&amp;|&|and)\s*print[- ]related",
}

logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(message)s")
log = logging.getLogger(__name__)


# ─── Download / cache ─────────────────────────────────────────────────────────

def filing_url(year: str) -> str:
    f = FILINGS[year]
    accn = f["accession"].replace("-", "")
    return f"https://www.sec.gov/Archives/edgar/data/{CIK}/{accn}/{f['doc']}"


def fetch_text(year: str, no_cache: bool) -> str | None:
    """Return plain text of the 20-F (tags stripped). Cache to disk."""
    cache_path = CACHE_DIR / f"relx_20f_{year}.txt"
    if not no_cache and cache_path.exists():
        log.info("  Cache hit: %s", cache_path.name)
        text = cache_path.read_text(encoding="utf-8")
        # Normalise zero-width spaces in case cache predates this fix
        return text.replace("\u200b", " ")

    url = filing_url(year)
    log.info("  Downloading %s", url)
    try:
        r = requests.get(url, headers=HEADERS, timeout=60)
        r.raise_for_status()
    except Exception as exc:
        log.warning("  Failed to download %s: %s", year, exc)
        return None

    raw = r.content.decode("utf-8", errors="replace")
    text = re.sub(r"<[^>]+>", " ", raw)
    text = html_module.unescape(text)
    text = text.replace("\u200b", " ")   # zero-width space → regular space
    text = re.sub(r"\s+", " ", text).strip()

    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    cache_path.write_text(text, encoding="utf-8")
    log.info("  Cached %s (%.1f MB text)", cache_path.name, len(text) / 1e6)
    time.sleep(REQUEST_DELAY)
    return text


# ─── Parsing ──────────────────────────────────────────────────────────────────

def parse_gbp(s: str) -> float | None:
    s = s.strip()
    neg = s.startswith("(") and s.endswith(")")
    s = s.strip("()").replace(",", "")
    try:
        return -float(s) if neg else float(s)
    except ValueError:
        return None


def find_segment_table(text: str) -> str | None:
    """
    Locate the segment revenue table in the MD&A.
    RELX 20-F introduces it with a sentence about "revenue and adjusted operating profit
    for each of our business segments".
    """
    patterns = [
        r"following tables show revenue and adjusted operating profit for each of our business segments",
        r"Revenue by segment.*?adjusted operating profit by segment",
        r"Revenue.*?for each.*?business segment",
    ]
    for p in patterns:
        m = re.search(p, text, re.IGNORECASE | re.DOTALL)
        if m:
            return text[m.start(): m.start() + 10000]
    return None


def extract_years_from_header(chunk: str) -> list[str]:
    """Extract year labels (e.g. ['2023', '2024', '2025']) from the table header."""
    years = re.findall(r"\b(20\d{2})\b", chunk[:2000])
    # Deduplicate preserving order, keep only plausible fiscal years
    seen: set[str] = set()
    result = []
    for y in years:
        if y not in seen and 2015 <= int(y) <= 2030:
            seen.add(y)
            result.append(y)
    return result[:3]  # at most 3 years shown


def parse_segment_block(chunk: str) -> dict[str, dict[str, list[float]]]:
    """
    Parse the revenue and adj. operating profit values per segment.
    Returns {segment_name: {year: value_gbpm}} for both revenue and adj_op_profit.
    """
    years = extract_years_from_header(chunk)
    if not years:
        return {}

    # The intro paragraph contains segment names in prose. Narrow chunk to the first
    # actual table data row. We find the first segment name followed by numeric data
    # (any known segment name with 3+ digit value within 80 chars).
    first_data_row = re.search(
        r"(?:Risk|Scientific|Legal|Exhibitions|Elsevier)\b[\s\S]{0,80}?[\d,]{3,}",
        chunk,
    )
    if first_data_row:
        chunk = chunk[first_data_row.start():]

    # Structure: Revenue table → (Reported op profit mini-section) → AOP table.
    # Split at the revenue table's "Total" row — that's the clean boundary.
    # Avoid splitting on the intro sentence which mentions "adjusted operating profit"
    # before any actual data.
    rev_section = chunk
    aop_section = ""

    # Primary split: "Total" followed by two revenue-magnitude numbers (> 1000)
    total_match = re.search(
        r"Total[\s\u200b£,\.]+(\d[\d,]+)[\s\u200b£,\.]+(\d[\d,]+)",
        chunk,
    )
    if total_match:
        # Verify the Total values look like group revenue (> 5000 GBPm)
        try:
            v1 = float(total_match.group(1).replace(",", ""))
            v2 = float(total_match.group(2).replace(",", ""))
            if v1 > 5000 or v2 > 5000:
                rev_section = chunk[:total_match.end()]
                aop_section = chunk[total_match.end():]
        except ValueError:
            pass

    # Fallback: find "Adjusted operating profit" that appears AFTER segment data
    # (i.e., after at least 2000 chars, past the intro paragraph)
    if not aop_section:
        aop_match = re.search(
            r"Adjusted operating profit",
            chunk[2000:],  # skip the intro paragraph
            re.IGNORECASE,
        )
        if aop_match:
            split_pos = 2000 + aop_match.start()
            rev_section = chunk[:split_pos]
            aop_section = chunk[split_pos:]

    def extract_segment_values(section: str, n_years: int) -> dict[str, list[float | None]]:
        """For each segment pattern, find n_years consecutive numeric values."""
        result: dict[str, list[float | None]] = {}
        for seg_name, pattern in SEGMENT_PATTERNS.items():
            m = re.search(pattern, section, re.IGNORECASE)
            if not m:
                continue
            # Find next n_years numeric tokens after the segment name
            rest = section[m.end(): m.end() + 500]
            tokens = re.findall(r"£?\s*([\d,]+)", rest)
            vals: list[float | None] = []
            for tok in tokens[:n_years * 2]:  # grab extra in case of % tokens
                if "," in tok or (tok.isdigit() and len(tok) > 2):
                    v = parse_gbp(tok)
                    if v is not None and v > 50:  # plausibility: segment revenue > £50m
                        vals.append(v)
                    if len(vals) == n_years:
                        break
            if vals:
                result[seg_name] = vals
        return result

    rev_vals = extract_segment_values(rev_section, len(years))
    aop_vals = extract_segment_values(aop_section, len(years)) if aop_section else {}

    return {"years": years, "revenue": rev_vals, "adjOpProfit": aop_vals}


def scrape_year(year: str, no_cache: bool) -> list[dict]:
    """Scrape one 20-F; return list of segment dicts for all years shown in that filing."""
    log.info("Scraping %s 20-F", year)
    text = fetch_text(year, no_cache)
    if not text:
        return []

    chunk = find_segment_table(text)
    if not chunk:
        log.warning("  Segment table not found in %s 20-F", year)
        return []

    parsed = parse_segment_block(chunk)
    years_shown = parsed.get("years", [])
    rev = parsed.get("revenue", {})
    aop = parsed.get("adjOpProfit", {})

    if not years_shown:
        log.warning("  Could not extract year headers from %s 20-F", year)
        return []

    log.info("  Years found: %s | Segments revenue: %s | Segments AOP: %s",
             years_shown, list(rev.keys()), list(aop.keys()))

    rows = []
    for seg in SEGMENT_NAMES:
        rev_vals = rev.get(seg, [])
        aop_vals = aop.get(seg, [])
        for i, yr in enumerate(years_shown):
            r_val = rev_vals[i] if i < len(rev_vals) else None
            a_val = aop_vals[i] if i < len(aop_vals) else None
            if r_val is None:
                continue
            margin = round(a_val / r_val * 100, 1) if a_val is not None and r_val else None
            rows.append({
                "year": int(yr),
                "segment": seg,
                "revenue": round(r_val, 1),
                "adjOpProfit": round(a_val, 1) if a_val is not None else None,
                "adjOpMargin": margin,
                "sourceFiling": int(year),  # which 20-F this came from
            })
    return rows


# ─── Dedup + validate ─────────────────────────────────────────────────────────

def dedup_rows(all_rows: list[dict]) -> list[dict]:
    """Keep the most recently filed (highest sourceFiling) value per (year, segment)."""
    best: dict[tuple, dict] = {}
    for row in all_rows:
        key = (row["year"], row["segment"])
        if key not in best or row["sourceFiling"] > best[key]["sourceFiling"]:
            best[key] = row
    # Strip sourceFiling from output
    result = []
    for row in sorted(best.values(), key=lambda r: (r["year"], r["segment"])):
        out = {k: v for k, v in row.items() if k != "sourceFiling"}
        result.append(out)
    return result


def validate(rows: list[dict]) -> None:
    by_yr_seg = {(r["year"], r["segment"]): r for r in rows}
    ok = True
    for yr_str, segs in KNOWN.items():
        yr = int(yr_str)
        for seg, expected_rev in segs.items():
            actual = by_yr_seg.get((yr, seg), {}).get("revenue")
            if actual is None:
                log.warning("VALIDATION MISSING  %s/%s", yr, seg)
                ok = False
                continue
            diff = abs(actual - expected_rev)
            status = "OK" if diff <= 10 else "MISMATCH"
            if status == "MISMATCH":
                ok = False
            log.info("VALIDATION %s  %s/%s revenue  actual=%.0f  expected=%.0f  diff=%.0f",
                     status, yr, seg, actual, expected_rev, diff)
    if ok:
        log.info("All validations passed.")


# ─── Main ─────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--no-cache", action="store_true")
    parser.add_argument("--year", help="Process single year only")
    args = parser.parse_args()

    years_to_scrape = [args.year] if args.year else sorted(FILINGS.keys(), reverse=True)
    all_rows: list[dict] = []

    for year in years_to_scrape:
        rows = scrape_year(year, args.no_cache)
        all_rows.extend(rows)

    if not all_rows:
        log.error("No segment data extracted.")
        return

    final = dedup_rows(all_rows)
    log.info("Final: %d segment rows across %d years",
             len(final), len({r["year"] for r in final}))

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(final, f, indent=2)
    log.info("Wrote %s", OUTPUT_PATH)

    validate(final)


if __name__ == "__main__":
    main()
