"""
build_intel_corpus.py
Sends LNRS-relevant content to Claude Sonnet and builds the intelligence corpus.
Outputs: data/relx-intel-corpus.json
         data/cache/intel/{stem}_extracted.json  (per-doc cache)

Cost tracking: alerts every $1. Hard stop at $10.
Run: python scripts/build_intel_corpus.py
"""

import json
import re
import os
import time
from pathlib import Path

import anthropic

# ── Config ────────────────────────────────────────────────────────────────────
MODEL = "claude-sonnet-4-6"
CACHE_DIR = Path("data/cache/intel")
CACHE_DIR.mkdir(parents=True, exist_ok=True)
OUTPUT_PATH = Path("data/relx-intel-corpus.json")

# Sonnet 4.6 pricing (per million tokens)
PRICE_INPUT  = 3.00
PRICE_OUTPUT = 15.00

BUDGET_HARD_STOP  = 10.00
BUDGET_ALERT_EACH = 1.00

# LNRS relevance filter — applied before any API call
LNRS_RE = re.compile(
    r"\b(risk\s+(?:solutions?|division|business|segment)|lnrs|lexisnexis\s+risk|"
    r"risk\s+analytics|insurance|telematics|fraud\s+(?:and|&|detection)|"
    r"financial\s+crime|identity\s+(?:verification|fraud|solutions?)|"
    r"digital\s+fraud|kyc|aml|compliance|screening|"
    r"government\s+(?:and|&|,)\s+law|law\s+enforcement|"
    r"verisk|accurint|fleetcross|transunion|equifax|lexid|"
    r"mark\s+kelsey|bill\s+lott|"
    r"risk\s+revenue|risk\s+margin|risk\s+profit|"
    r"machine.?learning|ai.{0,20}risk|risk.{0,20}ai|"
    r"underlying\s+(?:revenue\s+)?growth.{0,30}risk|risk.{0,30}growth)",
    re.IGNORECASE,
)

SYSTEM_PROMPT = """You are a financial research analyst extracting structured intelligence about RELX's Risk Solutions division (also called LNRS - LexisNexis Risk Solutions) from earnings transcripts and annual report text.

For each piece of text provided, extract ALL relevant information and return a JSON array of chunks. Each chunk must follow this schema exactly:

{
  "chunk_type": "management_remark" | "qa_exchange" | "mda_narrative",
  "speaker": string | null,           // executive name if known
  "analyst": string | null,           // analyst name for qa_exchange
  "analyst_firm": string | null,      // analyst firm for qa_exchange
  "question_text": string | null,     // verbatim question for qa_exchange
  "response_text": string | null,     // verbatim response for qa_exchange
  "text": string,                     // full verbatim text (or response if qa_exchange)
  "lnrs_relevance": "direct" | "indirect",  // direct = explicitly about Risk/LNRS; indirect = adjacent context
  "topics": string[],                 // e.g. ["AI", "pricing", "margins", "insurance", "fraud", "identity", "government", "international", "competitive", "M&A", "capex", "guidance"]
  "quant_mentions": string[],         // any numbers/metrics stated, e.g. ["revenue growth 8%", "margin 37.4%", "£3.5B revenue"]
  "sentiment": "positive" | "neutral" | "cautious" | "negative",
  "forward_looking": boolean          // true if contains guidance, outlook, or forward-looking statements
}

Rules:
- Keep question_text and response_text verbatim — do not paraphrase
- For qa_exchange: text = response_text (for easy searching)
- If a turn is not about Risk/LNRS at all, omit it entirely
- Be generous with indirect relevance — include anything that provides context for Risk performance
- topics should be specific and consistent across documents
- Return ONLY a valid JSON array, no preamble or explanation"""


class CostTracker:
    def __init__(self):
        self.total_input = 0
        self.total_output = 0
        self.last_alert_threshold = 0.0

    def add(self, input_tokens: int, output_tokens: int):
        self.total_input += input_tokens
        self.total_output += output_tokens
        cost = self.cost()
        if cost >= BUDGET_HARD_STOP:
            raise RuntimeError(f"HARD STOP: budget ${BUDGET_HARD_STOP} reached. Total: ${cost:.2f}")
        while cost >= self.last_alert_threshold + BUDGET_ALERT_EACH:
            self.last_alert_threshold += BUDGET_ALERT_EACH
            print(f"\n*** COST ALERT: ${self.last_alert_threshold:.0f} spent so far (${cost:.2f} total) ***\n")

    def cost(self) -> float:
        return (self.total_input * PRICE_INPUT + self.total_output * PRICE_OUTPUT) / 1_000_000

    def summary(self) -> str:
        return (f"Tokens: {self.total_input:,} in / {self.total_output:,} out | "
                f"Cost: ${self.cost():.3f}")


def is_lnrs_relevant(text: str) -> bool:
    return bool(LNRS_RE.search(text))


def extract_lnrs_turns(doc: dict) -> list[dict]:
    """Filter transcript turns to LNRS-relevant ones. Keeps Q&A pairs intact."""
    turns = doc.get("turns", [])
    if not turns:
        return []

    relevant = []
    i = 0
    while i < len(turns):
        turn = turns[i]
        text = turn.get("text", "")

        # For Q&A section, try to keep question+answer as a unit
        section = turn.get("section", "prepared")
        if section == "qa" and i + 1 < len(turns):
            next_turn = turns[i + 1]
            combined = text + " " + next_turn.get("text", "")
            if is_lnrs_relevant(combined):
                relevant.append({"q": turn, "a": next_turn, "paired": True})
                i += 2
                continue

        if is_lnrs_relevant(text):
            relevant.append({"q": None, "a": turn, "paired": False})
        i += 1

    return relevant


def build_prompt_for_transcript(turns_data: list[dict], meta: dict) -> str:
    """Format filtered turns into a prompt payload."""
    lines = [f"SOURCE: {meta.get('source_type','earnings_call')} | {meta.get('period','')} | {meta.get('date','')}"]
    lines.append("=" * 60)

    for item in turns_data:
        if item["paired"]:
            q, a = item["q"], item["a"]
            lines.append(f"\n[ANALYST — {q.get('speaker','Unknown')}]")
            lines.append(q.get("text", ""))
            lines.append(f"\n[MANAGEMENT — {a.get('speaker','Unknown')}]")
            lines.append(a.get("text", ""))
        else:
            a = item["a"]
            lines.append(f"\n[SPEAKER — {a.get('speaker','Unknown')}]")
            lines.append(a.get("text", ""))

    return "\n".join(lines)


def build_prompt_for_mda(risk_text: str, year: int) -> str:
    return f"SOURCE: 20-F Annual Report MD&A | FY{year}\n{'='*60}\n{risk_text}"


def call_claude(client: anthropic.Anthropic, prompt: str, tracker: CostTracker) -> list[dict]:
    """Send prompt to Claude, parse JSON response, track cost."""
    response = client.messages.create(
        model=MODEL,
        max_tokens=8192,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": prompt}],
    )
    tracker.add(response.usage.input_tokens, response.usage.output_tokens)

    raw = response.content[0].text.strip()
    # Strip markdown code fences if present
    raw = re.sub(r"^```(?:json)?\s*", "", raw)
    raw = re.sub(r"\s*```$", "", raw)

    try:
        chunks = json.loads(raw)
        if not isinstance(chunks, list):
            chunks = [chunks]
        return chunks
    except json.JSONDecodeError as e:
        print(f"  [warn] JSON parse error: {e}")
        print(f"  Raw response (first 500): {raw[:500]}")
        return []


def process_transcript(client, doc_path: Path, tracker: CostTracker) -> list[dict]:
    stem = doc_path.stem
    cache_path = CACHE_DIR / f"{stem}_extracted.json"

    if cache_path.exists():
        print(f"  [cached] {stem}")
        return json.loads(cache_path.read_text(encoding="utf-8"))

    doc = json.loads(doc_path.read_text(encoding="utf-8"))
    meta = doc.get("meta", {})

    # Structured (turns parsed)
    if doc.get("format") == "structured" and doc.get("turns"):
        turns_data = extract_lnrs_turns(doc)
        if not turns_data:
            print(f"  [skip] {stem} — no LNRS-relevant turns")
            cache_path.write_text("[]", encoding="utf-8")
            return []

        print(f"  [extract] {stem} — {len(turns_data)} relevant turns")

        # Batch into groups of 15 turns to manage token size
        all_chunks = []
        batch_size = 6
        for i in range(0, len(turns_data), batch_size):
            batch = turns_data[i:i + batch_size]
            prompt = build_prompt_for_transcript(batch, meta)
            chunks = call_claude(client, prompt, tracker)
            # Stamp source metadata onto each chunk
            for c in chunks:
                c["source_file"] = stem
                c["source_type"] = meta.get("type", "earnings_call")
                c["period"] = meta.get("period", "")
                c["date"] = meta.get("date", "")
                c["segment_focus"] = meta.get("segment", "")
            all_chunks.extend(chunks)
            time.sleep(0.5)

    else:
        # Flat text — chunk by size, filter by keyword
        raw_text = doc.get("raw_text", "") or "\n".join(
            t.get("text", "") for t in doc.get("turns", [])
        )
        if not raw_text:
            cache_path.write_text("[]", encoding="utf-8")
            return []

        # Split into ~3000-char chunks with overlap
        chunk_size = 3000
        overlap = 300
        text_chunks = []
        pos = 0
        while pos < len(raw_text):
            text_chunks.append(raw_text[pos:pos + chunk_size])
            pos += chunk_size - overlap

        relevant_chunks = [c for c in text_chunks if is_lnrs_relevant(c)]
        if not relevant_chunks:
            print(f"  [skip] {stem} — no LNRS keywords in flat text")
            cache_path.write_text("[]", encoding="utf-8")
            return []

        print(f"  [extract-flat] {stem} — {len(relevant_chunks)}/{len(text_chunks)} chunks relevant")
        all_chunks = []
        for chunk_text in relevant_chunks:
            prompt = f"SOURCE: {meta.get('type','transcript')} | {meta.get('period','')} | {meta.get('date','')}\n{'='*60}\n{chunk_text}"
            chunks = call_claude(client, prompt, tracker)
            for c in chunks:
                c["source_file"] = stem
                c["source_type"] = meta.get("type", "earnings_call")
                c["period"] = meta.get("period", "")
                c["date"] = meta.get("date", "")
                c["segment_focus"] = meta.get("segment", "")
            all_chunks.extend(chunks)
            time.sleep(0.5)

    cache_path.write_text(json.dumps(all_chunks, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"    -> {len(all_chunks)} chunks extracted | {tracker.summary()}")
    return all_chunks


def process_mda(client, year: int, tracker: CostTracker) -> list[dict]:
    risk_path = Path("data/cache/mda") / f"{year}_risk.txt"
    cache_path = CACHE_DIR / f"mda_{year}_extracted.json"

    if cache_path.exists():
        print(f"  [cached] FY{year} MD&A")
        return json.loads(cache_path.read_text(encoding="utf-8"))

    if not risk_path.exists():
        print(f"  [missing] FY{year} risk text — run fetch_edgar_mda.py first")
        return []

    risk_text = risk_path.read_text(encoding="utf-8")
    if len(risk_text) < 500:
        print(f"  [thin] FY{year} MD&A risk section too small ({len(risk_text)} chars) — skipping")
        cache_path.write_text("[]", encoding="utf-8")
        return []

    print(f"  [extract] FY{year} MD&A — {len(risk_text):,} chars")
    prompt = build_prompt_for_mda(risk_text, year)
    chunks = call_claude(client, prompt, tracker)
    for c in chunks:
        c["source_file"] = f"20f_{year}"
        c["source_type"] = "mda_narrative"
        c["period"] = f"FY{year}"
        c["date"] = f"{year}-02-01"
        c["segment_focus"] = "Risk"

    cache_path.write_text(json.dumps(chunks, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"    -> {len(chunks)} chunks extracted | {tracker.summary()}")
    return chunks


def run():
    client = anthropic.Anthropic()
    tracker = CostTracker()
    all_chunks = []

    # ── Transcripts ────────────────────────────────────────────────────────
    text_index = json.loads(Path("data/cache/text/index.json").read_text(encoding="utf-8"))

    # Prioritise by relevance: Risk-specific docs first, then earnings calls
    def sort_key(d):
        seg = d.get("segment", "")
        src = d.get("type", "")
        if seg == "Risk": return 0
        if "investor_day" in src: return 1
        if "earnings_call" in src: return 2
        return 3

    docs = sorted(text_index["docs"], key=sort_key)

    print(f"Processing {len(docs)} transcript docs...\n")
    for doc_meta in docs:
        doc_path = Path("data/cache/text") / f"{doc_meta['file']}.json"
        if not doc_path.exists():
            continue
        try:
            chunks = process_transcript(client, doc_path, tracker)
            all_chunks.extend(chunks)
        except RuntimeError as e:
            print(f"\n{e}")
            break

    # ── 20-F MD&A ──────────────────────────────────────────────────────────
    print(f"\nProcessing 20-F MD&A sections...\n")
    for year in range(2025, 2018, -1):
        try:
            chunks = process_mda(client, year, tracker)
            all_chunks.extend(chunks)
        except RuntimeError as e:
            print(f"\n{e}")
            break

    # ── Deduplicate & assign IDs ───────────────────────────────────────────
    seen = set()
    unique_chunks = []
    for i, c in enumerate(all_chunks):
        key = (c.get("source_file", ""), c.get("text", "")[:100])
        if key not in seen:
            seen.add(key)
            c["id"] = f"chunk_{i:04d}"
            unique_chunks.append(c)

    # ── Output ─────────────────────────────────────────────────────────────
    output = {
        "generated_at": __import__("datetime").datetime.now().isoformat(),
        "model": MODEL,
        "total_chunks": len(unique_chunks),
        "cost_summary": tracker.summary(),
        "chunks": unique_chunks,
    }
    OUTPUT_PATH.write_text(json.dumps(output, indent=2, ensure_ascii=False), encoding="utf-8")

    print(f"\n{'='*60}")
    print(f"Corpus complete: {len(unique_chunks)} chunks -> {OUTPUT_PATH}")
    print(tracker.summary())


if __name__ == "__main__":
    os.chdir(Path(__file__).parent.parent)
    run()
