"""
scrape_seeking_alpha.py
Scrapes RELX earnings call transcripts from Seeking Alpha (free HTML).
Outputs: data/cache/transcripts/sa_{slug}.json per transcript
         data/cache/transcripts/sa_index.json  (index of all found)

Run: python scripts/scrape_seeking_alpha.py
"""

import json
import re
import time
import os
from pathlib import Path
from datetime import datetime

import requests
from bs4 import BeautifulSoup

# ── Config ────────────────────────────────────────────────────────────────────
CACHE_DIR = Path("data/cache/transcripts")
CACHE_DIR.mkdir(parents=True, exist_ok=True)

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/122.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate",
    "Connection": "keep-alive",
}
RATE_LIMIT_S = 3  # seconds between requests — respectful crawling

SESSION = requests.Session()
SESSION.headers.update(HEADERS)

# Known RELX transcript URLs on Seeking Alpha — extend as needed
# Format: (slug, period_label, date)
KNOWN_TRANSCRIPTS = [
    # FY results
    ("relx-plc-relx-q4-2025-earnings-call-transcript", "FY2025", "2026-02-12"),
    ("relx-plc-relx-q4-2024-earnings-call-transcript", "FY2024", "2025-02-20"),
    ("relx-plc-relx-q4-2023-earnings-call-transcript", "FY2023", "2024-02-22"),
    ("relx-plc-relx-q4-2022-earnings-call-transcript", "FY2022", "2023-02-23"),
    ("relx-plc-relx-q4-2021-earnings-call-transcript", "FY2021", "2022-02-17"),
    ("relx-plc-relx-q4-2020-earnings-call-transcript", "FY2020", "2021-02-18"),
    ("relx-plc-relx-q4-2019-earnings-call-transcript", "FY2019", "2020-02-20"),
    ("relx-plc-relx-q4-2018-earnings-call-transcript", "FY2018", "2019-02-28"),
    # H1 / interim results
    ("relx-plc-relx-q2-2025-earnings-call-transcript", "H12025", "2025-07-24"),
    ("relx-plc-relx-q2-2024-earnings-call-transcript", "H12024", "2024-07-25"),
    ("relx-plc-relx-q2-2023-earnings-call-transcript", "H12023", "2023-07-27"),
    ("relx-plc-relx-q2-2022-earnings-call-transcript", "H12022", "2022-07-28"),
    ("relx-plc-relx-q2-2021-earnings-call-transcript", "H12021", "2021-07-29"),
    ("relx-plc-relx-q2-2020-earnings-call-transcript", "H12020", "2020-07-30"),
    ("relx-plc-relx-q2-2019-earnings-call-transcript", "H12019", "2019-07-25"),
]

SA_BASE = "https://seekingalpha.com/article"


def fetch_page(url: str) -> BeautifulSoup | None:
    try:
        r = SESSION.get(url, timeout=15)
        if r.status_code == 200:
            return BeautifulSoup(r.text, "html.parser")
        elif r.status_code == 403:
            print(f"  [403 blocked] {url}")
        elif r.status_code == 404:
            print(f"  [404 not found] {url}")
        else:
            print(f"  [HTTP {r.status_code}] {url}")
        return None
    except Exception as e:
        print(f"  [error] {url}: {e}")
        return None


def extract_transcript(soup: BeautifulSoup, slug: str, period: str, date: str) -> dict | None:
    """
    Parse a Seeking Alpha transcript page into structured chunks.
    Returns dict with metadata + list of speaker turns.
    """
    # Title
    title_tag = soup.find("h1") or soup.find("title")
    title = title_tag.get_text(strip=True) if title_tag else slug

    # Main article body — SA uses various containers
    body = (
        soup.find("div", {"data-test-id": "article-content"})
        or soup.find("div", class_=re.compile(r"article.*body|content.*article", re.I))
        or soup.find("article")
    )

    if not body:
        # Fallback: grab all <p> tags from the page
        paras = [p.get_text(strip=True) for p in soup.find_all("p") if len(p.get_text(strip=True)) > 40]
    else:
        paras = [p.get_text(strip=True) for p in body.find_all("p") if len(p.get_text(strip=True)) > 20]

    if len(paras) < 5:
        print(f"  [warn] very few paragraphs extracted ({len(paras)}) — possible JS wall")
        return None

    # Parse speaker turns
    # SA format: "Speaker Name [role/firm]" followed by text paragraphs
    turns = []
    current_speaker = None
    current_role = None
    current_lines = []

    # Speaker pattern: "First Last" or "First Last -- Role, Firm"
    speaker_re = re.compile(
        r"^([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})"   # name
        r"(?:\s+--?\s+(.+))?$"                        # optional role
    )

    for para in paras:
        m = speaker_re.match(para)
        # Heuristic: short line (<80 chars), title-case, no sentence-ending punctuation
        if m and len(para) < 100 and not para.endswith((".", "?", "!")):
            if current_speaker and current_lines:
                turns.append({
                    "speaker": current_speaker,
                    "role": current_role,
                    "text": " ".join(current_lines),
                })
            current_speaker = m.group(1).strip()
            current_role = m.group(2).strip() if m.group(2) else None
            current_lines = []
        else:
            current_lines.append(para)

    # flush last turn
    if current_speaker and current_lines:
        turns.append({
            "speaker": current_speaker,
            "role": current_role,
            "text": " ".join(current_lines),
        })

    # If speaker detection failed, store as flat paragraphs
    if len(turns) < 3:
        print(f"  [warn] speaker detection found only {len(turns)} turns — storing as flat text")
        return {
            "slug": slug,
            "period": period,
            "date": date,
            "title": title,
            "source": "seeking_alpha",
            "source_type": "earnings_call",
            "format": "flat",
            "paragraphs": paras,
            "turns": [],
            "scraped_at": datetime.utcnow().isoformat(),
        }

    # Classify turns: prepared remarks vs Q&A
    qa_started = False
    for turn in turns:
        lower = turn["text"].lower()
        if not qa_started and any(x in lower for x in ["question-and-answer", "q&a session", "open the line", "take questions"]):
            qa_started = True
        turn["section"] = "qa" if qa_started else "prepared"

    return {
        "slug": slug,
        "period": period,
        "date": date,
        "title": title,
        "source": "seeking_alpha",
        "source_type": "earnings_call",
        "format": "structured",
        "turns": turns,
        "paragraphs": [],
        "scraped_at": datetime.utcnow().isoformat(),
    }


def discover_from_index() -> list[tuple[str, str, str]]:
    """Try to find additional transcript URLs from the SA symbol page."""
    url = "https://seekingalpha.com/symbol/RELX/earnings/transcripts"
    print(f"Fetching index: {url}")
    soup = fetch_page(url)
    if not soup:
        print("  Could not fetch index page — using known list only")
        return []

    discovered = []
    # SA article links pattern: /article/XXXXXXX-slug
    for a in soup.find_all("a", href=re.compile(r"/article/\d+-relx")):
        href = a["href"]
        slug_match = re.search(r"/article/(\d+-[a-z0-9-]+)", href)
        if slug_match:
            full_slug = slug_match.group(1)
            text = a.get_text(strip=True)
            discovered.append((full_slug, text, ""))

    print(f"  Discovered {len(discovered)} links from index")
    return discovered


def run():
    index = []
    failed = []

    # 1. Try to discover additional transcripts from the index page
    time.sleep(RATE_LIMIT_S)
    extra = discover_from_index()

    # Build full list — merge discovered with known, dedupe by slug
    all_known_slugs = {slug for slug, _, _ in KNOWN_TRANSCRIPTS}
    to_fetch = list(KNOWN_TRANSCRIPTS)
    for full_slug, label, date in extra:
        # full_slug may include article ID prefix like "4869266-relx-..."
        # Strip numeric prefix for SA article URLs
        if full_slug not in all_known_slugs:
            to_fetch.append((full_slug, label or "unknown", date or ""))
            all_known_slugs.add(full_slug)

    print(f"\nFetching {len(to_fetch)} transcripts...\n")

    for slug, period, date in to_fetch:
        cache_path = CACHE_DIR / f"sa_{slug}.json"

        if cache_path.exists():
            print(f"[cached]  {period}  {slug}")
            with open(cache_path) as f:
                data = json.load(f)
            index.append({"slug": slug, "period": period, "date": date, "path": str(cache_path), "turns": len(data.get("turns", []))})
            continue

        # Build URL — SA article URLs are /article/{numeric_id}-{slug}
        # If slug already starts with digits, use directly
        if re.match(r"^\d+", slug):
            url = f"https://seekingalpha.com/article/{slug}"
        else:
            # Need to find the numeric article ID — try a search
            url = f"https://seekingalpha.com/article/{slug}"

        print(f"[fetch]   {period}  {url}")
        time.sleep(RATE_LIMIT_S)

        soup = fetch_page(url)
        if not soup:
            failed.append((slug, period, "fetch_failed"))
            continue

        data = extract_transcript(soup, slug, period, date)
        if not data:
            failed.append((slug, period, "parse_failed"))
            continue

        with open(cache_path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

        n_turns = len(data.get("turns", []))
        n_paras = len(data.get("paragraphs", []))
        print(f"  ✓ {n_turns} turns, {n_paras} paragraphs → {cache_path.name}")

        index.append({
            "slug": slug,
            "period": period,
            "date": date,
            "path": str(cache_path),
            "turns": n_turns,
        })

    # Save index
    index_path = CACHE_DIR / "sa_index.json"
    with open(index_path, "w", encoding="utf-8") as f:
        json.dump({"scraped_at": datetime.utcnow().isoformat(), "transcripts": index, "failed": failed}, f, indent=2)

    print(f"\n{'='*60}")
    print(f"Done. {len(index)} cached, {len(failed)} failed.")
    if failed:
        print("Failed:")
        for slug, period, reason in failed:
            print(f"  {period}  {reason}  {slug}")
    print(f"Index saved to {index_path}")


if __name__ == "__main__":
    os.chdir(Path(__file__).parent.parent)  # run from project root
    run()
