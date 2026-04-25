# Publius corpus schema

This document defines the shared base schema that every corpus in `/data/` must conform to. The rule is: a single retrieval layer, a single Q&A layer, and a single citation layer must work across all corpora without special-casing per corpus. Corpus-specific information lives in a typed extension namespace under each item.

Adding a new corpus means: define its extension, conform to the base, parameterize any new ingestion. It must not require rebuilding retrieval, Q&A, or citation.

This is a Phase 0 / pre-Phase 1 design document. It supersedes any per-corpus schema doc that predates it.

## Top-level file shape

Every corpus produces one JSON file with the same top-level shape:

```json
{
  "corpus": "federalist",
  "source": {
    "edition": "...",
    "url": "...",
    "sha256": "...",
    "fetched": "YYYY-MM-DD",
    "notes": "..."
  },
  "count": 85,
  "items": [ /* Item objects */ ]
}
```

- **`corpus`** — slug identifying which corpus this file holds. Must match the per-item `corpus` field on every item. Current values: `"federalist"`, `"tocqueville"`, `"court"`. Future corpora extend this set, but only after the open question on epistemic tagging (CLAUDE.md, "fourth epistemic category") is resolved.
- **`source`** — corpus-level provenance. Applies to all items unless an individual item carries its own `source` override.
- **`count`** — `items.length`. Sanity field; emitted by the parser; verified by consumers.
- **`items`** — the corpus content, in canonical corpus order (paper number for Federalist, volume/part/chapter for Tocqueville, decision date for SCOTUS).

## Item — universal base

Every item, regardless of corpus, has these fields:

```json
{
  "id": "federalist:51",
  "corpus": "federalist",
  "title": "The Structure of the Government Must Furnish the Proper Checks and Balances Between the Different Departments.",
  "authors": ["Madison"],
  "date": "1788-02-06",
  "language": "en",
  "paragraphs": ["...", "..."],
  "plain_english": null,
  "constitutional_section": null,
  "topic_tags": [],

  "federalist": { /* corpus-specific extension; exactly one of federalist/tocqueville/court is populated */ }
}
```

### Field semantics (universal)

- **`id`** — globally unique, human-readable string of the form `<corpus>:<locator>`. The locator is a stable identifier within the corpus; format is corpus-specific (see extensions below). IDs are addressable, citeable, and used as primary keys in the vector store.

- **`corpus`** — slug, must match the file's top-level `corpus`. Carried per-item so items remain identifiable when loaded into a unified index.

- **`title`** — human-readable label as it appears in the canonical source. Not editorialized.

- **`authors`** — array of canonical author names, in source-attribution order. Always at least one entry. For corpora where authorship is contested or joint, this field carries the modern-consensus attribution; the dispute or joint nature is documented in the corpus extension. Author-name format follows project convention: surname only for canonical figures (`"Madison"`, `"Hamilton"`, `"Tocqueville"`); full name when ambiguity requires it (`"John Marshall Harlan"`).

- **`date`** — ISO `YYYY-MM-DD` of the canonical date for the item. Publication date for Federalist, decision date for SCOTUS, original publication date for Tocqueville chapters (volume-level: 1835 or 1840; chapter-level may not have a finer date — `null` is valid).

- **`language`** — IETF language tag for `paragraphs` content. `"en"` for Federalist and SCOTUS (English source); `"fr"` for Tocqueville (French source). Independent of `plain_english`, which is always English.

- **`paragraphs`** — body of the item in source order, as an array of strings. Internal line wrapping collapsed; structural paragraph breaks preserved. Salutations, headings, and footnotes that appear in the source are preserved as paragraphs unless the corpus extension specifies different handling.

- **`plain_english`** — modern English rendering of the item's substance, generated via Claude Batch API and reviewed by the project owner. `null` until generated. Always English regardless of source `language`.

- **`constitutional_section`** — string identifying the constitutional provision this item argues about, observes, or interprets (e.g., `"Article I, §8"`, `"Tenth Amendment"`, `"Article III, §2"`). `null` where the connection is not editorially asserted. Universal field, but coverage is uneven by corpus: Federalist and SCOTUS items are organized around constitutional structure and are expected to populate this field densely; Tocqueville is organized by observed pattern, not by provision, and coverage will be sparse and editorially discretionary. Do not use this field as a cross-corpus filter or retrieval key until after editorial review of every corpus is complete (see DECISIONS.md).

- **`topic_tags`** — array of free-form topical tags assigned editorially. `[]` until populated.

- **Corpus extension** — exactly one of `federalist`, `tocqueville`, `court` is populated per item, matching the item's `corpus` value. See per-corpus extensions below.

### Optional per-item override

- **`source`** — same shape as the top-level `source`. Used when an individual item's provenance differs from the corpus-level source (expected pattern for SCOTUS, where each opinion may come from a different repository). Absent on items that inherit the corpus-level source (expected pattern for Federalist and Tocqueville).

## Corpus extensions

### Federalist (`federalist`)

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

- **`number`** — paper number, 1–85, matching McLean's bound edition.
- **`authorship_status`** — `"undisputed"` | `"disputed"` | `"joint"`. The disputed twelve (49–58, 62, 63) and the three joint papers (18, 19, 20) carry their own statuses; everything else is `"undisputed"`.
- **`authorship_note`** — prose context for `disputed` and `joint` papers; `null` for undisputed.
- **`publication.venue`** — newspaper or edition name.
- **`publication.raw_dateline`** — verbatim dateline from the source, preserved for editorial review.

ID format: `federalist:<number>`, e.g., `"federalist:51"`.

### Tocqueville (`tocqueville`)

```json
"tocqueville": {
  "volume": 1,
  "part": 2,
  "chapter": 7,
  "chapter_title": "De l'omnipotence de la majorité aux États-Unis et de ses effets"
}
```

- **`volume`** — 1 (1835) or 2 (1840).
- **`part`** — part number within the volume.
- **`chapter`** — chapter number within the part.
- **`chapter_title`** — chapter title in the source language.

The smallest addressable unit is the chapter. Sub-sections (where a chapter has internal headings) are flattened into `paragraphs`. The internal heading appears as its own paragraph in the array if it appears in the source.

ID format: `tocqueville:vol<volume>.part<part>.ch<chapter>`, e.g., `"tocqueville:vol1.part2.ch7"`.

### Court (`court`)

```json
"court": {
  "case_id": "marbury_v_madison",
  "case_name": "Marbury v. Madison",
  "citation": "5 U.S. 137",
  "opinion_type": "majority",
  "joining_justices": []
}
```

- **`case_id`** — slug joining all opinion items belonging to the same case. Snake-case, lowercase.
- **`case_name`** — display name in standard legal-citation form.
- **`citation`** — official reporter citation.
- **`opinion_type`** — `"majority"` | `"plurality"` | `"concurrence"` | `"dissent"` | `"per_curiam"`. Each opinion is a separate item.
- **`joining_justices`** — array of justices who joined this opinion (excluding its author). Empty for solo opinions and per curiam.

ID format: `court:<case_id>:<opinion_type>` for single opinions of a given type, or `court:<case_id>:<opinion_type>:<author_lastname>` when multiple opinions of the same type appear in the same case (e.g., two dissents). Examples: `"court:marbury_v_madison:majority"`, `"court:lochner_v_new_york:dissent:holmes"`.

The author of the opinion appears in the universal `authors` field. Joining justices stay in the extension because they are joiners, not authors of *this* opinion.

## What is intentionally NOT in the schema

- **No `byline_in_source` field.** The source text itself preserves what each source prints. Structured fields carry modern-consensus attribution.
- **No paragraph IDs.** Paragraphs are addressed by `(item_id, array_index)`. Stable cross-edition IDs can be added later if citation needs require it.
- **No nested opinions for SCOTUS.** Each opinion is a separate item, joined by `case_id`. A dissent is its own argumentative voice and warrants first-class addressability.
- **No `chunks` field.** Vector-store chunking is a downstream concern produced from `paragraphs`, not a corpus-storage concern.

## Versioning

This schema is v1. Breaking changes require a version bump and an explicit migration of every corpus file. Additive changes (new optional fields) do not require a version bump.

When the open question on the fourth epistemic category resolves and a fourth corpus is added, this document gets a new corpus extension section — not a new base.
