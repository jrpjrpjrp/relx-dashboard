"""
parse_transcripts.py
Extracts text from RELX transcript and presentation PDFs.
Skips image-based PDFs (< 200 chars/page average).
Outputs: data/cache/text/{stem}.json per file + data/cache/text/index.json

Run: python scripts/parse_transcripts.py
"""

import json
import re
import os
from pathlib import Path
from datetime import datetime

import pdfplumber

TRANSCRIPT_DIR = Path("transcripts")
CACHE_DIR = Path("data/cache/text")
CACHE_DIR.mkdir(parents=True, exist_ok=True)

# Min avg chars/page to consider text-extractable (skip image-based slides)
MIN_CHARS_PER_PAGE = 200

# Map filename stems to metadata
FILE_META = {
    # FY results transcripts
    "results-2025-transcript":          {"period": "FY2025", "date": "2026-02-12", "type": "earnings_call"},
    "results-2024-transcript":          {"period": "FY2024", "date": "2025-02-13", "type": "earnings_call"},
    "results-2023-transcript":          {"period": "FY2023", "date": "2024-02-22", "type": "earnings_call"},
    "results-2022-transcript":          {"period": "FY2022", "date": "2023-02-23", "type": "earnings_call"},
    "results-2021-transcript":          {"period": "FY2021", "date": "2022-02-17", "type": "earnings_call"},
    "results-2020-transcript":          {"period": "FY2020", "date": "2021-02-18", "type": "earnings_call"},
    "2020-02-13-results-presentation-transcript": {"period": "FY2019", "date": "2020-02-13", "type": "earnings_call"},
    "2019-07-25 RELX HY 2019 results transcript":  {"period": "H12019", "date": "2019-07-25", "type": "earnings_call"},
    # H1 / interim results transcripts
    "first-half-results-2025-transcript": {"period": "H12025", "date": "2025-07-24", "type": "earnings_call"},
    "first-half-results-2024-transcript": {"period": "H12024", "date": "2024-07-25", "type": "earnings_call"},
    "interim-results-2022-transcript":    {"period": "H12022", "date": "2022-07-28", "type": "earnings_call"},
    "relx-interims-2020-transcript":      {"period": "H12020", "date": "2020-07-30", "type": "earnings_call"},
    # Risk segment deep-dives
    "risk-seminar-2023-transcript":   {"period": "2023", "date": "2023-11-09", "type": "investor_day", "segment": "Risk"},
    "risk-teach-in-transcript":       {"period": "2021", "date": "2021-10-06", "type": "investor_day", "segment": "Risk"},
    "risk-teach-in-8Nov18-transcript":{"period": "2018", "date": "2018-11-08", "type": "investor_day", "segment": "Risk"},
    "risk-teach-in-2021":             {"period": "2021", "date": "2021-10-06", "type": "investor_day_slides", "segment": "Risk"},
    # Other segment deep-dives
    "stm-seminar-2022-transcript":    {"period": "2022", "date": "2022-11-01", "type": "investor_day", "segment": "STM"},
    "legal-seminar-24-transcript":    {"period": "2024", "date": "2024-11-01", "type": "investor_day", "segment": "Legal"},
    "cr-teach-in-transcript-may-21":  {"period": "2021", "date": "2021-05-01", "type": "investor_day", "segment": "Group"},
    # Text-based presentation decks (supplementary)
    "2020-interim-presentation":      {"period": "H12020", "date": "2020-07-30", "type": "presentation"},
    "2022-interim-presentation":      {"period": "H12022", "date": "2022-07-28", "type": "presentation"},
    "2022-results-presentation":      {"period": "FY2022", "date": "2023-02-23", "type": "presentation"},
    "2023-interim-presentation":      {"period": "H12023", "date": "2023-07-27", "type": "presentation"},
    "2024results-presentation":       {"period": "FY2024", "date": "2025-02-13", "type": "presentation"},
    "legal-seminar-2024":             {"period": "2024", "date": "2024-11-01", "type": "investor_day_slides", "segment": "Legal"},
    "stm-seminar-2022-updated":       {"period": "2022", "date": "2022-11-01", "type": "investor_day_slides", "segment": "STM"},
}

# Speaker turn pattern: "First Last:" or "First Last (Role):"
SPEAKER_RE = re.compile(r"^([A-Z][a-zA-Z'\-]+(?:\s+[A-Z][a-zA-Z'\-]+){0,3})\s*(?:\([^)]+\))?\s*:\s*(.+)", re.DOTALL)


def extract_text(pdf_path: Path) -> tuple[str, float]:
    """Returns (full_text, avg_chars_per_page)."""
    pages_text = []
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            t = page.extract_text() or ""
            pages_text.append(t)
    full = "\n".join(pages_text)
    avg = len(full) / max(len(pages_text), 1)
    return full, avg


def parse_turns(text: str) -> list[dict]:
    """
    Parse speaker turns from transcript text.
    Format expected: "Speaker Name: paragraph text"
    Multiple consecutive paragraphs by same speaker are merged.
    """
    turns = []
    current_speaker = None
    current_lines = []

    for line in text.splitlines():
        line = line.strip()
        if not line:
            continue
        m = SPEAKER_RE.match(line)
        if m:
            # flush previous turn
            if current_speaker and current_lines:
                turns.append({"speaker": current_speaker, "text": " ".join(current_lines)})
            current_speaker = m.group(1).strip()
            rest = m.group(2).strip()
            current_lines = [rest] if rest else []
        else:
            if current_speaker:
                current_lines.append(line)

    if current_speaker and current_lines:
        turns.append({"speaker": current_speaker, "text": " ".join(current_lines)})

    return turns


def tag_qa_section(turns: list[dict]) -> list[dict]:
    """Mark each turn as 'prepared' or 'qa' based on Q&A section markers."""
    qa_started = False
    for turn in turns:
        lower = turn["text"].lower()
        if not qa_started and any(x in lower for x in [
            "question", "q&a", "open the line", "take question",
            "first question", "our first question"
        ]):
            qa_started = True
        turn["section"] = "qa" if qa_started else "prepared"
    return turns


def run():
    pdfs = sorted(TRANSCRIPT_DIR.glob("*.pdf"))
    index = []
    skipped = []

    print(f"Found {len(pdfs)} PDFs in {TRANSCRIPT_DIR}/\n")

    for pdf_path in pdfs:
        stem = pdf_path.stem
        cache_path = CACHE_DIR / f"{stem}.json"

        if cache_path.exists():
            print(f"[cached]  {stem}")
            d = json.loads(cache_path.read_text(encoding="utf-8"))
            index.append({"file": stem, "path": str(cache_path), **d.get("meta", {})})
            continue

        text, avg_chars = extract_text(pdf_path)

        if avg_chars < MIN_CHARS_PER_PAGE:
            print(f"[skip]    {stem}  ({avg_chars:.0f} avg chars/page - image-based)")
            skipped.append(stem)
            continue

        meta = FILE_META.get(stem, {"period": "unknown", "type": "unknown"})
        turns = parse_turns(text)

        if turns:
            turns = tag_qa_section(turns)
            fmt = "structured"
        else:
            fmt = "flat"

        doc = {
            "meta": {
                "file": stem,
                "source": "relx_ir",
                **meta,
            },
            "format": fmt,
            "char_count": len(text),
            "turn_count": len(turns),
            "turns": turns,
            "raw_text": text if fmt == "flat" else "",
            "extracted_at": datetime.now().isoformat(),
        }

        cache_path.write_text(json.dumps(doc, indent=2, ensure_ascii=False), encoding="utf-8")

        print(f"[ok]      {stem}")
        print(f"          {len(text):,} chars | {len(turns)} turns | format={fmt} | {meta.get('period','')} {meta.get('type','')}")

        index.append({"file": stem, "path": str(cache_path), **meta})

    # Save index
    idx_path = CACHE_DIR / "index.json"
    idx_path.write_text(
        json.dumps({"extracted_at": datetime.now().isoformat(), "docs": index, "skipped": skipped}, indent=2),
        encoding="utf-8"
    )

    print(f"\n{'='*60}")
    print(f"Extracted: {len(index)}  |  Skipped (image-based): {len(skipped)}")
    print(f"Index: {idx_path}")


if __name__ == "__main__":
    os.chdir(Path(__file__).parent.parent)
    run()
