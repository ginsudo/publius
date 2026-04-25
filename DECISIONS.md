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
- Footnotes that appear after the signature (paper 1, 78, etc.) are preserved as trailing paragraphs in the same array. Splitting them into a dedicated field is deferred until the footnote presentation standard is set.
- One transcription typo found in PG #1404 (paper 26's dateline reads "1788" instead of "1787"). Corrected to "1787-12-22" after the project owner verified the correct date against Founders Online (https://founders.archives.gov/documents/Hamilton/01-04-02-0183), Teaching American History, Ballotpedia, and Wikipedia. The correction is encoded in a `CORRECTIONS` map in `parse.ts` keyed by paper number, and logged in `data/federalist/data_quality_issues.md` with the cited sources. The parser refuses to apply a correction unless the `from` value matches what it actually parsed, so an upstream fix to PG #1404 will fail loudly rather than re-corrupt the data. The verbatim PG dateline (with the typo) is preserved per-item in `federalist.publication.raw_dateline` so any reader can see the discrepancy without consulting the raw source file.

**Editorial standard for source deviations:** Do not silently overwrite the source. Any deviation between the structured corpus and the raw source must either (a) be applied as a logged correction with cited external sources verified by the project owner, or (b) be left as-is and surfaced as an open issue for editorial review. The diagnosis discipline in CLAUDE.md applies — own the call, document the reasoning, make the deviation auditable.

**Revisit if:** A different source edition becomes preferable (e.g., a critically-edited digital edition with stable paragraph IDs); footnote handling needs to be split out; cross-paper citation IDs become necessary.

---

## Monetization: deferred

**Decision:** Do not decide monetization model until after launch and first real user cohort.

**Options on the table:**
- Free (absorb API costs as cost of running a scholarly tool)
- Institutional licensing (Princeton course, law schools, think tanks)
- Freemium (limited queries free, paid tier for heavy use)

**Reasoning:** The project plan is explicit: "decide after you see who's using it." The Princeton ConInterp hypothesis suggests institutional licensing as the natural path if that audience materializes, but this is a hypothesis, not a fact. Monetization decisions made before there are real users are speculation. Revisit after Phase 7 launch with actual usage data.