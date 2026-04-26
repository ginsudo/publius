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
  "footnotes": [],
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

- **`paragraphs`** — body of the item in source order, as an array of strings. Internal line wrapping collapsed; structural paragraph breaks preserved. Salutations and headings that appear in the source are preserved as paragraphs unless the corpus extension specifies different handling. Footnote bodies are *not* in `paragraphs` — they live in the `footnotes` field; the inline marker that references each footnote stays in `paragraphs` exactly as printed.

- **`footnotes`** — array of footnote objects in source order. Empty array (`[]`) when the item has no footnotes. Each footnote has the shape:
  ```json
  {
    "marker": "(1)",
    "paragraphs": ["Vide Constitution of Massachusetts, Chapter 2, Section 1, Article 13."]
  }
  ```
  - **`marker`** — the marker as it appears *inline in the body*, preserving the source's marker style: `"(1)"` (Federalist), `"1"` (typical SCOTUS), `"A"` (Tocqueville end-note reference). String, not number — corpora vary in marker style and a string accommodates all. **Markers must be unique within a single item's `footnotes` array** — this invariant is what makes inline marker → footnote lookup by string equality reliable.
  - **`paragraphs`** — body of the footnote in source order, as an array of strings. Same paragraph treatment as the item-level `paragraphs` field. A single-paragraph footnote has a one-element array.

  Inline references stay in the item's `paragraphs` exactly as printed — e.g., body text reads `…permanent(1) salaries should be established…` or `…tyranny of the majority.*` Retrieval, citation, and rendering layers resolve marker → footnote within the same item by string equality on `marker`.

- **`plain_english`** — modern-English rendering of an English-source item, register-shifted (archaic / formal → readable contemporary English) but **not** translated. `string[]` aligned with `paragraphs` — same length, same paragraph order. Generated via Claude Batch API and reviewed by the project owner. Always `null` on items whose `language` is not `"en"` — cross-language rendering is editorial intellectual work with distinct copyright and review workflows, and lives in the corpus extension's `translation` field, not here. `null` on English-source items until generated. See DECISIONS.md, "Translation vs plain-English."

- **`constitutional_section`** — string identifying the constitutional provision this item argues about, observes, or interprets (e.g., `"Article I, §8"`, `"Tenth Amendment"`, `"Article III, §2"`). `null` where the connection is not editorially asserted. Universal field, but coverage is uneven by corpus: Federalist and SCOTUS items are organized around constitutional structure and are expected to populate this field densely; Tocqueville is organized by observed pattern, not by provision, and coverage will be sparse and editorially discretionary. Do not use this field as a cross-corpus filter or retrieval key until after editorial review of every corpus is complete (see DECISIONS.md).

- **`topic_tags`** — array of free-form topical tags assigned editorially. `[]` until populated.

- **Corpus extension** — exactly one of `federalist`, `tocqueville`, `court` is populated per item, matching the item's `corpus` value. See per-corpus extensions below.

### Footnotes — corpus-specific expectations

- **Federalist:** Most papers carry no footnotes (`footnotes: []`). A handful (notably 78, plus shorter notes elsewhere) have authorial footnotes that PG #1404 prints after the closing `PUBLIUS` signature, formatted as `N. Footnote text…` blocks. These populate the `footnotes` array; the inline reference form `(N)` is preserved verbatim in `paragraphs`. The marker stored on each footnote is the inline form `"(N)"`, not the bare `"N"` from the trailing label, so string equality on the marker resolves the lookup directly.
- **Tocqueville:** Heavy footnote use. In-chapter authorial footnotes populate `footnotes` with markers like `"[1]"`. The lettered end-notes (Vol I tome 1 notes A..U; Vol I tome 2 notes A..F; Vol II tome 4 notes TN-A..TN-H) are substantive enough to be **standalone items** — IDs `tocqueville:vol1.t1.notes.A`, `tocqueville:vol1.t2.notes.A`, `tocqueville:vol2.t4.notes.TN-A`, etc. — not entries in any chapter's `footnotes` array. End-note IDs scope by *tome* because the Pagnerre 1848 edition resets the lettering per tome, so a globally unique ID needs the tome segment. The chapter that references an end-note preserves the marker (`[A]`, `[TN-A]`, etc., as printed) inline in its `paragraphs[]` or `title`; the end-note item lives separately and is independently retrievable. This is the only case where a footnote-shaped reference resolves to a different item rather than to the same item's `footnotes` field.
- **SCOTUS:** Each opinion's footnote sequence populates that opinion's `footnotes` array. Footnotes carry independent argumentative weight (Carolene Products n.4 being the canonical example) and must remain first-class addressable. A footnote in the majority and a footnote in the dissent are in *different items*; marker uniqueness is per-item, not per-case.

When a chapter title or opinion heading itself carries a footnote (rare in Federalist, occasional in Tocqueville and SCOTUS), the marker is preserved in the universal `title` field; the footnote sits in `footnotes` like any other (or, for Tocqueville end-note references, resolves to the standalone end-note item).

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
  "kind": "chapter",
  "chapter_summary": "Comment l'omnipotence de la majorité augmente, en Amérique, l'instabilité législative...",
  "references_page": null,
  "tome": 2,
  "end_notes_referenced": [],
  "translation": null
}
```

- **`volume`** — 1 (1835) or 2 (1840).
- **`part`** — part number within the volume. `null` for items that don't belong to a part (avertissements, the Vol I introduction, end-notes, the appendix).
- **`chapter`** — chapter number within the part. `null` for non-chapter items.
- **`kind`** — one of `"avertissement"` | `"introduction"` | `"chapter"` | `"end_note"` | `"appendix"`. Discriminates the item shape; the universal `title` field carries the source-language label.
- **`chapter_summary`** — the bullet-summary block that the Pagnerre 1848 edition prints between each Vol I tome 1 chapter title and its body. Populated only on Vol I tome 1 chapters; `null` everywhere else, including Vol I tome 2 chapters where the source carries no such block. The block is a navigational summary in Tocqueville's own hand and is preserved as a single string with the `--` separators normalized to spaces.
- **`references_page`** — for `kind: "end_note"` items only, the page number in the source-edition body that the end-note glosses (e.g., `81` for Tome 4 note TN-A "NOTE PAGE 81."). `null` for all other kinds.
- **`tome`** — 1, 2, 3, or 4. Identifies the PG source file the item came from (PG #30513–#30516). Vol I = tomes 1+2; Vol II = tomes 3+4. Carried per-item so end-note ID disambiguation (next bullet) is auditable and so source provenance is retrievable without re-deriving from `volume` + `part`.
- **`end_notes_referenced`** — array of end-note IDs (e.g., `["tocqueville:vol1.t1.notes.A"]`) that this item references. Populated editorially in Phase 4 once the inline-text → end-note mapping has been hand-verified. Empty array (`[]`) in Phase 0; not derivable from the source by pattern alone (the Pagnerre 1848 edition uses prose references like "voyez la note A" rather than a uniform inline marker), so this stays a deliberate editorial field rather than an auto-generated one.
- **`translation`** — English translation of the item's body. `string[]` aligned with `paragraphs` — same length, same paragraph order. `null` until populated in Phase 4. Distinct from the universal `plain_english`: translation is cross-language work, authored by the project owner under the editorial standard in DECISIONS.md ("Tocqueville: French original as source of record"), with copyright and review implications that same-language register modernization in `plain_english` does not have. Tocqueville items always carry `plain_english: null`; the modern-English rendering of a Tocqueville item lives here. Footnote-body translation shape is additive when the Phase 4 pipeline is built. See DECISIONS.md, "Translation vs plain-English."

The smallest addressable unit is the chapter. Sub-sections (where a chapter has internal headings) are flattened into `paragraphs`. The internal heading appears as its own paragraph in the array if it appears in the source.

ID format depends on `kind`:
- **Chapters:** `tocqueville:vol<volume>.part<part>.ch<chapter>`, e.g., `"tocqueville:vol1.part2.ch7"`.
- **Avertissements:** `tocqueville:vol<volume>.avertissement` — Vol I's "Avertissement de la dixième édition" (composed for the Pagnerre 1848 reprint) and Vol II's original "Avertissement" both fit this pattern.
- **Introductions:** `tocqueville:vol<volume>.introduction` — Vol I's introduction. Vol I's Part II opens (in tome 2) with an unmarked authorial preamble that is captured as `tocqueville:vol1.preamble.part2` with `kind: "introduction"`; it has no equivalent in Vol II.
- **End-notes:** `tocqueville:vol<volume>.t<tome>.notes.<letter>` — letters in the Pagnerre 1848 edition reset per *tome* (not per volume), so Vol I tome 1 carries notes A..U and Vol I tome 2 carries its own A..F. The `t<tome>` segment in the ID disambiguates them. Vol II tome 4 uses `TN-` prefixed letters (`TN-A` through `TN-H`) per the PG transcriber convention; the ID preserves the prefix: `tocqueville:vol2.t4.notes.TN-A`.
- **Appendix:** `tocqueville:vol<volume>.appendix` — the "Examen comparatif de la Démocratie aux États-Unis et en Suisse" essay, also added in the Pagnerre 1848 reprint and attached to Vol I.

Markers in chapter titles: Vol II (tomes 3 and 4) chapters occasionally carry an inline footnote or end-note marker as part of the chapter's title text (e.g., tome 4 ch. XVI ends "...que celle des Anglais[TN-C]."). These markers are preserved verbatim in the universal `title` field and resolve to the same item's `footnotes` array (numeric markers) or to a standalone end-note item (TN markers) by string equality, identical to in-body markers.

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
- **No back-reference field on footnotes.** Each footnote does not store the paragraph index that references it. The link is the marker, preserved inline in `paragraphs`. If the editorial workflow later needs precomputed back-references, they can be derived; storing them in source data introduces a brittle redundancy.

## Versioning

This schema is v1. Breaking changes require a version bump and an explicit migration of every corpus file. Additive changes (new optional fields) do not require a version bump.

When the open question on the fourth epistemic category resolves and a fourth corpus is added, this document gets a new corpus extension section — not a new base.
