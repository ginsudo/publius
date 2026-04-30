# DECISIONS.md — Publius

Architectural and operational decisions with reasoning. Companion to CLAUDE.md.
CLAUDE.md is "what to do." This is "why we decided this and what we considered."

---

## Hosting: Vercel over self-hosting

**Decision:** Host on Vercel. The Mac Studio is the development and build machine only — not a production server.

**Options considered:**
- Self-host on Mac Studio with local models
- Vercel + Anthropic API

**Reasoning:** Self-hosting requires the Mac Studio to be on, connected, and healthy 24/7 with no redundancy. Home internet has asymmetric bandwidth and variable uptime. No geographic distribution. Security surface of a personal machine exposed to the internet. Vercel handles all of this for free at the scale Publius will operate initially.

The local-model variant (self-host to avoid API costs) was considered. The crossover point where local infrastructure makes economic sense is roughly when API bills exceed the cost of running equivalent cloud infrastructure — probably north of $500–1000/month, implying thousands of queries per day. Publius is unlikely to reach that scale early, and local models capable of matching Sonnet 4.6 quality on nuanced constitutional interpretation don't exist at a size that runs comfortably on a Mac Studio without quality tradeoffs this product can't afford.

**Revisit if:** API costs consistently exceed $500/month, or local model quality reaches parity with Sonnet 4.6 on constitutional reasoning tasks.

---

## LLM: Claude API (Sonnet 4.6) over alternatives

**Decision:** Claude API, Sonnet 4.6 for Q&A, Batch API for plain English generation.

**Options considered:**
- OpenAI GPT-4 class models
- Local models (Ollama, LM Studio)
- Claude API

**Reasoning:** The epistemic distinction at the core of Publius — argument vs. observation vs. holding — requires a model that can follow nuanced system prompt instructions reliably and maintain distinctions across long contexts. Sonnet 4.6 was chosen for quality and cost balance. Batch API for generation tasks (plain English rendering of all 85 Federalist Papers) costs approximately $5 total — trivial. Not revisiting this without a concrete quality or cost reason.

---

## Vector store: sqlite-vec locally, Turso or Pinecone on Vercel

**Decision:** sqlite-vec for local development; Turso (managed SQLite) or Pinecone for Vercel production.

**Options considered:**
- Pinecone (managed vector database)
- Turso (managed SQLite, compatible with sqlite-vec)
- Postgres + pgvector
- sqlite-vec locally + Pinecone production

**Reasoning:** The three corpora (Federalist Papers, Tocqueville, curated opinions) are small enough that SQLite handles them without difficulty. sqlite-vec keeps local development simple — no external service dependency. Turso is the natural production path because it's managed SQLite and keeps the local/production parity high. Pinecone is the fallback if Turso proves insufficient at scale. Postgres + pgvector was ruled out as over-engineered for this corpus size.

**Decide between Turso and Pinecone at:** Phase 5 (when Tocqueville corpus is added and the vector store holds two corpora). Don't decide earlier than needed.

---

## GitHub: private repo

**Decision:** Private repository for now.

**Reasoning:** In-development product with editorial work (Tocqueville translation, system prompt design) that hasn't been reviewed or released. Keeping it private during development costs nothing on GitHub and avoids premature exposure of work in progress.

**Revisit at:** Phase 7 (Polish and Launch). Consider going public or keeping private with selective access for institutional users (Princeton course).

---

## Electron desktop: deferred

**Decision:** Defer Electron wrapper until web is fully shipped.

**Reasoning:** Electron build pipeline is fiddly, cross-platform packaging is fiddly, and the operational guide explicitly flags this as a time sink. No user-facing reason to ship desktop before web. Web ships first; Electron follows when the web product is stable.

---

## Tocqueville: French original as source of record

**Decision:** The source of record for Democracy in America is the French original (De la démocratie en Amérique, 1835/1840), not any existing English translation.

**Reasoning:** The goal is a new English version that is the project owner's intellectual work — accurate, modern, and editorially defensible as an original translation. Existing translations (Reeve, Mansfield/Winthrop) are themselves under various copyright and editorial considerations. Working from the French original and making genuine editorial choices creates a defensible copyright claim. Consult a copyright attorney before publishing.

---

## Tocqueville: Volume I before Volume II

**Decision:** Complete and publish Volume I before adding Volume II.

**Reasoning:** Volume I is more immediately relevant to constitutional interpretation — institutions, federalism, judicial power, the legal profession. Volume II is more diffuse (habits of mind, tyranny of the majority as a social phenomenon). Volume I first is a cleaner product release; Volume II follows as a subsequent release.

---

## Vercel import: imported empty repo, accepted 404

**Decision:** Imported the publius repo to Vercel before any Next.js code existed. Initial deploy shows 404.

**Reasoning:** Establishing the GitHub → Vercel link early means auto-deploy is wired before Phase 1 begins. The 404 is expected and harmless — Vercel deployed successfully, there's just no app code to serve yet. The link and environment variables persist through failed/empty builds.

---

## Anthropic API spend limit: $200/month

**Decision:** $200/month spend limit set in Anthropic console.

**Reasoning:** Development costs at this stage are negligible (fractions of a cent per call). The limit is a safety ceiling against runaway scripts or misconfigured loops, not a realistic operational constraint. 

**Usage hypothesis:** If Princeton ConInterp (100 students, ~20 queries/day, ~90-day semester) becomes the primary use case, peak API costs could reach ~$600/month during semester. At that scale, institutional licensing is the natural revenue model. Revisit limit and monetization after first real user cohort.

---

## Observability: Helicone or Langfuse, wired from day one

**Decision:** Wire observability at Phase 1.4 (first Vercel deploy), not after launch.

**Options considered:**
- Helicone (proxy-based, minimal code change)
- Langfuse (open source, self-hostable, more control)
- PostHog (product analytics, less LLM-specific)
- Defer until launch

**Reasoning:** The project plan is explicit: "wire from day one." Every query, latency, and cost should be visible from the first real traffic. Deferring observability means flying blind during development and having no baseline when real users arrive. Decision between Helicone and Langfuse deferred to Phase 1.4 — both are viable, choose based on current pricing and integration complexity at that point.

---

## Cross-corpus schema: universal base + namespaced extensions

**Decision:** All corpora in `/data/` conform to a single base schema documented in `data/SCHEMA.md`. Each item carries universal fields (`id`, `corpus`, `title`, `authors`, `date`, `language`, `paragraphs`, `plain_english`, `constitutional_section`, `topic_tags`) plus exactly one corpus-specific extension namespace (`federalist`, `tocqueville`, `court`). Top-level file shape is identical across corpora: `{ corpus, source, count, items }`. Item IDs are human-readable strings of the form `<corpus>:<locator>` (e.g. `"federalist:51"`, `"tocqueville:vol1.part2.ch7"`, `"court:marbury_v_madison:majority"`).

**Why now (rather than after Federalist):** The standing rule in CLAUDE.md ("Corpus JSON schema must be consistent across all corpora to support extensibility — any new corpus must conform to the shared schema, not introduce a one-off structure") was added to CLAUDE.md after Federalist Phase 0 was first shipped under a Federalist-specific schema. Designing the shared base now and refactoring Federalist to it — before Phase 1 retrieval work begins — is cheaper than refactoring later, and ensures retrieval, Q&A, and citation are written against the universal shape from day one.

**Pattern considered and rejected:**
- Single-shape schema with a junk-drawer `locator` field carrying corpus-specific keys. Cleaner-looking, but harder to query and harder to extend. The chosen pattern (universal base + typed extension) is honest about what generalizes and what doesn't.

**Per-corpus design calls baked in:**
- **SCOTUS:** each opinion is a separate item, joined by `case_id`. Dissents are first-class argumentative voices, not children of a case.
- **Tocqueville:** smallest addressable unit is the chapter. Sub-sections within a chapter are flattened into `paragraphs`.
- **`constitutional_section`:** universal field (nullable), used where editorially asserted. Applies most strongly to Federalist and SCOTUS, where each item is organized around constitutional structure or doctrine. Tocqueville does not organize by constitutional provision — he observes patterns and tendencies — so the field is populated editorially for Tocqueville with expected sparse coverage. Do not rely on `constitutional_section` for cross-corpus filtering or retrieval until after editorial review of the Tocqueville corpus is complete; until then, treat its presence on Tocqueville items as additive metadata, not as a comprehensive index.
- **`source` per-item override:** spec'd as optional. Unused by Federalist (corpus-level source is uniform); expected to be used by SCOTUS where opinions come from heterogeneous repositories.
- **No speculative fields.** Stub fields are limited to known editorial concepts with settled shapes (`plain_english`, `constitutional_section`, `topic_tags`). Additive changes do not require a schema version bump per `data/SCHEMA.md`, so adding fields later is cheap.

**Revisit if:** A fourth corpus is added (CLAUDE.md flags this as requiring resolution of a fourth epistemic category first); citation needs require stable cross-edition paragraph IDs; `source` per-item override pattern proves wrong when SCOTUS ingestion begins.

---

## Federalist corpus: source, schema, and editorial calls

**Decision:** Federalist Papers Phase 0 corpus is sourced from Project Gutenberg eBook #1404 (SHA-256 recorded in `data/federalist/raw/pg1404.sha256`), parsed by `data/federalist/parse.ts` into a single `data/federalist/federalist.json`, with a small set of editorial calls baked into the parse.

**Source choice — PG #1404 over alternatives:**
- PG #1404 is the most widely-used clean transcription of the McLean's bound edition. Single file, well-maintained.
- The Avalon Project (Yale) is the canonical online citation source but lacks a single bulk-download. Used as a spot-check reference, not a primary source.
- Library of Congress hosts the text but in a less convenient form. Same role as Avalon: spot-check reference.
- Spot-check method (5 papers' canonical incipits: 1, 10, 51, 70, 78) was approved over a systematic line-by-line cross-edition diff, which is deferred until the editorial pipeline that produces `plain_english`.

**Schema decisions (Federalist-specific; the cross-corpus base is documented separately above):**
- Single JSON file rather than per-paper files. 85 entries is small; one file is easier to load, diff, and edit.
- Top-level `source` block rather than per-paper `source`. Every paper comes from the same edition; per-paper would be redundant.
- Disputed twelve (49–58, 62, 63) carry `federalist.authorship_status: "disputed"` with universal `authors: ["Madison"]`, following Mosteller-Wallace (1964). The historical claim by Hamilton is preserved in `federalist.authorship_note`, not erased.
- Joint papers (18, 19, 20) carry `federalist.authorship_status: "joint"` with universal `authors: ["Madison", "Hamilton"]` in PG byline order. The PG byline `"MADISON, with HAMILTON"` is preserved in the raw file and acknowledged in the note.
- `plain_english`, `constitutional_section`, `topic_tags` are universal stub fields, all `null`/`[]` in Phase 0. Reserved for later phases. The `plain_english` stub was added at the project owner's explicit request to lock the schema shape now and avoid migration churn when the rendering work begins.

**Editorial calls in the parse:**
- Salutation ("To the People of the State of New York:") is preserved as `paragraphs[0]` on every paper. It is part of each paper as published.
- Closing `PUBLIUS` signature is stripped — metadata, not body.
- Footnotes are structured in the universal `footnotes` field per `data/SCHEMA.md` (see "Footnotes: universal schema field" decision below). PG #1404's trailing-after-PUBLIUS blocks are split out by the parser. Three PG #1404 transcription quirks surface during this split — paper 11 (PUBLIUS line concatenated with footnote 1 citation), paper 37 (closing PUBLIUS missing entirely), paper 24 (footnote 1 missing the period after the marker). Editorial calls applied: papers 11 and 37 restored via owner-verified `SOURCE_FIXUPS` with cited sources (see "Federalist SOURCE_FIXUPS" decision below); paper 24 acknowledged as a cosmetic source-side typo that parses correctly anyway. All three are documented in `data_quality_issues.md`.
- One transcription typo found in PG #1404 (paper 26's dateline reads "1788" instead of "1787"). Corrected to "1787-12-22" after the project owner verified the correct date against Founders Online (https://founders.archives.gov/documents/Hamilton/01-04-02-0183), Teaching American History, Ballotpedia, and Wikipedia. The correction is encoded in a `CORRECTIONS` map in `parse.ts` keyed by paper number, and logged in `data/federalist/data_quality_issues.md` with the cited sources. The parser refuses to apply a correction unless the `from` value matches what it actually parsed, so an upstream fix to PG #1404 will fail loudly rather than re-corrupt the data. The verbatim PG dateline (with the typo) is preserved per-item in `federalist.publication.raw_dateline` so any reader can see the discrepancy without consulting the raw source file.

**Editorial standard for source deviations:** Do not silently overwrite the source. Any deviation between the structured corpus and the raw source must either (a) be applied as a logged correction with cited external sources verified by the project owner, or (b) be left as-is and surfaced as an open issue for editorial review. The diagnosis discipline in CLAUDE.md applies — own the call, document the reasoning, make the deviation auditable.

**Revisit if:** A different source edition becomes preferable (e.g., a critically-edited digital edition with stable paragraph IDs); footnote handling needs to be split out; cross-paper citation IDs become necessary.

---

## Footnotes: universal schema field

**Decision:** `footnotes` is a universal base-schema field on every item, not a per-corpus extension. Each footnote is `{ marker: string, paragraphs: string[] }`. Marker is preserved exactly as it appears inline in the body (`"(1)"`, `"E1"`, `"A"`, etc.); body uses `paragraphs[]` for consistency with item-level body shape. Empty array (`[]`) when the item has no footnotes — matches the `topic_tags: []` empty-collection pattern. Marker uniqueness within an item is the load-bearing invariant; sequence ordering is corpus-source dependent and not enforced. Inline marker → footnote lookup is direct string equality on `marker`; no precomputed back-references stored.

**Why now (rather than per-corpus):**
- SCOTUS especially makes footnotes non-flatten-able: Carolene Products n.4 is the canonical example of a footnote that carries independent argumentative weight and must remain first-class addressable.
- Tocqueville footnote use is heavy and substantive; some end-notes (lettered A, B, C…) are substantive enough to be standalone items.
- Federalist had been treating trailing-after-PUBLIUS footnotes as additional `paragraphs` entries, with the split into a dedicated field deferred until "the footnote presentation standard is set." This is that decision.
- Deciding at the schema level now means the retrieval, Q&A, and citation layers are written against the universal shape from day one. Per-corpus retrofits later would multiply the surface area.

**Standalone-item exception (Tocqueville end-notes):** Tocqueville's lettered "Notes du premier volume" essays are substantive enough to be addressable items, IDs `tocqueville:vol1.notes.A` etc., not entries in any chapter's `footnotes` array. The chapter that references an end-note preserves the marker (`[A]`, `(A)`, etc.) inline in `paragraphs[]`; the end-note item lives separately. This is the only case where a footnote-shaped reference resolves to a different item rather than to the same item's `footnotes` field.

**Patterns considered and rejected:**
- `footnotes: null` for "no footnotes here" vs `[]` for "concept applies but empty." Rejected the `null` form: there's no "footnotes pending generation" state analogous to `plain_english: null` — either the source has them or it doesn't, and `[]` keeps consumer code simpler and the empty pattern consistent with `topic_tags: []`.
- Numeric marker field. Rejected: corpora vary (Federalist `(1)`, SCOTUS `1`, Tocqueville lettered `A`, occasional `*`/`†`). String accommodates all.
- Single string for footnote body. Rejected: SCOTUS and Tocqueville footnotes regularly run multiple paragraphs of analysis; the `paragraphs[]` shape mirrors the item-level body and a single-paragraph footnote is a one-element array.
- Back-reference field on each footnote (paragraph index that references it). Rejected: derivable from inline marker; storing introduces a brittle redundancy that can drift from the canonical source.

**Federalist migration shipped with this decision:** `data/federalist/parse.ts` regenerated; trailing-after-PUBLIUS blocks moved from `paragraphs[]` into `footnotes[]`; inline `(N)` markers preserved verbatim. PG #1404 transcription quirks surfaced by the migration (papers 11, 24, 37) were resolved per the editorial standard — see "Federalist SOURCE_FIXUPS" below.

**Revisit if:** A new corpus brings a footnote pattern these primitives can't express (e.g., footnotes that themselves contain structured citation metadata worth typing). Until then, additive — no version bump.

---

## Federalist SOURCE_FIXUPS: raw-text corrections layer

**Decision:** Add a `SOURCE_FIXUPS` array to `data/federalist/parse.ts` as a sibling mechanism to `CORRECTIONS`. Each entry is `{ paper, from, to, reason, sources[] }` and is applied to the per-paper text slice *before* block parsing. Precondition: the `from` substring must match exactly one occurrence in the per-paper block — both zero matches and multiple matches throw, so an upstream fix to PG #1404 (or a duplicated fixup) fails loudly rather than silently re-corrupting or applying twice.

**Why a separate mechanism from CORRECTIONS:** Both layers carry owner-verified deviations from the source with cited sources, and both follow the same precondition discipline. They differ in *what* they correct:
- `CORRECTIONS` repairs a parsed *field value* (e.g., a date) after extraction — used when the source text parses cleanly but a parsed value is wrong.
- `SOURCE_FIXUPS` repairs the *raw text* before extraction — used when the source text itself is structurally malformed in a way that breaks the parser (a missing line break, a missing terminator). Field-level correction can't reach these cases because the structural defect prevents the field from being extracted at all.

Keeping them as parallel layers (rather than merging into one) makes it explicit at which stage of the pipeline a deviation is being applied, and keeps the data-quality log auditable in two cleanly separated sections.

**Editorial calls applied (Phase 0):**
- **Paper 11 (raw-text fixup).** PG #1404 mashes Hamilton's closing `PUBLIUS` signature onto the same line as footnote 1's citation: `PUBLIUS "Recherches philosophiques sur les Americains."`. The inline reference (1) in the body refers to Cornelius de Pauw's *Recherches philosophiques sur les Américains* (Berlin, 1768), which Hamilton cites as the source of the "American degeneracy" thesis Madison-style mocks (the dogs-cease-to-bark passage). The fixup splits PUBLIUS and footnote 1 onto separate lines. Sources verified by project owner: de Pauw (1768), Avalon Project, Founders Online.
- **Paper 37 (raw-text fixup).** PG #1404 omits the closing `PUBLIUS` signature for Madison's paper 37; canonical editions place it after the final paragraph. Paper 37 has no footnotes (verified: zero inline `(N)` markers), so the missing signature is a pure transcription omission with no missing footnote material behind it. The fixup appends `PUBLIUS` after the final body line, restoring structural uniformity with the other 84 papers and removing a special case for downstream tooling that assumes PUBLIUS is the body terminator. Sources verified by project owner: Avalon Project, Founders Online, McLean's bound edition (1788).
- **Paper 24 (acknowledged quirk; no action).** PG #1404 renders footnote 1's marker as `1 ` rather than the canonical `1. ` (missing the period after the marker). The parser accepts this via a tolerant marker regex; the parsed footnote is structurally correct and the inline marker resolves. Logged as an acknowledged source-side typo to keep the discrepancy with PG #1404 auditable, but kept out of the open-issues queue.

**Outcome:** `data_quality_issues.md` is auto-regenerated by every parser run with four sections — source-text fixups, field corrections, acknowledged quirks, open issues. Phase 0 final state: 2 fixups, 1 correction, 1 acknowledged quirk, 0 open issues.

**Revisit if:** A new PG #1404 anomaly is discovered that requires a different correction shape (e.g., a multi-occurrence replacement, or a fixup that needs to delete content rather than replace it). For now, the single-occurrence string-replace primitive covers every case found.

---

## Tocqueville: edition verification deferred to Phase 4

**Decision:** Pull the French original of *De la démocratie en Amérique* (1835/1840) from Project Gutenberg's French eBooks for Phase 0 corpus acquisition. Verifying which 19th-century edition PG follows (Michel Lévy, Pagnerre, or other) and whether that edition is the right source of record for the eventual translation is deferred to Phase 4 (Tocqueville translation work).

**Reasoning:** Phase 0 stores French as source-of-record; the English translation is the project owner's intellectual work, deferred. Edition choice doesn't shape the Phase 0 ingestion pipeline — the schema, IDs, and structural verification work the same regardless of which 19th-century edition PG transcribed. By Phase 4, when actual translation work begins, edition fidelity matters in earnest: differences in chapter numbering, paragraph breaks, or end-note assignments between editions could affect the editorial calls baked into the translation. At that point, verify PG's edition against Pagnerre (or whichever scholarly edition is canonical for the translator's purpose) and document any divergence as a data-quality issue or correction in the established pattern.

**Phase 0 outcome:** PG #30513–#30516 are transcribed from the **Pagnerre 1848 edition** (12th edition for Vol I, 5th for Vol II), per the BnF/Gallica copies PG cites. This is the edition the Phase 0 corpus stores. It is also the edition that adds the Vol I "Avertissement de la dixième édition" (a forward Tocqueville composed for the 1848 reprint) and the "Examen comparatif de la Démocratie aux États-Unis et en Suisse" appendix (also 1848). Both augmentations are captured as standalone items in the corpus and dated `1848-01-01` rather than 1835/1840, so a downstream consumer can distinguish original-volume content from Pagnerre additions by `date` alone. Edition-fidelity verification (paragraphing, chapter-end punctuation, end-note assignment) against a scholarly Pagnerre transcription remains deferred to Phase 4.

**Revisit at:** Phase 4 — verify edition fidelity and document divergence (or confirm fidelity) before any translation begins.

---

## Tocqueville corpus: source, schema, and editorial calls

**Decision:** Tocqueville Phase 0 corpus is sourced from Project Gutenberg eBooks #30513–#30516 (the four Pagnerre 1848 *tomes* of *De la démocratie en Amérique*; SHA-256s recorded in `data/tocqueville/raw/tomes.sha256` and embedded per-tome in `tocqueville.json`). Parsed by `data/tocqueville/parse.ts` into a single `data/tocqueville/tocqueville.json`, conforming to the cross-corpus base schema with a `tocqueville` extension namespace.

**Volume↔tome mapping:** The Pagnerre 1848 edition splits each *volume* of the work into two physical *tomes*. Tomes 1+2 are Vol I (1835); tomes 3+4 are Vol II (1840). The corpus surfaces both: `volume` is the work-level division (1 or 2; what scholars cite as "Volume I" or "Volume II"), and `tome` is the physical-source division (1, 2, 3, or 4; which PG file the item came from). Both are carried per-item so downstream code can address either.

**Item kinds — what's an item:**
- `chapter` — the smallest addressable narrative unit. 93 total: Vol I has 8 chapters in Part I and 10 in Part II (totals 18); Vol II has 21 + 20 + 26 + 8 across its four parts (75). The four-part subdivision of Vol II is canonical.
- `avertissement` — Vol I's "Avertissement de la dixième édition" (Pagnerre 1848 addition, dated 1848-01-01) and Vol II's original "Avertissement" (1840).
- `introduction` — Vol I's introduction (tome 1) plus the unmarked authorial preamble that opens Vol I Part II (tome 2). The Part II preamble has no section heading in the source — it sits between the inner header "EN AMÉRIQUE." and the first chapter and is captured as a standalone item with `id: "tocqueville:vol1.preamble.part2"`. Vol II has no introduction (it goes straight from avertissement into chapters).
- `end_note` — the lettered end-notes printed at the back of each tome ("Notes du premier volume", etc.). Substantive enough to be standalone items per the standalone-item exception in `data/SCHEMA.md`. 26 in total: Vol I tome 1 has 20 (A..U), Vol I tome 2 has 6 (A..F), Vol II tome 3 has 0, Vol II tome 4 has 8 (TN-A..TN-H, prefixed because the PG transcriber added them as a navigation aid for that tome).
- `appendix` — the "Examen comparatif de la Démocratie aux États-Unis et en Suisse" essay, a Pagnerre 1848 addition attached to Vol I, dated 1848-01-01.

**End-note ID scoping (per-tome, not per-volume):** The Pagnerre 1848 edition resets end-note lettering per tome. Vol I tome 1 has note "A" (on civilization); Vol I tome 2 has its own note "A" (on the Indian removal). To keep IDs globally unique without renumbering, the ID format includes the tome segment: `tocqueville:vol1.t1.notes.A` and `tocqueville:vol1.t2.notes.A` are distinct items. Vol II tome 4 uses `TN-` prefixed letters (`TN-A`..`TN-H`), preserved verbatim in the ID: `tocqueville:vol2.t4.notes.TN-A`. This ID format also makes provenance ("which physical book") readable from the ID alone.

**Markers in chapter titles:** Vol II (tomes 3 and 4) chapters occasionally carry an inline footnote marker (`[5]`) or end-note marker (`[TN-C]`) inside the chapter's *title text*, not the body — Tocqueville and the PG transcriber attach a marker to a word in the title when the note glosses the title's wording. The parser preserves these markers in the universal `title` field; the parser's cross-reference invariant scans both `title` and `paragraphs` so the marker → footnote / end-note link is verified regardless of where the marker sits.

**Vol I tome 1 chapter summaries:** The Pagnerre 1848 Vol I tome 1 prints a brief bullet-style summary block between each chapter's title and its body — Tocqueville's own navigational summary. These are captured in `tocqueville.chapter_summary` as a single string (with `--` separators normalized to spaces), populated only on Vol I tome 1 chapters; `null` everywhere else, including Vol I tome 2 chapters (the source carries no summaries there).

**`end_notes_referenced` populated editorially in Phase 4:** The schema reserves an `end_notes_referenced: string[]` field on every item, but Phase 0 leaves it empty (`[]`). Tocqueville's chapter→end-note references are prose ("voyez la note A"), not a uniform inline marker pattern, so the mapping cannot be reliably auto-derived from the source text. Hand-mapping it is editorial work that belongs to Phase 4 (translation), and shipping the field shape now keeps the schema stable across Phase 0 → Phase 4. This was added at the project owner's explicit request mid-implementation, before the parser was first run.

**Editorial calls in the parse:**
- Tome 1 has a subtitle line "DE LA DIXIÈME ÉDITION." beneath the AVERTISSEMENT heading; the parser skips it so the avertissement title resolves cleanly to "Avertissement de la dixième édition".
- The Vol I Part II preamble (tome 2) has no marker in the source — it's identified by locating the inner "EN AMÉRIQUE." heading and capturing the prose between it and the first `CHAPITRE I.` marker.
- Chapter and end-note text are kept in the source language (`language: "fr"`); no translation in Phase 0.
- Pagnerre 1848 augmentations (Vol I avertissement and appendix) carry their composition date `1848-01-01`, not the original-volume date 1835. Original-volume items (chapters, introductions, original Vol II avertissement) carry `1835-01-01` or `1840-01-01`.
- The four `node:` standard-library imports keep the parser dependency-free, matching the Federalist parser's invariants.

**Cross-reference invariants enforced by `parse.ts`:**
- Every item ID is unique.
- Every footnote marker is unique within its containing item.
- Chapter counts per (volume, part) match the canonical 8/10/21/20/26/8 distribution.
- Every inline `[N]` marker (in `title` or `paragraphs`) resolves to a footnote in the same item; every footnote has at least one inline reference.
- Every `[TN-X]` marker in a Vol II tome 4 chapter resolves to a standalone end-note item with the matching ID.

A failure in any of these surfaces in `data/tocqueville/data_quality_issues.md` rather than crashing the parse — same auditability discipline as Federalist.

**Editorial standard for source deviations:** Same as Federalist — do not silently overwrite the source. Phase 0 final state: zero source-text fixups, zero field corrections, zero acknowledged quirks, zero open issues. The `SOURCE_FIXUPS` and `CORRECTIONS` mechanisms remain the model if a deviation is discovered later.

**Revisit if:** Edition verification in Phase 4 surfaces a scholarly Pagnerre transcription that diverges meaningfully from PG #30513–#30516; the standalone-end-note pattern proves wrong for downstream retrieval; `end_notes_referenced` needs richer structure than `string[]` (e.g., per-paragraph indices) once editorial mapping begins.

---

## Translation vs plain-English: separate fields for distinct workflows

**Decision:** Split modern-English rendering into two schema fields. `plain_english` (universal base) carries register-shifted modern English for items whose source `language` is `"en"` — Federalist papers, and SCOTUS opinions when acquired. `translation` (corpus extension field, currently on `tocqueville`) carries the cross-language English rendering of foreign-language source items. The two are not interchangeable.

**Why split:**
- **Different editorial workflows.** `plain_english` is register modernization — Claude Batch API generation with owner review is appropriate. `translation` is intellectual authorship — the project owner is translator of record, with a distinct review process, multiple revision passes, and the defensible-original-translation copyright posture documented in "Tocqueville: French original as source of record." Conflating them forces the editorial pipeline to special-case based on `language`, the smell of a missing distinction.
- **Different copyright status.** A Claude-generated register shift of a public-domain English text is a derivative of public-domain material. An owner-authored translation of public-domain French is the owner's copyrighted intellectual work. These should not share a field name, a generation pipeline, or a review workflow.
- **The split surfaced from Phase 1.1 retrieval planning.** The embedding-model choice depends on which language is being embedded; pretending both fields were the same would have reintroduced the language ambiguity at the retrieval layer.

**Field placement:**
- `plain_english` stays universal — every English-source item in any current or future corpus needs the same shape.
- `translation` lives on the corpus extension. Federalist and SCOTUS items will never have a translation, so a universal `translation: null` would be a speculative field on most items, which the cross-corpus schema decision rejects.

**Shape (resolved with this decision):** Both fields are `string[]` aligned with the item's `paragraphs` field — same length, same paragraph order. This enables side-by-side rendering, paragraph-level retrieval over modernized/translated text, and stable per-paragraph citation pinning. The editor works against an array of paragraph translations rather than a single document blob.

**Phase 0 outcome (no JSON migration):** Tocqueville's `plain_english` is `null` everywhere from Phase 0 — nothing to migrate. The `translation` field is added as `null` on every Tocqueville item, locked-shape but unpopulated until Phase 4. Federalist is unaffected.

**SCOTUS deferred:** Currently-anticipated SCOTUS opinions are English-source, so `plain_english` is the right field. If a non-English legal corpus ever joins (comparative-law work, ECtHR), that corpus's extension gets its own `translation` field at acquisition time. Not a decision to make now.

**Revisit if:** A new corpus brings a pattern these primitives can't express (e.g., translation between two non-English languages, or a parallel-text edition where source and target are both first-class).

---

## Embedding model: Voyage `voyage-4-large`

**Decision:** Use Voyage AI's `voyage-4-large` for embeddings, accessed via the Voyage HTTP API directly (no Voyage SDK). `VOYAGE_API_KEY` in `.env.local` locally; environment variable in Vercel for production.

**Why Voyage:** Anthropic does not offer a first-party embedding model. Their own documentation (https://docs.claude.com/en/docs/build-with-claude/embeddings) explicitly recommends Voyage AI as the third-party path, and Anthropic uses Voyage in their official RAG cookbook. Adopting Voyage is following Anthropic's documented routing, not vendor shopping. Confirmed against the docs at the start of Phase 1.1 planning before committing.

**Why `voyage-4-large` specifically:** Latest generation (Jan 2026 release), 32K context, 1024-dim default, best general retrieval quality in the Voyage lineup. Multilingual capability is not exercised in Phase 1.1 (Federalist-only) or Phase 5 (Tocqueville will be embedded from its English `translation` field once populated, not the French source) but is on the table at zero marginal cost if a multilingual case ever arises.

**Considered and deferred — `voyage-law-2`:** A legal-domain specialized model, 16K context, released April 2024. Tempting given Federalist's constitutional-argument register and SCOTUS later. Deferred because (a) it's an older model and Voyage's own docs note the 4-series flagship "improved performance across all domains," meaning it likely beats law-2 even on legal text, and (b) maintaining two indexes for comparison is post-Phase 1.1 work. **Concrete trigger to revisit:** if `voyage-4-large` results on the Phase 1.1 probe set disappoint, run `voyage-law-2` against the same probe set as a comparison before any other tuning.

**Pricing context:** ~$0.18 per 1M tokens at current pricing. Building the Federalist index (~2,500 chunks × ~150 tokens) is sub-dollar. Per-probe cost is sub-cent. Trivial at this stage.

**Revisit if:** `voyage-4-large` probe results are substandard (run `voyage-law-2` comparison first); a multilingual query path becomes required (already supported in 4-large, no model switch needed); a non-API path becomes necessary (vendor failure, sanctions, etc. — open-weight `voyage-4-nano` on Hugging Face is the documented fallback).

---

## Phase 1.1 retrieval test: passed (2026-04-26)

**Decision:** Phase 1.1 retrieval over the Federalist corpus is signed off by the project owner. The mandatory retrieval test required by `CLAUDE.md` ("the retrieval test is mandatory before any UI is built — do not skip it") is complete. The frozen results artifact is `data/eval/results-phase1-1.md`.

**Configuration that passed:**
- **Embedding model:** `voyage-4-large` (1024-dim, normalized).
- **Chunking:** paragraph-level for body text, one chunk per footnote. Each chunk is prefixed with a header — `Federalist No. {N} — {title}\nAuthor: {authors}\n\n{paragraph}` — so paper-number, title, and authorship metadata are present in the embedded text and not just in adjacent metadata columns.
- **Distance metric:** cosine. The `vec0` virtual table is created with `distance_metric=cosine`. This is documented here because `vec0`'s default is L2; the initial build used L2 and produced identical rankings for normalized vectors but uninterpretable scores. Cosine was chosen so future debugging reads scores directly as cosine similarity.
- **Storage:** `node:sqlite` (Node 22.5+ built-in) with the `sqlite-vec` extension binary (`vec0.dylib`) loaded at runtime from `data/eval/vendor/`. Zero npm dependencies in the retrieval path.
- **Probe set:** 13 active probes (7 body-substance, 3 footnote, 1 body-multi, 1 authorship-edge, 1 negative-space) plus 3 phase_5_only probes recorded for design intent (Tocqueville cross-corpus + end-note, deferred to Phase 5).

**Results summary:**
- 13/13 probes signed off `pass`.
- 13/13 must-include items found inside top-10 (sanity signal — not the pass criterion).
- Negative-space probe (P13, "modern political parties") top-1 cosine = 0.373; in-corpus top-1 range = 0.411–0.667. The embedding space separates in-domain from out-of-domain cleanly. No need to fall back to `voyage-law-2`.

**What's deliberately deferred to later phases:**
- Tocqueville retrieval — Phase 5, after the `translation` field is populated.
- Reranking — not used; `voyage-4-large` raw similarity ranking is adequate per the probe set.
- Production storage migration (Turso vs. Pinecone) — Phase 5 per the existing "Vector store" decision.
- Q&A / generation layer — Phase 1.2+; the no-flattening discipline is a Phase 3 system-prompt concern.
- Observability (Helicone / Langfuse) — Phase 1.4 per the existing decision.

**Revisit if:** the corpus regenerates and re-running the probes flips any judgment from `pass`; the chunk format in `lib.ts` changes (each format change should re-run the probe set before merge); a fourth corpus or a new chunking strategy is introduced. Adding a probe to the active set in those cases is preferred over loosening the existing pass bar.

---

## Monetization: deferred

**Decision:** Do not decide monetization model until after launch and first real user cohort.

**Options on the table:**
- Free (absorb API costs as cost of running a scholarly tool)
- Institutional licensing (Princeton course, law schools, think tanks)
- Freemium (limited queries free, paid tier for heavy use)

**Reasoning:** The project plan is explicit: "decide after you see who's using it." The Princeton ConInterp hypothesis suggests institutional licensing as the natural path if that audience materializes, but this is a hypothesis, not a fact. Monetization decisions made before there are real users are speculation. Revisit after Phase 7 launch with actual usage data.

---

## Meta-product generalization: refused; two architectural seams kept open

**Decision:** Publius is not generalized into a meta-product. The product's identity is constituted by the specific intellectual tradition it serves — Murphy / George / Dworkin constitutional interpretation — and the curatorial and prompt-design judgment that makes it rigorous comes from that specific formation. Two architectural choices preserve the option to generalize later without committing to it now.

**The speculation considered:** A meta-product that takes any base text and stages a curated dialogue with other corpora in conversation with it — Talmud with its commentary tradition, Shakespeare with sources and criticism, scientific papers with citation networks, etc. The pattern Publius implements (a base constitutional text + corpora in dialogue, epistemically tagged, with no flattening across modes and user-composed dialogue) is structurally generic. Generalizing it as configuration is a coherent product idea.

**Why refused:** Publius is Publius. The specific intellectual tradition is not incidental decoration on a generic engine; it is what makes the curation rigorous. A meta-product would expose taxonomies, tags, and modes as configuration, which means the operator of any instance — not Publius's owner — would make the curatorial calls. That dilutes the artifact rather than scaling it. The Murphy / George / Dworkin formation cannot be replicated by configuration.

**Two architectural seams kept open** (cheap now, expensive to retrofit):

1. **Phase 3.2 system prompt: parameterized modes.** Author the Q&A system prompt so its modes of authority are a list the prompt operates over, not three named things baked into prose. The discipline (no flattening, surface disagreement, attribute precisely) is durable. The specific modes (argument / observation / holding / eventual fourth) are configuration. Phase 3 ships with one mode (argument); Phase 5 adds observation; Phase 6 adds holding. This change is structural to the prompt, not to the product surface. Recorded in the Phase 3.2 directive in `publius_project_plan.md`.

2. **Phase 6 Constitution-as-corpus.** Model the U.S. Constitution as a first-class `constitution:` corpus conforming to the cross-corpus base schema. Migrate the universal `constitutional_section` field from a free-text string label to an ID reference into that corpus. SCOTUS items reference the constitutional provisions they interpret by ID; Federalist items get the same treatment. This makes the base-text-plus-corpora-in-conversation relationship latent in the data without requiring any product surface change. Recorded in the Phase 6.2 directive in `publius_project_plan.md`. **The actual `data/SCHEMA.md` edit and the data migration are deferred until Phase 6 work begins** — flagged here so it doesn't fall off the radar; not pre-emptively applied to Federalist or Tocqueville.

**Explicitly refused (not designed before Publius itself ships):**
- Instance infrastructure (multi-instance hosting, isolation, deployment per tenant)
- Multi-tenancy (multiple operators sharing one deployment)
- Curator permissioning (roles, ACLs, contributor workflows)
- Instance templating (cloning Publius into a Talmud-shaped or Shakespeare-shaped instance)
- Configurable taxonomies as a product feature (epistemic modes exposed as configuration to anyone other than the project owner)

**Revisit if:** Publius itself has shipped, has real users, and a concrete external request for the meta-product surfaces from someone whose judgment the project owner trusts. Until then, the two seams above are sufficient — they require no product-surface changes and add no operator-facing concepts.

---

## Q&A System Prompt v0.1 (Phase 1.2)

Adopted role-as-tool framing over persona, on the reasoning that persona
prompts bias toward sounding-like rather than behaving-like. Modes of
authority parameterized as a list (extensibility commitment from project
plan §3.2). Explicit rules for attribution, disputed authorship, surfacing
disagreement, retrieval quality handling, out-of-corpus material, and
answering the better version of the question. No exemplars; no length
guidance; no humor handling (deferred to Phase 6 when SCOTUS corpus exists).
Closing "what you are not" section included in v0.1 with explicit ablation
planned in v0.2 to test whether it reinforces rules, is redundant, or
weakens the prompt.

Full design reasoning, predicted failure modes, and open questions:
`prompts/system-prompt.md`.

---

## Q&A System Prompt v0.2 (Phase 1.2)

v0.2 supersedes v0.1 as of runC sign-off (commit f5b39a6). The rewrite
dropped the closing "what you are not" section, restructured the rules
into the actual flow of work (corpora → handling → answer shape), and
added a permission-and-prohibition pair: commit to readings the corpus
supports; refuse interpretive partisanship. A light length nudge, an
explicit no-synthesizing-close instruction, and a reframed
verdict-pressing instruction (behavioral, not identity-claim) round
out the changes.

RunA/B on the full 15-question set motivated the rewrite. The closing
section was mostly redundant — body discipline held without it — and
on Q5/Q14/Q15 it appeared to suppress analytic depth. The one thing
it was uniquely doing, enforcing symmetric availability on Q7-style
questions, is now handled by the new pair. A five-clause ablation
showed no individual sentence was load-bearing, confirming the
holistic-effect view of how prompt language works and ruling out a
surgical rewrite in favor of a structural one.

RunC tested v0.2 against seven diagnostic questions (Q5, Q7, Q9, Q10,
Q11, Q12, Q14). Discipline preserved across all seven; depth
permitted where the text supports it; no new failure modes. Output
lengths uniformly shorter than runB on the same questions (48–82%),
consistent with the length nudge earning its keep without truncation.

**Watch items.** (1) Outside-corpus factual claims need independent
verification when load-bearing for an answer — runC's
characterization of *Loper Bright* and the specific number of people
Madison enslaved are cases where the discipline of marking "outside
the corpus" is met but the underlying factual claim is not itself
audited. (2) The seven-question diagnostic set is small; runD on the
full 15 questions is available as a future cross-check if stronger
evidence is wanted later.

Full design reasoning, predicted failure modes, and open questions:
`prompts/system-prompt-v0.2.md`.

---

## TypeScript configuration for harness/route co-existence

**Decision:** `tsconfig.json` uses `moduleResolution: bundler` and `allowImportingTsExtensions: true` to allow the same `.ts` import style used by the `node --experimental-strip-types` harness. This keeps the harness and the Next routes importing from `data/eval/` with identical syntax — no fork between toolchains. Changes to either flag require re-validating that the harness still resolves correctly. `@types/node` is pinned to `^22` (overriding `create-next-app`'s default `^20`) because `node:sqlite` types live in `^22` and are required for the route handlers.

---

## Q&A endpoint architecture — two-endpoint split

**Decision:** Phase 1.2 ships two endpoints. `/api/ask` is the public answer surface, returning `{ answer, citations, usage, promptSha256 }` where `citations` is `Hit` minus `text` and similarity. `/api/retrieve` is the development inspection surface, returning `{ hits: Hit[] }` with full chunk text and similarity, no model call. The UI built in Phase 1.4 will be built strictly against `/api/ask` only and must not depend on `/api/retrieve`. This preserves the option to gate, auth, or remove `/api/retrieve` later — relevant to potential commercialization decisions deferred to post-launch — without coordinating UI changes. Define `Citation` as a named TypeScript type next to `Hit`; do not use `Omit<Hit, ...>` inline.

---

## Vercel deployment — deferred decision on macOS-vs-Linux binary

**Decision:** Phase 1.4 must resolve macOS-vs-Linux binary compatibility for `vec0`. The local `data/eval/vendor/vec0.dylib` is macOS arm64; Vercel serverless functions run Linux x86_64. Two paths are open:

- **Option A:** ship a Linux `vec0.so` alongside the macOS `.dylib` and platform-detect at load time. Preserves the Phase 1.1 retrieval stack through deploy. Recurring cost is near zero. Trade is that SQLite-on-Vercel persists, with cold-start implications as the index grows.
- **Option B:** pull the Phase 5 production-store migration (Turso or Pinecone) forward into Phase 1.4. Requires re-running the probe set against the new store and re-getting owner sign-off before deploy — this is a Phase-1.1-equivalent gate, not a side task. Solves the production-retrieval question once.

Decision is deferred to Phase 1.4 start. Do not pre-resolve. Owner's lean is Option A; Option B remains available if the Linux binary path proves fiddly under Vercel's specific environment.

---

## Voyage embeddings are not bit-stable across API calls

**Decision:** Voyage embeddings are not bit-stable across API calls. Observed during the Phase 1.2 smoke test (commit `d84e75e`): the same Q7 query, same corpus, same model produced 8/10 overlapping hits with scores ~0.14 lower when run hours after runC, vs. sub-0.01 float noise when the harness and the route were run within the same minute. **Cross-session drift is a working hypothesis from a single observation**, not an established phenomenon — yesterday's runC-vs.-route delta is one data point and could be a transient (replica routing, brief model deploy, network-timing artifact) as easily as a stable regime. Within-session variance is characterized below.

**Three implications:**

- The Phase 1.1 probe-set sign-off is a sample, not a deterministic guarantee. Re-running the probe set is informative but not strictly reproducible.
- Future automated tests asserting retrieval behavior need tolerance bands, not exact equality.
- Phase 5 production-store migration comparison ("are the new store's results equivalent to the old?") must account for embedding-side variation, not just attribute differences to the new store.

**Within-session variance characterized (2026-04-27, commit pending):**

Ten sequential invocations of `node --experimental-strip-types data/eval/query.ts "<Q7>" --json` between 09:59:33 and 09:59:37 EDT (≤4s wall clock). Run-level artifacts at `/tmp/publius-variance/run-{1..10}.json`; analysis at `/tmp/publius-variance/report.md` (uncommitted; numbers below are the load-bearing record).

- **Top-10 hit set:** identical across all 10 runs. Zero boundary churn — every hit that appeared in any run appeared in all 10.
- **Top-10 ordering:** 2 distinct orderings observed. 9/10 runs identical; run 3 reshuffled ranks 8/9/10. In the typical ordering, ranks 8/9/10 are fed:39 ¶15 / fed:39 ¶7 / fed:85 ¶15. In run 3, fed:85 ¶15 moved up to rank 8, pushing fed:39 ¶15 to 9 and fed:39 ¶7 to 10. The mechanism is visible in the per-hit scores: fed:85 ¶15 has near-zero score variance (range 0.0007), while both fed:39 hits scored at the low end of their ranges in run 3, dropping below fed:85's near-mean score. The score gap at rank 8 in run 3 was 0.0004 (0.2853 vs 0.2849); the three hits cluster within ~0.005 of each other across all 10 runs, so any per-call noise of comparable magnitude can rotate them.
- **Per-hit score statistics:** max observed stddev = 0.0012 (rank-9 hit); max observed range = 0.0040 (rank-9 hit); top-1 hit range = 0.0015. All ten hits had stddev ≤ 0.0012 and range ≤ 0.0040.
- **Magnitude vs. earlier hypothesis:** the entry's prior "within-session variance on the order of ±0.02" guess overstated the regime by roughly a factor of 5. Actual Q7 within-session range is ≤0.004 across every top-10 hit.

**What this implies (updated):**

- The within-session regime is, for retrieval purposes, effectively deterministic on Q7. Ranking is stable; the one swap observed sat between two hits with a sub-0.002 score gap — exactly the boundary case where score-noise and ranking interact, but with no impact on what the Q&A layer would see qualitatively.
- The cross-session/within-session distinction is operationally meaningful. Within-session, no embedding cache is needed; identical-query/identical-process runs produce essentially identical hits. Cross-session, an automated test asserting hit equality across days would fail under yesterday's observed delta.
- Cross-session non-determinism is still untested as a regime. A second cross-session repeat (24h, 1wk) would distinguish monotonic drift (silent model update — serious; would require re-indexing) from oscillation (replica routing — benign; tolerance bands suffice) from one-off transient (yesterday's delta was noise).
- Q7 was the larger-drift question of the two smoke-tested yesterday; if Q7 is within-session-stable to ≤0.004, easier queries (Q11 had ~0.02 cross-session delta and only a top-2 swap) are likely at least as stable in-process. Worth confirming on a second query before generalizing.

**Followups (not Phase 1.3 blockers):**

- Repeat the characterization on Q11 to confirm within-session stability is not query-shape-dependent.
- Cross-session repeats of Q7 in ~24h and ~1wk to test whether yesterday's delta was a regime or a transient.
- Consider scheduling the cross-session repeats as low-cost background tasks rather than blocking Phase 1.3 on them.

---

## Vercel env vars are not loaded from .env.local

**Decision:** Vercel deployment requires explicit env var configuration. `loadEnv()` was dropped from the route handlers in Phase 1.2 because Next's automatic `.env.local` loading suffices for development. On Vercel deploy (Phase 1.4), `ANTHROPIC_API_KEY` and `VOYAGE_API_KEY` must be set in Vercel's project environment-variable settings; `.env.local` does not deploy. Worth verifying as part of the Phase 1.4 pre-deploy checklist.

---

## Phase numbering reconciliation

**Decision:** `publius_project_plan.md` phase numbering has been updated to match the de facto sequence in `IMPLEMENTATION_LOG.md`. Q&A moved from old Phase 3 to new Phase 1.2; observability moved from old Phase 7 to new Phase 1.3; UI sub-phases consolidated into a new Phase 2 between the headless boundary and the plain-English work that was old Phase 2 / new Phase 3.

**Reasoning:** The plan as originally sequenced put reading UI before Q&A. Once Phase 1.1 retrieval signed off, it became clear the Q&A boundary — not the reading UI — was the demonstrable artifact worth shipping first, and observability was a "wired from day one" requirement (CLAUDE.md), not polish.

**Revisit if:** A subsequent restructuring requires a similar reconciliation. The lesson is that plan and log can drift in either direction, and reconciling early — before drift compounds across more phases — is cheaper than reconciling late.

---

## Phase 1.3 observability — Langfuse via OTel

**Decision:** Phase 1.3 wires observability against Langfuse Cloud through OpenTelemetry. SDK init lives in `lib/observability.ts` (`initObservability()`), shared between Next.js (`instrumentation.ts`'s `register()` hook) and the Phase 1.2 test harness (env-gated by `LANGFUSE_TRACING=1`). The route at `app/api/ask/route.ts` and the harness at `prompts/eval/run.ts` both wrap their work in `withAskTrace` → `withRetrievalSpan` → `withGenerationSpan` so a single audit point governs what gets logged per call. Error classification is centralized — `classifyError()` in `lib/observability.ts` is the single source of truth used by both the route's HTTP error mapper and the trace's `error.code`/`error.status` attributes, so the two never drift. Resolves the open Helicone-vs-Langfuse choice from the earlier "Observability: Helicone or Langfuse, wired from day one" decision.

**Why Langfuse over Helicone:** Langfuse's open-source / self-hostable footprint preserves more options for future deployment (Vercel function, dedicated VPS, owner-controlled instance) than a proxy-based service. The OTel integration is Langfuse-native — the `@langfuse/otel` package wraps `BatchSpanProcessor` + `OTLPTraceExporter` with auth headers and provides a standard Node SDK install path. No proxying of LLM traffic; instrumentation sits adjacent to the request flow rather than across it.

**Failure-mode discipline:** A Langfuse outage, bad keys, or any SDK error must not affect `/api/ask` behaviour. SDK init is wrapped in try/catch and returns `null` on failure (tracing disabled, route runs uninstrumented). The `with*Span` helpers wrap `startActiveObservation` in try/catch and fall through to running `fn` directly when tracing is unavailable. Individual `span.update()` calls swallow per-attribute failures so a single bad attribute does not kill the whole trace.

**Revisit if:** Langfuse pricing changes meaningfully at scale; a multi-region routing requirement surfaces; the OTel integration regresses; the "wired from day one" requirement needs to be re-litigated.

---

## Phase 1.3 OTel error hooks: known limitation on bad credentials

**Decision:** OTel hooks fire on transport failures but not on bad credentials; Langfuse Cloud's OTLP endpoint returns 2xx for unknown keys. Detecting key rotation requires a future startup-time auth probe slice. In the interim: if traces stop appearing without console errors, suspect credential rotation first.

**Context:** `initObservability()` installs `diag.setLogger` at `DiagLogLevel.WARN` and `setGlobalErrorHandler` from `@opentelemetry/core` so OTLP fetch-transport failures (DNS, connection refused, HTTP 4xx/5xx from a real endpoint) and BatchSpanProcessor export-result failures both surface to `console.error` with the `[observability]` prefix. The Phase 1.3 plan's "flush/network errors swallowed and console.error'd" requirement is satisfied for those classes of failure — verified end-to-end via a DNS-failure scenario (bad `LANGFUSE_BASE_URL`) under both the harness (plain Node) and the Next.js dev server, both of which produced `[observability] exporter error: Error: getaddrinfo ENOTFOUND ...`.

**The bad-credentials silence:** Langfuse Cloud's OTLP endpoint accepts unknown public keys with HTTP 2xx and filters server-side, so a rotated/typo'd public key produces no transport error and no `console.error`. This is a Langfuse architecture choice, not something OTel can detect through the per-request hook. The hooks are still installed correctly — they fire on every failure OTel can see — but they cannot fire on a class of failure that never reaches OTel.

**Operational implication:** If traces stop appearing in the Langfuse UI but server logs show no `[observability]` errors, the most likely cause is credential rotation (public or secret key in Vercel/`.env.local` no longer matches the active Langfuse project keys). Verify keys before assuming a deeper outage.

**Revisit if:** A startup-time auth probe slice is added (one-shot ping at `initObservability()` to a Langfuse endpoint that does authenticate the keys and surface a `console.error` on rejection); Langfuse Cloud's OTLP endpoint changes its behaviour to reject unknown keys at the transport layer; a different observability backend is adopted.

---

## Session-close artifact: IMPLEMENTATION_LOG.md only

**Decision:** The active session-close artifact is `IMPLEMENTATION_LOG.md`. The `/notes/` directory is preserved as a historical record but is no longer where new session summaries land. The dated session-note practice the operational guide originally specified is consolidated into the path-narrative entries IMPLEMENTATION_LOG already receives at session close.

**Reasoning:** Phase 1.1 onward, IMPLEMENTATION_LOG entries have been thorough enough that a separate dated note is ~90% duplicative. Two artifacts covering the same ground is the same drift pattern that produced the project plan / IMPLEMENTATION_LOG phase-numbering mismatch — aligning the rule with the practice now prevents the documents from drifting apart later. CLAUDE.md is the rule of record and is updated to make this explicit; the operational guide's §2 step 6 and §8 checklists are updated in the same commit so the two documents do not diverge again.

**Revisit if:** A future workflow needs a different session artifact (e.g., per-session decision logs separate from path-narratives), or the IMPLEMENTATION_LOG entry shape changes such that a separate session summary recovers value.

---

## Phase 1.4 Vercel deploy — Option A landed

**Decision:** Phase 1.4 ships Option A from the deferred macOS-vs-Linux binary decision: a Linux `vec0.so` is committed alongside the macOS `vec0.dylib` and selected at load time by `process.platform`. The Phase 1.1 retrieval stack is preserved end-to-end through deploy. `https://publius-one.vercel.app` is live, responds 200 on `/api/ask` and `/api/retrieve`, and emits Langfuse traces with `source=route`. Resolves the deferred decision in "Vercel deployment — deferred decision on macOS-vs-Linux binary".

**Why Option A over Option B:** The Phase 5 production-store migration would have required re-running the probe set against the new store and re-getting owner sign-off as a Phase-1.1-equivalent gate — a much larger slice than 1.4 needed to be. Option A is a binary-and-bundle change, not an architectural one; it ships the existing signed-off retrieval behaviour to production unchanged. The cold-start tradeoff Option A carries (loading SQLite + sqlite-vec on cold invoke) is bounded — measured ~2–5s differential on the Phase 1.1 corpus, well under the 8s target — and the corpus stays small for Phases 1–4 anyway. Option B remains available at Phase 5 when Tocqueville's `translation` field populates the index and the cold-start envelope is worth re-measuring.

**Sub-decision: index file committed (`data/eval/index.sqlite`).** Removed from `.gitignore` with a `!data/eval/index.sqlite` negation. The inputs are deterministic — Federalist corpus + chunk format in `lib.ts` + `voyage-4-large` — so committing the binary skips a Voyage rebuild on every deploy and keeps Vercel builds offline-relative-to-Voyage. Re-running `build-index.ts` on a CI-like fresh checkout produces a byte-identical artifact for the same inputs. The pre-existing exclude pattern (`*.sqlite`) made this an explicit override rather than a silent inclusion.

**Sub-decision: version parity at v0.1.6.** Owner's instruction was version parity over version recency. Probed the local `vec0.dylib` at v0.1.6 via `db.prepare('select vec_version()').get()` before fetching the Linux binary, then fetched the matching v0.1.6 Linux release. Both binaries committed to `data/eval/vendor/`; `lib.ts`'s `findVecExtension()` selects `.dylib` on `darwin` / `.so` on `linux` and throws explicitly on other platforms (with a fetch-locally instruction in the README). Version parity is now load-bearing — do not upgrade one without the other and re-running the probe set.

**Implementation locations:**
- `data/eval/lib.ts` — `findVecExtension()` rewritten from readdir-based auto-discovery to explicit platform-detect (`process.platform`-keyed filename, `existsSync` check, explicit error per missing-vendor / missing-binary / unsupported-platform case). Removed unused `readdirSync` import.
- `next.config.ts` — `outputFileTracingIncludes` added for `/api/ask` (`./data/eval/vendor/**`, `./data/eval/index.sqlite`, `./prompts/system-prompt-v0.2.md`) and `/api/retrieve` (`./data/eval/vendor/**`, `./data/eval/index.sqlite`). Next's static tracer doesn't follow runtime path-string reads (`db.loadExtension()`, `DatabaseSync(path)`, `readFileSync(path)`), so these have to be force-included into the function bundle. Verified post-build by inspecting `.next/server/app/api/{ask,retrieve}/route.js.nft.json` — all four runtime-loaded files present.
- `app/api/retrieve/route.ts` — Phase 7 TODO comment added flagging this as a development inspection surface to be reviewed before public launch (auth, IP-allowlist, or remove). Phase 1.4 ships open per owner's call.
- `.gitignore` — `data/eval/vendor/` line removed (binaries now committed); `!data/eval/index.sqlite` negation added.
- `data/eval/README.md` — updated to reflect committed binaries at v0.1.6, version-parity discipline, narrowed fetch instructions to non-arm64-mac/non-linux-x86_64 contributors, updated troubleshooting and files-tracked table.

**Operational guidance — glibc-first deploy verification.** Vercel runs Linux x86_64 on Amazon Linux 2023 (glibc 2.34 at the time of writing). The first verification step on every deploy that touches the binary is to hit `/api/retrieve` with a known-good question (Q7) and confirm a 200 response with the expected hit set; this is faster than waiting for a Q&A failure to surface a glibc mismatch. If `/api/retrieve` fails on a deploy that worked locally, suspect glibc-version drift between Vercel's image and the binary's build target before suspecting anything else.

**Operational guidance — alias propagation delay.** The first verification curl on first deploy returned HTTP 404 with `x-vercel-error: NOT_FOUND` on all paths, even after the build was confirmed "Ready" in Vercel's UI. Local + remote main were at the same SHA. Cause: alias hadn't propagated to the new deployment yet; brief retry resolved it cleanly. Worth knowing — "Build Ready" doesn't always mean alias has resolved.

**Phase 5 framing update — Pinecone, not Turso.** Original "Vector store" decision listed Turso and Pinecone as the two production paths and deferred the choice to Phase 5. The Phase 1.4 binary-bundling work effectively rules Turso out: by shipping sqlite-vec on Vercel as the production store at small scale, the natural Phase 5 comparison is "stay on sqlite-vec on Vercel" vs "migrate to Pinecone." Turso's value proposition (managed SQLite, local/production parity) is what sqlite-vec-on-Vercel now provides directly. When Phase 5 arrives, Pinecone is the Option B comparison; Turso has effectively self-deselected by the platform shift. Capturing this here while the research is fresh — not folding it into the existing "Vector store" entry, which records the decision as it stood when first made.

**Revisit if:** Cold-start exceeds the 8s target after Tocqueville (Phase 5) joins the index — that is the trigger for the Phase 5 Pinecone-vs-stay-on-sqlite-vec comparison; sqlite-vec releases a v0.1.x with breaking changes (the version-parity discipline keeps both binaries pinned, but a future upgrade will need a probe-set re-run); a glibc mismatch between Vercel's image and the binary becomes apparent (re-fetch the matching glibc-target build).

---

## prompts/: removed from git history; production code relocated; prose kept local-only

**Decision:** On 2026-04-29 the `prompts/` directory was removed from every commit in this repository's history via `git filter-branch --index-filter`. Production code that imported from `prompts/eval/lib.ts` was relocated to `lib/ask.ts`. The system prompt was moved to `config/system-prompt.md` (dropping the `-v0.2` filename suffix — future versioning lives in git history now that the prompt is tracked). `.gitignore` was narrowed from a blanket `prompts/` to specific prose-only patterns (`prompts/*.md`, `prompts/eval/results*.md`, `prompts/eval/plain-english-sample-results.md`), so the harness CLI (`prompts/eval/run.ts`) stays tracked while the system prompts, ablation variants, plain-English sample, and runA/runB/runC result files become local-only artifacts.

**Reasoning:** The prose under `prompts/` — the system prompt itself, the v0.1 five-clause ablation variants, the runA/runB/runC harness results, the plain-English sample — is editorial work product, not code. Tracking it in the repo conflated two different change cadences (production refactors vs. prompt-tuning experiments) and pushed prompt experimentation into the public-facing git history of a project that may eventually go open. The narrowing brings the repo's tracked surface to "code + the current canonical prompt" while preserving the experimental prose on disk for ongoing work.

The relocation of `prompts/eval/lib.ts` to `lib/ask.ts` was forced by the gitignore narrowing: `app/api/ask/route.ts` and `lib/observability.ts` imported `askClaude`, `extractPrompt`, `formatHits`, `QA_MODEL`, and the `AnthropicResult` type from `prompts/eval/lib.ts`. Once `prompts/` was no longer tracked, Vercel deploys would have failed at build because the imported module wasn't in the deployed checkout. `lib/ask.ts` is the new home; the file's primary consumer is `/api/ask`, which the name reflects. `parseQuestions` (used only by the harness CLI) ships in the same module — splitting added complexity for negligible bundle savings. The system prompt move to `config/` follows the same logic for runtime path-string reads: `route.ts` does `readFileSync` on the system prompt at startup, and `next.config.ts` declares it under `outputFileTracingIncludes` for the Vercel bundle. `config/` is a new top-level directory; today it holds only the system prompt, but it's the natural home for any future tracked configuration the route depends on at runtime.

**Stale SHAs in IMPLEMENTATION_LOG.md.** The history rewrite changed every commit SHA from `59b31633` (the first commit that touched `prompts/`) forward. Any SHA referenced in `IMPLEMENTATION_LOG.md` prior to 2026-04-29 is stale; the corresponding commit still exists in the rewritten history but at a new SHA. The rewrite did not pass `--prune-empty`, so the originally prompt-only commits (the v0.1 prompt add, the Phase 1.2 harness add, the runC v0.2 commit) remain in history as empty-tree commits — the dates and messages are still searchable, only the file diffs are gone. Cross-referencing prior `IMPLEMENTATION_LOG` entries to specific commits should be done by date and message, not by SHA, until the log is rewritten.

**Recovery path.** A complete pre-rewrite bundle was created at `~/Desktop/publius-prompts-history-backup.bundle` before the rewrite (size 7.2 MB, contains all 4 refs at `bc4834b`). If the rewrite needs to be undone, `git fetch <bundle> 'refs/heads/main:refs/heads/restore'` lands the original commits at their original SHAs as a separate ref; `git reset --hard restore` on `main` would undo the rewrite locally. The bundle is preserved indefinitely as the only authoritative record of the pre-rewrite history.

**Revisit if:** The project goes open and prompt-tuning experimentation itself becomes the artifact of interest — in which case prompts/ would be re-introduced as tracked content, with a clearer separation between editorial prose and product code than the original arrangement had; or if a future tooling integration (e.g., Helicone replay against historical prompt versions) needs access to the full system-prompt evolution, in which case the bundle's contents would be the source.

---

## Annotations live in an external `{corpus}-annotations.json` file, not in the corpus JSON

**Decision:** The v0.2 flag stream (and any future per-paragraph editorial state) is stored in a separate file per corpus — `data/federalist/federalist-annotations.json` today, `data/tocqueville/tocqueville-annotations.json` and `data/court/court-annotations.json` later. The corpus JSON (`federalist.json` and its peers) carries `paragraphs[]` and `plain_english[]` only; it does not carry `flags[]` or any editorial-state fields. The annotations file is a dense, paragraph-aligned sidecar with a stable top-level shape: `{ corpus, generated_at, prompt_version, prompt_sha256, papers[] }` (or `items[]` for non-paper corpora when they arrive). Each paragraph entry carries `paragraph_index`, optional `bypassed: true` (salutations only), `flags[] = { kind, term, note }[]`, `editorial_status` (`null | accepted | edited | flagged_for_rewrite`), and `editorial_note` (`null | string`). The schema is deliberately corpus-tagged at the top level so a future cross-corpus tool can dispatch on `corpus` without inferring from filename.

**Reasoning:** Three concerns drive the split, all about lifecycle. (1) **The corpus JSON feeds the embedding index and the Vercel deploy bundle.** Editorial review will churn `editorial_status` and `editorial_note` paragraph by paragraph, and any per-paragraph prompt-tuning re-run regenerates the flag stream entirely. Putting that churn inside `federalist.json` would invalidate the index on every editorial change and bloat the deploy bundle with editorial metadata the runtime doesn't read. The corpus JSON should change only when the corpus itself changes. (2) **The cross-corpus base schema in `data/SCHEMA.md` is universal-base + namespaced extensions.** Annotations are not corpus-specific in shape — every corpus will get the same flag-and-editorial-state model — so they don't belong in a `federalist: { ... }` extension. They belong in a parallel artifact with a corpus tag. (3) **A single-paragraph re-render** (the `--retry <custom_id>` path) needs to update annotations without rewriting the entire corpus. An external annotations file lets the apply step rewrite `federalist-annotations.json` while leaving `federalist.json` untouched whenever the per-paragraph plain English already matches.

**Schema notes worth preserving:**
- **Dense, not sparse.** Every paragraph has an entry whether it carries flags or not. Editorial state needs a slot regardless of flag count, and dense alignment makes the file directly indexable by `(paper_number, paragraph_index)`.
- **Salutations are present with `bypassed: true`.** Discipline is visible to a reviewer; absence would have to be inferred. The `bypassed` marker is on the entry, not on the paragraph — it documents the apply-time decision to skip the API submission, not a property of the underlying text.
- **`term` is parsed out of the flag body at apply time.** v0.2 emits flags as `[KIND: "term" — note]` for WORD and RHETORIC and as `[AMBIGUOUS: free-form prose]` for AMBIGUOUS. Pre-parsing into `{ term: string | null, note: string }` lets editorial UI render the term prominently without re-parsing on every read.
- **`prompt_sha256` is pinned at apply time.** Embedded sha256 of the system prompt as it stood when the apply ran. When editorial review consumes annotations months later, the hash answers "were these flags generated against the prompt I'm reading right now?" without version-string ambiguity.
- **Abort-by-default, with `--merge-annotations` to preserve editorial state.** The first apply writes annotations clean. Subsequent applies refuse to overwrite, because a naive overwrite would erase any `editorial_status` and `editorial_note` populated during review. To regenerate flags against an already-reviewed corpus, pass `--apply --merge-annotations`: the merge walks the existing file once, then writes new annotations from the current sidecar with prior editorial fields copied in where keys match. Without the flag, the script errors and tells the operator how to choose.

**Revisit if:** A future corpus has a non-paper containment shape that makes `papers[]` + `paper_number` awkward (the schema would need to lift to `items[]` + `id`, which is the same generalization seam already noted in `data/SCHEMA.md` for the eventual Constitution-as-corpus phase); or if editorial review surfaces a need for per-flag state (`editorial_status` per individual flag rather than per paragraph), in which case the flag entries would need their own `editorial_status` + `editorial_note` fields parallel to the paragraph-level ones; or if a cross-corpus annotations consumer (e.g., a unified review UI) makes a single combined annotations file more ergonomic than three corpus-tagged ones.