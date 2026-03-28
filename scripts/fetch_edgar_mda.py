"""
fetch_edgar_mda.py
Downloads RELX 20-F HTML filings from EDGAR and extracts the Risk/LNRS
sections from the MD&A / Operating and Financial Review.
Outputs: data/cache/mda/{year}_full.txt  (full 20-F text)
         data/cache/mda/{year}_risk.txt   (Risk-relevant sections only)
         data/cache/mda/index.json

Run: python scripts/fetch_edgar_mda.py
"""

import json
import re
import time
import os
from pathlib import Path

import requests
from bs4 import BeautifulSoup

CACHE_DIR = Path("data/cache/mda")
CACHE_DIR.mkdir(parents=True, exist_ok=True)

HEADERS = {"User-Agent": "ProjectRELX research@example.com"}
RATE_LIMIT_S = 1.5

# From lessons.md — confirmed 20-F filings for RELX CIK 0000929869
FILINGS = [
    {"year": 2025, "accn": "0001104659-26-017277", "doc": "relx-20251231x20f.htm"},
    {"year": 2024, "accn": "0001558370-25-001178", "doc": "relx-20241231x20f.htm"},
    {"year": 2023, "accn": "0001558370-24-001468", "doc": "relx-20231231x20f.htm"},
    {"year": 2022, "accn": "0001558370-23-001846", "doc": "relx-20221231x20f.htm"},
    {"year": 2021, "accn": "0001193125-22-045453", "doc": "d171509d20f.htm"},
    {"year": 2020, "accn": "0001193125-21-047466", "doc": "d848056d20f.htm"},
    {"year": 2019, "accn": "0001193125-20-042817", "doc": "d813464d20f.htm"},
]

# Keywords to identify Risk-relevant paragraphs
RISK_KEYWORDS = re.compile(
    r"\b(risk\s+solutions?|lnrs|lexisnexis\s+risk|risk\s+division|risk\s+business|"
    r"risk\s+analytics|insurance|identity\s+(?:verification|fraud)|"
    r"financial\s+crime|fraud\s+(?:and|&)\s+identity|"
    r"government\s+(?:and|&)\s+law\s+enforcement|"
    r"telematics|verisk|accurint|fleetcross|"
    r"mark\s+kelsey|risk\s+segment|"
    r"risk\s+revenue|risk\s+(?:adjusted\s+)?operating)\b",
    re.IGNORECASE,
)

# Section headers that delineate the MD&A / operating review
MDA_SECTION_RE = re.compile(
    r"(operating\s+and\s+financial\s+review|"
    r"management.{0,10}discussion|"
    r"business\s+overview|"
    r"chief\s+executive|"
    r"results\s+of\s+operations|"
    r"key\s+performance|"
    r"risk\s+(?:solutions?|division|business))",
    re.IGNORECASE,
)


def edgar_url(accn: str, doc: str) -> str:
    accn_clean = accn.replace("-", "")
    return f"https://www.sec.gov/Archives/edgar/data/929869/{accn_clean}/{doc}"


def fetch_html(url: str) -> str | None:
    try:
        r = requests.get(url, headers=HEADERS, timeout=60)
        if r.status_code == 200:
            return r.text
        print(f"  [HTTP {r.status_code}] {url}")
        return None
    except Exception as e:
        print(f"  [error] {e}")
        return None


def extract_text_from_html(html: str) -> str:
    soup = BeautifulSoup(html, "html.parser")
    # Remove script/style noise
    for tag in soup(["script", "style", "head"]):
        tag.decompose()
    return soup.get_text(separator="\n", strip=True)


def extract_risk_sections(full_text: str) -> str:
    """
    Extract paragraphs and sections that mention Risk/LNRS.
    Returns a smaller, focused text block.
    """
    lines = full_text.splitlines()
    risk_blocks = []
    window = 3  # lines of context before/after a match

    i = 0
    while i < len(lines):
        line = lines[i]
        if RISK_KEYWORDS.search(line):
            # Grab surrounding context
            start = max(0, i - window)
            end = min(len(lines), i + window + 1)
            block = "\n".join(lines[start:end])
            # Merge with previous block if overlapping
            if risk_blocks and start <= risk_blocks[-1][1]:
                risk_blocks[-1] = (risk_blocks[-1][0], end, risk_blocks[-1][2] + "\n" + block)
            else:
                risk_blocks.append((start, end, block))
        i += 1

    return "\n\n---\n\n".join(b[2] for b in risk_blocks)


def run():
    index = []

    for filing in FILINGS:
        year = filing["year"]
        full_cache = CACHE_DIR / f"{year}_full.txt"
        risk_cache = CACHE_DIR / f"{year}_risk.txt"

        if risk_cache.exists():
            print(f"[cached]  FY{year}")
            chars = len(risk_cache.read_text(encoding="utf-8"))
            index.append({"year": year, "risk_chars": chars, "cached": True})
            continue

        # Download full 20-F HTML (large files — 5-10MB)
        if full_cache.exists():
            print(f"[html-cached] FY{year} — extracting risk sections...")
            full_text = full_cache.read_text(encoding="utf-8", errors="replace")
        else:
            url = edgar_url(filing["accn"], filing["doc"])
            print(f"[download] FY{year}  {url}")
            time.sleep(RATE_LIMIT_S)
            html = fetch_html(url)
            if not html:
                print(f"  FAILED — skipping FY{year}")
                continue
            full_text = extract_text_from_html(html)
            full_cache.write_text(full_text, encoding="utf-8")
            print(f"  Downloaded: {len(full_text):,} chars")

        # Extract Risk-relevant sections
        risk_text = extract_risk_sections(full_text)
        risk_cache.write_text(risk_text, encoding="utf-8")

        print(f"  Risk sections: {len(risk_text):,} chars (from {len(full_text):,} total)")
        index.append({"year": year, "full_chars": len(full_text), "risk_chars": len(risk_text)})

    # Save index
    idx_path = CACHE_DIR / "index.json"
    idx_path.write_text(json.dumps({"filings": index}, indent=2), encoding="utf-8")

    print(f"\n{'='*60}")
    print(f"Done. {len(index)} years processed.")
    total_risk = sum(d.get("risk_chars", 0) for d in index)
    print(f"Total Risk-section text: {total_risk:,} chars")


if __name__ == "__main__":
    os.chdir(Path(__file__).parent.parent)
    run()
