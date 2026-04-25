# Federalist corpus — schema notes

The cross-corpus base schema is defined in [`data/SCHEMA.md`](../SCHEMA.md). This file documents only the Federalist-specific extension and the editorial calls that govern how PG #1404 is mapped into it.

## Federalist extension

Each item in `federalist.json` carries the universal base fields plus a `federalist` extension:

```json
"federalist": {
  "number": 51,
  "authorship_status": "disputed",
  "authorship_note": "One of the disputed twelve...",
  "publication": {
    "venue": "Independent Journal",
    "raw_dateline": "For the Independent Journal. Wednesday, February 6, 1788."
  }
}
```

- **`number`** — paper number, 1–85, matching the McLean's bound edition numbering used universally in modern scholarship.
- **`authorship_status`** — one of:
  - `"undisputed"` — single attributed author with no significant historical dispute
  - `"disputed"` — one of the disputed twelve (49–58, 62, 63), historically claimed by both Hamilton and Madison; modern consensus assigns to Madison
  - `"joint"` — papers 18, 19, 20, jointly authored by Madison (principal) and Hamilton
- **`authorship_note`** — `null` for undisputed; for disputed and joint papers, prose context explaining the historical claim and the basis for the modern attribution. Identical across all disputed papers and across all joint papers.
- **`publication.venue`** — newspaper or edition: `"Independent Journal"`, `"New York Packet"`, `"Daily Advertiser"`, `"McLEAN'S Edition, New York"` (papers 78–85 first appeared in McLean's bound edition rather than a newspaper).
- **`publication.raw_dateline`** — verbatim dateline from PG #1404 (whitespace collapsed to single spaces). Preserved to make any discrepancy with the parsed `date` field auditable.

ID format: `federalist:<number>`, e.g. `"federalist:51"`.

## How universal-base fields map for Federalist

- **`authors`** — modern-consensus attribution as an array of canonical surnames. For disputed papers: `["Madison"]` (the dispute is recorded in `federalist.authorship_status` and `_note`, not erased). For joint papers: `["Madison", "Hamilton"]`, in PG byline order ("MADISON, with HAMILTON" → Madison principal, Hamilton with). For undisputed: a single-name array.
- **`date`** — first publication date, ISO `YYYY-MM-DD`. Note: papers were not published in strict numerical order (papers 29 and 30 were reordered by McLean relative to their original newspaper appearance — see editorial calls below).
- **`language`** — `"en"` for every Federalist item.
- **`paragraphs`** — see editorial calls below.
- **`footnotes`** — populated from PG #1404 trailing-after-PUBLIUS blocks per the universal schema; see editorial calls below. `[]` for papers with no footnotes.
- **`plain_english`**, **`constitutional_section`**, **`topic_tags`** — universal stubs as defined in `data/SCHEMA.md`. All `null`/`[]` in Phase 0.

## Editorial calls in the parse

These reflect calls made during Phase 0; if they need to change, change the parser and regenerate.

1. **Salutation as first paragraph.** `"To the People of the State of New York:"` appears as `paragraphs[0]` on every paper. It is part of each paper as originally published; not stripped.
2. **`PUBLIUS` signature stripped.** The closing signature is metadata, not body text. Removed during parse.
3. **Footnotes structured in the `footnotes` field per the universal schema.** PG #1404 prints footnotes after the closing `PUBLIUS` signature, formatted as `N. Footnote text…` (or `EN. Editorial annotation…` for PG-transcriber notes on edition variants). The parser splits the body at `PUBLIUS`, extracts trailing blocks into `footnotes`, and stores each marker as `(N)` / `(EN)` to match the inline reference form preserved in `paragraphs`. Three PG #1404 transcription quirks surface during this split — paper 11 (PUBLIUS line concatenated with footnote 1 citation), paper 37 (closing PUBLIUS missing entirely), paper 24 (footnote 1 missing the period after the marker). Papers 11 and 37 are restored via owner-verified `SOURCE_FIXUPS` (raw-text replacements applied before block parsing, with cited sources); paper 24 is an acknowledged cosmetic source-side typo that parses correctly anyway. All three are documented in `data_quality_issues.md`.
4. **Title and dateline disambiguation.** A handful of papers (18, 39, 45, 58) merge the title with the dateline on one line in PG. Parser splits these by locating the dateline regex first; everything before is title, everything after is body.
5. **Disputed twelve attributed to Madison.** Following Mosteller and Wallace (1964). The PG #1404 byline for each of these twelve also reads `"MADISON"`. The dispute is recorded in `federalist.authorship_note`, not erased.
6. **Joint papers (18, 19, 20).** Universal `authors` carries `["Madison", "Hamilton"]`; `federalist.authorship_status` is `"joint"`. PG byline `"MADISON, with HAMILTON"` is preserved in the raw file and acknowledged in the note.
7. **Known historical reordering.** Papers 29 and 30 are excluded from the date-monotonicity anomaly check because Federalist 29 was originally numbered 35 and inserted at position 29 by McLean — the date labels are genuinely out of monotonic order, not transcription typos.
