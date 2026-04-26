# Tocqueville corpus — schema notes

The cross-corpus base schema is defined in [`data/SCHEMA.md`](../SCHEMA.md). This file documents only the Tocqueville-specific extension and the editorial calls that govern how PG #30513–#30516 are mapped into it.

## Tocqueville extension

Each item in `tocqueville.json` carries the universal base fields plus a `tocqueville` extension:

```json
"tocqueville": {
  "volume": 1,
  "part": 2,
  "chapter": 7,
  "kind": "chapter",
  "chapter_summary": null,
  "references_page": null,
  "tome": 2,
  "end_notes_referenced": []
}
```

- **`volume`** — 1 (1835) or 2 (1840). The work-level division as scholars cite ("Volume I", "Volume II").
- **`part`** — part number within the volume. `null` for items that don't belong to a part (avertissements, the Vol I introduction, end-notes, the appendix). Vol I has 2 parts; Vol II has 4.
- **`chapter`** — chapter number within the part. `null` for non-chapter items.
- **`kind`** — discriminates item shape. One of:
  - `"avertissement"` — Vol I's "Avertissement de la dixième édition" (Pagnerre 1848 addition) or Vol II's original "Avertissement" (1840).
  - `"introduction"` — Vol I's introduction (tome 1) or the unmarked authorial preamble that opens Vol I Part II (tome 2). Vol II has no introduction.
  - `"chapter"` — narrative chapter, the smallest addressable unit.
  - `"end_note"` — a substantive lettered end-note treated as a standalone item per the standalone-item exception in `data/SCHEMA.md`.
  - `"appendix"` — the "Examen comparatif" essay, a Pagnerre 1848 addition.
- **`chapter_summary`** — the bullet-style summary block that the Pagnerre 1848 Vol I tome 1 prints between each chapter title and body. Captured as a single string with `--` separators normalized to spaces. Populated only on Vol I tome 1 chapters; `null` everywhere else, including Vol I tome 2 chapters (the source carries no summaries there).
- **`references_page`** — for `kind: "end_note"` items only, the page number in the source-edition body that the end-note glosses (e.g., `81` for Tome 4 note TN-A "NOTE PAGE 81."). `null` for all other kinds.
- **`tome`** — 1, 2, 3, or 4. The physical-source division (which PG file the item came from). Carried alongside `volume` so downstream code can address either, and so end-note ID disambiguation (next section) is auditable from item state alone.
- **`end_notes_referenced`** — array of end-note IDs (e.g., `["tocqueville:vol1.t1.notes.A"]`) that this item references. Populated editorially in Phase 4 once the inline-prose → end-note mapping has been hand-verified. Empty array (`[]`) in Phase 0; not derivable from the source by pattern alone (Tocqueville references end-notes in prose like "voyez la note A" rather than via a uniform inline marker).

## ID conventions

ID format depends on `kind`:

| Kind             | Format                                              | Example                                   |
| ---              | ---                                                 | ---                                       |
| `chapter`        | `tocqueville:vol<volume>.part<part>.ch<chapter>`    | `tocqueville:vol1.part2.ch7`              |
| `avertissement`  | `tocqueville:vol<volume>.avertissement`             | `tocqueville:vol1.avertissement`          |
| `introduction` (Vol I) | `tocqueville:vol<volume>.introduction`        | `tocqueville:vol1.introduction`           |
| `introduction` (Part II preamble) | `tocqueville:vol1.preamble.part2`  | `tocqueville:vol1.preamble.part2`         |
| `end_note`       | `tocqueville:vol<volume>.t<tome>.notes.<letter>`    | `tocqueville:vol1.t1.notes.A`             |
| `end_note` (TN)  | `tocqueville:vol<volume>.t<tome>.notes.TN-<letter>` | `tocqueville:vol2.t4.notes.TN-A`          |
| `appendix`       | `tocqueville:vol<volume>.appendix`                  | `tocqueville:vol1.appendix`               |

**End-note IDs scope per-tome (not per-volume)** because the Pagnerre 1848 edition resets the lettering per tome. Vol I tome 1 has note "A" (on civilization); Vol I tome 2 has its own note "A" (on the Indian removal). The `t<tome>` segment in the ID disambiguates them and preserves source provenance in the ID alone.

## How universal-base fields map for Tocqueville

- **`authors`** — `["Tocqueville"]` for every item. Tocqueville is the sole author across all 124 items, including the Pagnerre 1848 augmentations (avertissement, appendix) which he composed for the reprint.
- **`date`** — original-volume date for original content (`"1835-01-01"` for Vol I tomes 1+2, `"1840-01-01"` for Vol II tomes 3+4). Pagnerre 1848 augmentations (Vol I avertissement, Vol I appendix) carry `"1848-01-01"`. Day precision is unavailable for any item — Tocqueville's chapters don't carry per-chapter dates the way the Federalist Papers carry per-paper datelines — so `01-01` is a placeholder day-of-year, not a claim about January 1st.
- **`language`** — `"fr"` for every Tocqueville item. The English translation is Phase 4 work; `plain_english` (a universal stub) will hold modern English when generated.
- **`paragraphs`** — chapter / item body in source order. Multi-line wrapping in the PG source is collapsed to a single string per paragraph. Inline footnote markers (`[1]`, `[A]`, `[TN-C]`) are preserved verbatim.
- **`footnotes`** — populated from inline `[Note N: …]` blocks per the universal schema. Markers are stored as `"[N]"` (e.g., `"[1]"`) to match the inline reference form. `[]` for items with no inline footnotes.
- **`plain_english`**, **`constitutional_section`**, **`topic_tags`** — universal stubs as defined in `data/SCHEMA.md`. All `null`/`[]` in Phase 0.

## Footnotes — Tocqueville-specific notes

Tocqueville uses footnotes heavily and in two distinct shapes:

1. **In-chapter authorial footnotes.** Numeric markers (`[1]`, `[2]`, …) inside the chapter, with the body printed as an indented `[Note N: …]` block in the PG source. These populate the chapter's `footnotes` array. Markers reset per chapter (so `[1]` appears in many chapters, each resolving to that chapter's own footnote).

2. **End-notes (standalone items).** Lettered end-notes printed at the back of each tome — substantive enough to be addressable on their own, per the standalone-item exception in `data/SCHEMA.md`. They are NOT entries in any chapter's `footnotes` array; they are independent items with `kind: "end_note"` and IDs of the form `tocqueville:vol<volume>.t<tome>.notes.<letter>`. The `references_page` field on each end-note records the page number in the source-edition body that the end-note glosses.

   - Vol I tome 1: 20 end-notes (A..U).
   - Vol I tome 2: 6 end-notes (A..F). Letters reset relative to tome 1.
   - Vol II tome 3: 0 end-notes.
   - Vol II tome 4: 8 end-notes (TN-A..TN-H), with the `TN-` prefix added by the PG transcriber as a navigation aid for that tome. The prefix is preserved verbatim in the ID.

The chapter→end-note mapping (which chapter references which end-note) is reserved for editorial population in `tocqueville.end_notes_referenced` during Phase 4 — Tocqueville's source uses prose references ("voyez la note A"), not a uniform inline marker pattern, so the link cannot be auto-derived reliably. Vol II tome 4 is the partial exception: the PG transcriber's `[TN-X]` markers are uniform and the parser verifies that every `[TN-X]` marker resolves to a standalone end-note item, but the population of `end_notes_referenced` from those markers is still left for the editorial pass.

**Markers in chapter titles:** Vol II (tomes 3 and 4) chapters occasionally carry an inline marker as part of the title text (e.g., tome 4 ch. XVIII title ends "…sociétés démocratiques[5]." and ch. XVI title ends "…celle des Anglais[TN-C]."). The parser preserves these markers in the universal `title` field; the cross-reference invariant scans both `title` and `paragraphs` so the marker → footnote / end-note link is verified regardless of position.

## Editorial calls in the parse

These reflect calls made during Phase 0; if they need to change, change the parser and regenerate.

1. **Volume↔tome distinction surfaced.** Both `volume` and `tome` stored per item. Vol I = tomes 1+2; Vol II = tomes 3+4.
2. **Item kinds discriminated by `tocqueville.kind`.** Five values: `avertissement`, `introduction`, `chapter`, `end_note`, `appendix`. Discriminates item shape; the universal `title` field carries the source-language label.
3. **Pagnerre 1848 augmentations dated 1848.** Vol I's "Avertissement de la dixième édition" and the Vol I appendix carry `date: "1848-01-01"`. Original-volume items carry the original-volume year (1835 or 1840).
4. **Tome 1 avertissement subtitle skipped.** Tome 1 prints "DE LA DIXIÈME ÉDITION." as a subtitle line beneath the AVERTISSEMENT heading. The parser skips it so the title resolves cleanly to "Avertissement de la dixième édition".
5. **Vol I Part II preamble captured as `kind: "introduction"`.** The opening of tome 2 ("Jusqu'à présent, j'ai examiné les institutions…") has no section heading in the source — it sits between the inner header "EN AMÉRIQUE." and the first `CHAPITRE I.` marker. Captured at `tocqueville:vol1.preamble.part2`.
6. **End-note IDs scoped per-tome.** Format `tocqueville:vol<volume>.t<tome>.notes.<letter>` keeps Vol I tome 1's note "A" and Vol I tome 2's note "A" globally unique. Vol II tome 4's `TN-` prefix is preserved verbatim.
7. **Chapter summaries (Vol I tome 1 only) preserved in `chapter_summary`.** Captured as a single string with `--` separators normalized to spaces. `null` everywhere else.
8. **Markers in chapter titles preserved verbatim in `title`.** Verified by the cross-reference invariant, which scans both `title` and `paragraphs`.
9. **`end_notes_referenced` reserved as `[]` in Phase 0.** Populated editorially in Phase 4. Schema shape locked now to avoid migration churn.
10. **Cross-reference invariants enforced by the parser.** Item ID uniqueness, per-item footnote marker uniqueness, chapter counts per (volume, part), inline `[N]` → footnote resolution, `[TN-X]` → standalone end-note resolution. Failures surface in `data_quality_issues.md`.
