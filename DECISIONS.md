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

## Monetization: deferred

**Decision:** Do not decide monetization model until after launch and first real user cohort.

**Options on the table:**
- Free (absorb API costs as cost of running a scholarly tool)
- Institutional licensing (Princeton course, law schools, think tanks)
- Freemium (limited queries free, paid tier for heavy use)

**Reasoning:** The project plan is explicit: "decide after you see who's using it." The Princeton ConInterp hypothesis suggests institutional licensing as the natural path if that audience materializes, but this is a hypothesis, not a fact. Monetization decisions made before there are real users are speculation. Revisit after Phase 7 launch with actual usage data.