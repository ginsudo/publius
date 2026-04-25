# Federalist corpus — schema

Top-level shape of `federalist.json`:

```json
{
  "source": {
    "edition": "Project Gutenberg eBook #1404 — The Federalist Papers",
    "url": "https://www.gutenberg.org/ebooks/1404",
    "sha256": "...",
    "fetched": "YYYY-MM-DD",
    "notes": "..."
  },
  "count": 85,
  "papers": [ /* Paper objects, ordered by number 1..85 */ ]
}
```

Each paper:

```json
{
  "number": 10,
  "title": "The Same Subject Continued (The Union as a Safeguard Against Domestic Faction and Insurrection)",
  "attributed_author": "Madison",
  "authorship_status": "undisputed",
  "authorship_note": null,
  "publication": {
    "venue": "Daily Advertiser",
    "date": "1787-11-22"
  },
  "paragraphs": ["...", "..."],
  "plain_english": null,
  "constitutional_section": null,
  "topic_tags": []
}
```

## Field semantics

- **`number`** — Federalist paper number, 1 through 85, matching the McLean's bound edition numbering used universally in modern scholarship.

- **`title`** — Title as it appears in PG #1404, normalized to a single line. Many papers in the original carry the form *"The Same Subject Continued (Subtopic)"* — preserved verbatim rather than rewritten to scholarly conventions.

- **`attributed_author`** — Modern scholarly attribution. One of `"Hamilton"`, `"Madison"`, `"Jay"`, or `"Hamilton and Madison"`. For the disputed twelve, attribution follows the Mosteller-Wallace (1964) consensus assigning all twelve to Madison.

- **`authorship_status`** — One of:
  - `"undisputed"` — single attributed author with no significant historical dispute
  - `"disputed"` — one of the disputed twelve (49–58, 62, 63), historically claimed by both Hamilton and Madison; modern consensus assigns to Madison
  - `"joint"` — papers 18, 19, 20, jointly authored by Madison (principal) and Hamilton

- **`authorship_note`** — `null` for undisputed papers. For disputed and joint papers, a short prose note explaining the historical claim and the basis for the modern attribution. The note is identical across all disputed papers and across all joint papers; per-paper detail is not encoded.

- **`publication.venue`** — The newspaper or edition in which the paper first appeared. Values seen in PG #1404: `"Independent Journal"`, `"New York Packet"`, `"Daily Advertiser"`, `"McLEAN'S Edition, New York"` (papers 78–85 first appeared in McLean's bound edition rather than a newspaper).

- **`publication.date`** — ISO `YYYY-MM-DD` date of first publication. Stored exactly as the dateline in PG #1404 reads, even where the dateline is a known transcription artifact (see `data_quality_issues.md`). The papers were *not* published in strict numerical order — McLean's bound edition reordered some papers (notably 29 and 30) relative to their original newspaper appearance.

- **`paragraphs`** — Body of the paper, in source order. The opening salutation `"To the People of the State of New York:"` is included as the first paragraph. Closing `PUBLIUS` signature lines are stripped. Footnotes that appear after the signature in PG #1404 are preserved as additional paragraphs at the end of the array (a future schema revision may separate them into a dedicated field once the editorial standard is set). Internal line wrapping is collapsed to single spaces.

- **`plain_english`** — `null` in the Phase 0 corpus. Reserved for the plain-English rendering that is the project's central editorial work, generated in a later phase via Claude Batch API and reviewed by the project owner.

- **`constitutional_section`** — `null` in the Phase 0 corpus. Reserved for a later phase that maps each paper to the constitutional provisions it argues about (e.g., Article I §8, Tenth Amendment).

- **`topic_tags`** — `[]` in the Phase 0 corpus. Reserved for a later phase.

## What is intentionally NOT in this schema

- **No per-paper `source` field.** Every paper in this corpus comes from the same edition; the `source` block is held once at the top level. The originally-discussed schema put `source` on each paper — that was redundant and dropped before parser implementation.

- **No `byline_in_source` field.** What PG #1404 prints as the byline ("HAMILTON" / "MADISON" / "JAY" / "MADISON, with HAMILTON") is preserved in the raw source file; it is not duplicated into the structured corpus. The structured fields (`attributed_author`, `authorship_status`) carry the modern scholarly attribution.

- **No separate footnotes field.** Footnote text appears as trailing paragraphs. Splitting it out is deferred until the editorial standard for footnote presentation is decided.

- **No paragraph IDs.** Paragraphs are addressed by array index. If stable cross-edition citation becomes necessary, IDs can be added later.
