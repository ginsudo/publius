# IMPLEMENTATION_LOG.md — Publius

This is a stable reference for what has actually been built in the Publius repository, written for someone joining a fresh advisory thread. It complements `CLAUDE.md` (standing decisions, "what to do"), `DECISIONS.md` (architectural decisions with reasoning, "why we decided this"), and `data/SCHEMA.md` (the cross-corpus data schema). Those documents tell you what the project should be. This document tells you what currently exists and what does not.

## Phases complete

### Phase 0 — Corpus acquisition and parsing (Federalist + Tocqueville)

The two acquired corpora are parsed into the cross-corpus base schema and live as static JSON in `data/`.

**Federalist Papers** — 85 papers, 71 footnotes, 0 open issues. Source: a Project Gutenberg edition. Parser at `data/federalist/parse.ts` produces `data/federalist/federalist.json`. Authorship attribution preserves the disputed-twelve set (papers 49–58, 62, 63) with explicit `authorship_status` values rather than collapsing to a single attribution. A `SOURCE_FIXUPS` layer in the parser holds raw-text corrections so the upstream source remains traceable.

**Tocqueville (Democracy in America)** — 124 items, 340 inline footnotes, 0 open issues. Source: Project Gutenberg's French original. Parser at `data/tocqueville/parse.ts` produces `data/tocqueville/tocqueville.json`. Items include chapters, avertissements, introductions, an appendix, and end-notes across both volumes. Every Tocqueville item carries a `translation` field initialized to `null`; this is the editorial gate documented below.

**SCOTUS opinions** — not yet acquired. The third corpus is the project owner's curated-list decision and has not been started.

### Phase 1.1 — Retrieval test (Federalist-only)

The mandatory retrieval test required by `CLAUDE.md` ("the retrieval test is mandatory before any UI is built — do not skip it") is complete and signed off by the project owner. The infrastructure lives at `data/eval/`, and the frozen results artifact is `data/eval/results-phase1-1.md`. The full sign-off entry is in `DECISIONS.md`.

Configuration that passed: `voyage-4-large` 1024-dim embeddings, paragraph-level body chunks plus one chunk per footnote, header-prefixed chunk format, `node:sqlite` with the `sqlite-vec` extension binary, `vec0` virtual table with `distance_metric=cosine`. Owner judgment was `pass` on all 13 active probes; an additional 3 probes are recorded in the probe set as `phase_5_only: true` for design intent and skipped by the runner.

Tocqueville is deliberately excluded from the Phase 1.1 index. It rejoins at Phase 5 once the `translation` field is populated.

### Phase 1.2 — In progress

Phase 1.2 is the Q&A layer: a Claude API call that takes a question, retrieves with `queryIndex()`, and returns an answered text. The system prompt is the central artifact. As of this writing, v0.2 is the locked successor to v0.1; runC validated it against seven diagnostic questions; the test harness is unchanged from the v0.1 work; the HTTP boundary is scaffolded (`/api/ask` and `/api/retrieve`) and structurally smoke-tested against the harness on the dev machine.

**Locked artifacts:**
- `prompts/system-prompt-v0.2.md` — v0.2 of the Q&A system prompt, locked at runC sign-off (commit `464142e`). v0.2 supersedes v0.1. The rewrite is structural: the closing "what you are not" section is dropped entirely, the rules are reorganized into the actual flow of work (corpora → handling → answer shape), and a permission-and-prohibition pair is added (commit to readings the corpus supports; refuse interpretive partisanship). A light length nudge, an explicit no-synthesizing-close instruction, and a behavioral reframing of the verdict-pressing instruction round out the changes. The full v0.2 entry, including watch items, is in `DECISIONS.md`.
- `prompts/system-prompt.md` — v0.1, kept in the repo as a history artifact, no longer the active prompt. The full v0.1 entry remains in `DECISIONS.md` for the rationale that motivated the rewrite.
- `prompts/test-questions.md` — 15-question test set across 5 categories (best-student-tier, mediocre-but-not-trivial, out-of-corpus, genuine disagreement, capability-matrix probes). Each question carries an italics `*What it tests:*` line that the harness strips before sending to the model. Unchanged across v0.1 and v0.2.

**Test harness at `prompts/eval/`:**
- `prompts/eval/lib.ts` — `extractPrompt()` (heading-and-rule extraction), `parseQuestions()` (Q-block parser), `formatHit()` / `formatHits()` (preserve every metadata field on `Hit`), and a minimal `askClaude()` HTTP client (no SDK; model `claude-sonnet-4-6`, max_tokens 4096, `anthropic-version: 2023-06-01`).
- `prompts/eval/run.ts` — CLI: `--prompt --questions --output --k --limit --questions-filter`. The `--questions-filter` flag takes a comma-separated list of IDs (`Q1,Q3,Q14`) and raises on unknown IDs. The harness logs the extracted prompt to stderr at startup as a verification aid. Output is a markdown file with a header (timestamp, paths, sha256 of the extracted prompt, model, top-K) and per-question blocks (question quoted, hit list with metadata summary, model answer verbatim, token-usage footer).
- Zero new npm dependencies. Imports `loadEnv` from `data/eval/lib.ts` and `queryIndex` from `data/eval/query.ts`. Sequential question processing within a single run.

**Ablation variant prompt files (siblings of `system-prompt.md`):**
- `system-prompt-v0.1-no-closing.md` — entire closing "What you are not" section removed.
- `system-prompt-v0.1-no-clause1.md` through `system-prompt-v0.1-no-clause5.md` — each removes exactly one of the five sentences in the closing section, character-identical to v0.1 otherwise. Generated by a single-occurrence-asserted script and inspected via inline diffs before any run kicked off.

**Test runs in the repo (all committed):**
- `prompts/eval/results-v0.1-runA.md` — full v0.1, all 15 questions.
- `prompts/eval/results-v0.1-runB.md` — `system-prompt-v0.1-no-closing.md`, all 15 questions.
- `prompts/eval/results-v0.1-baseline-fresh.md` — full v0.1, Q1, Q3, Q5–Q14 (12 questions). Re-run alongside the clause-level ablations against the harness as finalized.
- `prompts/eval/results-v0.1-no-clause1.md` — Q1, Q9, Q14.
- `prompts/eval/results-v0.1-no-clause2.md` — Q6, Q8, Q10.
- `prompts/eval/results-v0.1-no-clause3.md` — Q3, Q5, Q7.
- `prompts/eval/results-v0.1-no-clause4.md` — Q10, Q11, Q13.
- `prompts/eval/results-v0.1-no-clause5.md` — Q6, Q12, Q14.

All 57 calls (30 A/B + 27 ablation) completed with `end_turn` stop reason. No truncations, no API errors.

**Path from v0.1 to v0.2 (today's work):**

v0.1 was tested, closely examined, and rewritten as v0.2 over the course of a single working session. The path is captured here in narrative form because cross-session continuity benefits from knowing the experiments and reasoning behind the lock decision, not just the decision. The DECISIONS.md entry for v0.2 (commit `464142e`) is the architectural decision; this is the trace that produced it.

*Five-clause ablation against the v0.1 closing section.* Each of the five sentences in the closing "what you are not" section was removed in turn — `system-prompt-v0.1-no-clause1.md` through `system-prompt-v0.1-no-clause5.md`, generated by a single-occurrence-asserted script and inspected via inline diff before any run kicked off. Each variant was run against three diagnostic questions chosen for the rule each sentence was trying to enforce; results in `prompts/eval/results-v0.1-no-clause{1..5}.md` and the matching baseline at `prompts/eval/results-v0.1-baseline-fresh.md`. No individual sentence was load-bearing: removing any single sentence produced no detectable discipline failure on the diagnostic questions. This ruled out a surgical-rewrite path — there was no single sentence to keep and no single sentence to drop. The closing section either earned its place as a whole or did not. The result is consistent with the holistic-effect view of how prompt language works: prompt sections have effects that do not localize cleanly to individual sentences, and a section either does its work as an integrated unit or it doesn't.

*Run A/B across the full 15-question test set.* `prompts/eval/results-v0.1-runA.md` ran the full v0.1 prompt against all 15 questions; `prompts/eval/results-v0.1-runB.md` ran v0.1 with the closing section removed against the same 15 questions. Three findings emerged. First, the closing section was mostly redundant: the body's discipline rules — attribution, surface-disagreement, no-flattening, mark-out-of-corpus, do-not-editorialize — held without it across all 15 questions in runB, and no discipline failure appeared in runB that did not also appear in runA. Second, the closing section was uniquely doing one thing: enforcing symmetric availability of arguments to multiple interpretive schools on Q7-style questions. RunA on Q7 produced an answer with an explicit symmetry-marking summary table; runB on the same question allowed itself to read the textual evidence as cutting toward fixed-meaning interpretation. Both answers were disciplined; they differed in posture, and the closing section was the source of the symmetry posture. Third, the closing section appeared to suppress analytic depth on Q5, Q14, and Q15: runB produced sharper analytic structure (counter-arguments-each-side-must-answer on Q5, three-fold differentiations on Q14 and Q15, willingness to commit to readings the text supports). The hypothesis: the "you do not decide who is right" framing was reading more broadly than its content, pushing the model toward restraint that suppressed legitimate interpretive moves, not just illegitimate ones. Together with the ablation result, this motivated a structural rewrite.

*Trace-analysis sketch (separate from v0.2).* One line in the v0.1 closing section — "the corpus does not have opinions either; it has arguments, observations, and holdings" — had been guarding against a real type-error: treating the per-turn answer as the locus of position-formation. But the per-turn answer is not the locus of position-formation across an inquiry; the conversation is. This is a per-turn-vs-trace-level distinction. The per-turn prompt's job is to *surface* arguments, observations, and holdings from the corpus with attribution and mode discipline. What an inquiry has *constituted* out of the corpus — the structural argument(s) the user's path has assembled across many turns — is a trace-level property and belongs to a separate artifact. A design sketch of that artifact lives at `notes/trace-analysis-sketch.md` (commit `464142e`); the placement is probably Phase 1.6 or deferred to Phase 5, exact slot is a project-plan decision. v0.2 dropping the corpus-doesn't-have-opinions language is consistent with the distinction: at the per-turn level, the model is reasoning from passages, not constituting positions, and the type-error the guardrail was preventing does not arise. The trace-level is where position-formation actually happens, and the trace-analysis artifact is where the corresponding discipline belongs.

*The v0.2 rewrite.* `prompts/system-prompt-v0.2.md` (commit `f5b39a6`) drops the closing "what you are not" section entirely (runA/B redundancy finding), restructures the rules into the actual flow of work (corpora → handling → answer shape), and makes four targeted additions tied to specific findings:

- A permission-and-prohibition pair: *"You may commit to readings the corpus actually supports… The discipline is not to refuse interpretation; it is to refuse interpretive partisanship."* The negative-plus-positive construction is motivated by both the Q7 finding (the closing section's symmetric-availability work was over-broad) and the Q5/Q14/Q15 depth-suppression finding (the model needs explicit license to commit where the text supports commitment).
- An explicit no-synthesizing-close instruction: *"Do not write closing paragraphs that synthesize positions the corpus has held distinct."* This names the Q14 failure mode that v0.1 had been trying to prevent indirectly through the closing section.
- A light length nudge: *"Length should track the question's complexity; a thirty-word question rarely needs a thousand-word answer."* This partially resolves v0.1's open question A2 (whether a length guardrail is needed); the evidence from runA/B was that lengths tracked complexity reasonably well, but the long-answer-to-short-question failure mode warranted an explicit guardrail.
- A reframing of the verdict-pressing instruction. v0.1's "you do not decide who is right" — an identity-claim about the model — is dropped in favor of *"When the question presses for a verdict the corpus cannot settle… name that the corpus does not settle it, and name what the corpus does permit."* This is a behavioral instruction tied to question shape, not an identity claim about the model. It is also more compatible with the trace-analysis distinction above: identity-language about what the model is or has no place to settle has costs that behavioral instructions do not.

The full v0.2 entry, including what did not change from v0.1, is in `DECISIONS.md` (commit `464142e`).

*Run C against seven diagnostic questions.* `prompts/eval/results-v0.2-runC.md` (commit `f5b39a6`) ran v0.2 against Q5, Q7, Q9, Q10, Q11, Q12, and Q14 — chosen to exercise the v0.2 changes (the depth-permitting questions, the symmetric-availability question, the synthesizing-close failure mode, in-corpus and out-of-corpus shapes). All seven calls returned `end_turn`. Discipline was preserved across all seven; depth was permitted where the textual evidence supports it; no new failure modes appeared. Output lengths were uniformly shorter than runB on the same questions (48–82% of runB length), consistent with the length nudge earning its keep without truncation. This is what produced the lock decision.

*Watch items going forward.* Two flags worth carrying into the next slice. First, outside-corpus factual claims need independent verification when load-bearing for an answer — runC's characterization of *Loper Bright* and the specific number of people Madison enslaved are cases where the discipline of marking "outside the corpus" is met but the underlying factual claim is not itself audited. Mode discipline is not factual discipline. Second, the seven-question diagnostic set is small; runD on the full 15 questions is available as a future cross-check if stronger evidence is wanted later before further changes.

**Phase 1.2 Next.js spike (today's work — 2026-04-27):**

Before scaffolding the real `app/` directory, ran a discardable spike at `/tmp/publius-spike/` to find out whether Next.js could ingest the existing `data/eval/` import style — specifically the explicit `.ts` extension on relative imports (`from './lib.ts'`) that the `node --experimental-strip-types` harness requires. Two failures discovered, both resolved by configuration rather than code changes; the harness and route now share the same import syntax across toolchains.

*What the spike tested.* `npx create-next-app@latest publius-spike` (Next 16.2.4 + Turbopack default + React 19.2.4), then copied the real `data/` directory and `.env.local` into the spike. (Initial symlinks were rejected by Turbopack with "Symlink … points out of the filesystem root" — a spike-only artifact, since the real route lives inside the project root with no symlinks.) The test was a single `app/api/test/route.ts` that imports `queryIndex` and `loadEnv` with explicit `.ts` extensions, `runtime = 'nodejs'`, exercising the full retrieval chain: Voyage embedding HTTP call, `node:sqlite` open, `vec0.dylib` extension load via `db.loadExtension()`, vector query, hits returned through the bundled module boundary.

*Two failures and their fixes.* First, Turbopack bundled the `.ts` imports cleanly but Next's separate TypeScript type-check pass rejected them: "An import path can only end with a '.ts' extension when 'allowImportingTsExtensions' is enabled." Default TS config rejects `.ts` import-extensions unless that flag is on; the flag requires `noEmit: true`, which Next sets by default, so the two are compatible. Second, `node:sqlite` types are missing in `@types/node ^20` (the version `create-next-app` defaults to). `node:sqlite` was added in Node 22.5; types live in `@types/node ^22`. Pinning the dev-dep to `^22` resolves it.

*What worked end-to-end after the fixes.* `next build` clean (Turbopack compile ~750ms, type-check passed); `next dev` plus `curl /api/test` returned 200 with three hits, Federalist 10 (Madison, undisputed) at score 0.546 for the question "what does Madison say about faction." This confirmed `import.meta.url`-based path resolution in `data/eval/lib.ts` survives Turbopack bundling — `REPO_ROOT`, `DB_PATH`, `VENDOR_DIR` all resolved correctly under Next — and that `db.loadExtension()` for the native `vec0` binary works inside a Next route handler.

*Vercel/Linux finding (Phase 1.4 concern, not a 1.2 blocker).* The vendored `vec0.dylib` is macOS arm64; Vercel serverless functions run Linux x86_64. The spike confirmed the local route works on the dev machine; deployment requires either a Linux `vec0.so` shipped alongside the `.dylib` with platform detection at load time, or pulling the Phase 5 production-store migration (Turso/Pinecone) forward into Phase 1.4. Recorded as a deferred decision in DECISIONS.md ("Vercel deployment — deferred decision on macOS-vs-Linux binary"); the owner's lean is the Linux binary path.

*Conclusion.* The existing harness code at `data/eval/` and `prompts/eval/` requires zero changes. The harness/route co-existence is preserved by `tsconfig.json` flags (`allowImportingTsExtensions`, `moduleResolution: bundler`) and the `@types/node ^22` pin, not by code changes to either side. The spike directory is not committed; the empirical findings are.

**Phase 1.2 HTTP boundary scaffolded (today's work — 2026-04-27):**

Following the spike, scaffolded the real `app/` directory and exposed the v0.2 system prompt as an HTTP boundary. Two-endpoint split per the DECISIONS.md entry — `/api/ask` (public answer surface) and `/api/retrieve` (development inspection surface). Structural smoke test on Q7 (in-corpus) and Q11 (out-of-corpus refusal) confirms route ≡ harness within voyage-embedding float noise, prompt sha256 pin holds end-to-end, and answer postures match runC.

*What was created.* `package.json` (Next 16.2.4, React 19.2.4, `@types/node ^22`); `tsconfig.json` with `allowImportingTsExtensions: true`, `moduleResolution: bundler`, `strict: true`, `noEmit: true` — JSONC top-comment points back at DECISIONS.md so the next reader knows why those flags are there; `next.config.ts` with `turbopack.root: __dirname` to silence a spurious workspace-root warning caused by a stray lockfile in `$HOME`; `app/layout.tsx` (minimal root layout, title `Publius`); `app/page.tsx` returns `notFound()` (no public landing copy until Phase 1.4 ships UI); `app/api/ask/route.ts` and `app/api/retrieve/route.ts`. The spike's symlink workaround is not present — the real routes live inside the repo root, no symlinks needed. `loadEnv()` is not called from either route; Next's automatic `.env.local` loading suffices, and dropping the explicit call keeps the route clean for Phase 1.4 Vercel deploy where env vars come from the platform.

*Citation type added to `data/eval/query.ts`.* `Citation` is defined as a named type next to `Hit`, not inline as `Omit<Hit, 'text' | 'score' | 'distance' | 'rank' | 'id'>`. The named type gives a single audit point if the projection ever changes, and the route imports `toCitation` from the same module so the projection lives next to the source-of-truth `Hit` type. Citation strips `text` (raw chunk text), `score`/`distance` (similarity numbers), and `rank`/`id` (internal indexing); preserves all corpus and provenance metadata (corpus, kind, item_id, paragraph_index, marker, paper_number, title, authors, authorship_status, date).

*`/api/ask` shape.* POST `{question: string, k?: number}` → `{answer: string, citations: Citation[], usage: {inputTokens, outputTokens, stopReason}, promptSha256: string}`. The system prompt is loaded once at module init via `extractPrompt()` (the same function the harness uses), and the sha256 is computed once at module init. Errors are mapped explicitly: 401 (`unauthorized`), 429 (`rate_limit`), 529 (`overload`), 502 (`upstream_error` for other Anthropic failures), 500 (missing key — `missing_anthropic_key`, `missing_voyage_key`, `unexpected_error`), 400 (`malformed_input` for bad body, empty question, or k out of [1, 25]). Body shape on errors is `{error: string, code: string}`. Nothing silently swallows an error.

*`/api/retrieve` shape.* POST `{question: string, k?: number}` → `{hits: Hit[]}`. Same input validation. No model call, no system prompt, no token usage. Lives at the same boundary because the development inspection surface should not piggyback on the public answer surface — the latter must remain the only path the UI ever depends on. Phase 1.4 will commercialize on `/api/ask`'s shape; `/api/retrieve` exists for diagnostics and may be IP-allowlisted or removed before public deploy.

*Build and type-check.* `next build` clean — Turbopack compile ~650ms, TypeScript type-check ~720ms, two routes registered as dynamic (`ƒ /api/ask`, `ƒ /api/retrieve`), root path static and 404. No errors, no warnings after the `turbopack.root` fix.

*Structural smoke test.* Started `next dev` on port 3457, then exercised both endpoints. Test choice: Q7 (in-corpus, depth-permitting question that runC passed) and Q11 (out-of-corpus, refusal-shape question that runC passed); the choice covers the two answer postures the runC harness exercised. Three checks were performed:

- *Same retrieval set as runC.* Q11 returned the same 10 documents as runC, slightly reordered (top-2 swapped, scores ~0.02 lower across the board). Q7 returned 8/10 of runC's hits (missing fed:50 ¶8 disputed, fed:82 ¶1, fed:40 footnote 2, fed:84 ¶9; gained fed:81 ¶5, fed:39 ¶15, fed:39 ¶7, fed:85 ¶15) with scores systematically ~0.14 lower. To isolate whether the Q7 drift was route-introduced or embedding-side, ran the same Q7 question through the harness directly: harness returned the same hits as the route within sub-0.01 float noise (0.343 vs 0.340, 0.332 vs 0.329, etc.). The route is structurally equivalent to the harness; the runC drift is voyage embedding non-determinism between morning and afternoon, not route-introduced. Voyage embedding non-determinism is documented as a DECISIONS.md entry; characterization of within-session variance is the first task of the next session.
- *Same `promptSha256` as runC.* Both Q7 and Q11 returned `404869dd6405ce1b1bf0d6db578f1bad47ed390a907eeec43304f9ffd7bf4f03`, exact match against runC's header. The prompt-extraction pipeline (`extractPrompt()` reading `prompts/system-prompt-v0.2.md` and isolating the heading-to-rule region) produces a byte-identical artifact at the route boundary. The sha256 pin is now load-bearing: any prompt mutation will produce a visible response-shape diff at the API boundary.
- *Same answer posture as runC.* Q11 opened with "The retrieved passages... have no relevance to *Loper Bright*. The similarity scores (all below 0.18) confirm the retrieval system found nothing on point" — the runC refusal posture exactly, including the explicit similarity-score callout. Q7 opened with "The question as framed assumes a binary that the Federalist Papers do not fully support — but the papers do take positions, and those positions lean heavily in one direction" — the runC depth-permitting posture, flagging the question's mediocre framing while still committing where the corpus supports commitment. Token counts close to runC (Q11: 5101 in / 464 out vs runC 5106 / 423; Q7: 4345 in / 835 out). Both `end_turn`, no truncations.

*Conclusion.* The HTTP boundary is real and behaves identically to the harness within embedding noise. The system prompt is pinned to its sha256. The two-endpoint split holds the commercialization seam open: any future UI work touches `/api/ask` only; `/api/retrieve` is for development inspection. Phase 1.2 retrieval+Q&A boundary is live on the dev machine; Phase 1.4 will productionize this boundary on Vercel after the macOS-vs-Linux binary question is resolved.

**What does not exist yet at Phase 1.2:**
- No UI. The `/api/ask` boundary is real; the front-end that consumes it is Phase 1.4.
- No observability wiring (Helicone/Langfuse). Phase 1.3.
- No production vector store, no SCOTUS corpus. Phases 5 and 6 respectively. The Phase 1.1 list above of "what does not exist yet" still holds for those items.

### Phase 1.3 — Observability wiring (Langfuse via OTel)

Phase 1.3 wires observability against Langfuse Cloud through OpenTelemetry. The Helicone-vs-Langfuse choice from the early "Observability: wired from day one" decision is resolved in favour of Langfuse — open-source / self-hostable footprint, OTel-native integration, no LLM-traffic proxy. The full architectural entry is `DECISIONS.md` ("Phase 1.3 observability — Langfuse via OTel").

**Locked artifacts (today's work — 2026-04-27):**
- `lib/observability.ts` — single audit point for what gets logged per `/api/ask` call (and per harness run when `LANGFUSE_TRACING=1`). Holds `initObservability()` (SDK boot, shared between Next.js and the harness), `withAskTrace` / `withRetrievalSpan` / `withGenerationSpan` (the three observation helpers), and `classifyError()` (single source of truth for `error.code`/`error.status` shared between the route's HTTP error mapper and the trace's failure attributes).
- `instrumentation.ts` — Next.js instrumentation hook. Calls `initObservability()` when the Node runtime starts; Edge runtime is skipped (sqlite-vec + node:sqlite are Node-only anyway).
- `app/api/ask/route.ts` — wrapped in `withAskTrace` (parent observation, holds question / k / `prompt_sha256` / source / answer) → `withRetrievalSpan` (child, captures top-K ids + scores + two hit-set hashes + latency) → `withGenerationSpan` (Langfuse `generation` observation type so the UI surfaces tokens + model in the generation panel).
- `prompts/eval/run.ts` — same wrapping as the route, but env-gated by `LANGFUSE_TRACING=1` so harness runs do not pollute the trace stream by default. `source: "harness"` distinguishes harness traces from route traces in the UI.
- `scripts/proveit-langfuse.ts` — discardable prove-it script confirming a generic Langfuse span captures a Voyage embed call. Cashed the "no Voyage example in current docs" flag from the Phase 1.3 plan; kept in the repo as a minimal smoke-test entry point for future runtime questions.
- `data/eval/lib.ts` — `loadEnv()` strips matching surrounding single/double quotes from `.env.local` values (dotenv convention). Surfaced when `LANGFUSE_BASE_URL="https://us.cloud.langfuse.com"` was being passed through to the OTel exporter with literal quotes embedded in the URL string.
- New deps in `package.json`: `@langfuse/otel`, `@langfuse/tracing`, `@opentelemetry/sdk-node`. Transitively pulls `@opentelemetry/api`, `@opentelemetry/core`, and `@langfuse/core`.

**Failure-mode discipline.** A Langfuse outage, bad keys, or any SDK error must not affect `/api/ask` behaviour. Three layers of defence: SDK init is wrapped in try/catch and returns `null` on failure (tracing disabled, route runs uninstrumented). The `with*Span` helpers wrap `startActiveObservation` in try/catch with a `started` flag and fall through to running `fn` directly when the wrapper itself fails before `fn` executes. Individual `span.update()` calls swallow per-attribute failures so a single bad attribute does not kill the trace. Verified end-to-end via the test sequence below — bogus keys produce HTTP 200 from `/api/ask` with no error propagated; bad URL produces HTTP 200 with `[observability] exporter error:` logged but request flow unaffected.

**Path from prove-it to landed slice:**

*Prove-it.* The Phase 1.3 plan flagged "no Voyage example in current docs" as a runtime unknown — it was not obvious whether wrapping a Voyage embed call inside a generic Langfuse `startActiveObservation` would produce the expected trace shape. `scripts/proveit-langfuse.ts` resolved this in one minimal script: bare SDK boot, single `startActiveObservation('publius-proveit-voyage', ...)` containing one `voyageEmbed()` call, explicit `sdk.shutdown()`. Trace appeared in Langfuse Cloud with input/output attributes intact. The integration is straightforward; the production helpers in `lib/observability.ts` build on this pattern with the failure-mode discipline added.

*Route + harness wiring.* `withAskTrace` / `withRetrievalSpan` / `withGenerationSpan` were extracted into `lib/observability.ts` rather than scattered across the route and the harness. The single audit point matters: any change to "what we log" (which attributes, hash-ordered vs hash-set, generation model, latency) lands in one diff, not two. The route imports the helpers directly; the harness imports them with an env gate (`LANGFUSE_TRACING=1`) so harness runs that don't need traces don't pay the cost or pollute the trace stream. `source: "route" | "harness"` is a top-level metadata attribute on the parent observation — the Langfuse UI's filter-by-metadata makes route traffic vs harness runs cleanly separable.

*Hit-set hashes.* `withRetrievalSpan` records two SHA-256 hashes over the top-K ids: `retrieval.top10.hash_ordered` (ranking-order, '|'-joined) and `retrieval.top10.hash_set` (alphabetically-sorted, '|'-joined). The two together give a ranking-invariant fingerprint and a ranking-sensitive fingerprint; the cross-session voyage-embedding non-determinism documented in `DECISIONS.md` ("Voyage embeddings are not bit-stable across API calls") makes both worth having. `hash_set` lets a future regression check ask "is this the same hit set?" without false-positives from rank shuffles between runs; `hash_ordered` exposes the rank shuffles when they matter.

*Bogus-key test (initial).* The Phase 1.3 plan called for a bogus-key test: with deliberately bad Langfuse keys, confirm `/api/ask` returns 200 (failure isolated), no trace appears (failure complete), and the SDK error is logged not propagated. Initial run with bogus public+secret keys: HTTP 200 returned from `/api/ask`, no trace appeared in the UI, and no errors in server logs. The first three observable conditions matched the plan; the fourth — "logged not propagated" — was satisfied for "not propagated" but produced silence rather than a `console.error`.

*Silent-failure investigation.* The owner flagged the silent-failure observation as a real spec deviation, not an ops note: the Phase 1.3 plan said "flush/network errors swallowed and console.error'd." Investigation traced the silence to two missing OTel hooks. The OTLP fetch transport calls `diag.warn` / `diag.error` directly for HTTP / network failures, but the default `diag` logger is a no-op. The BatchSpanProcessor's export-result path goes through `globalErrorHandler` from `@opentelemetry/core`, which defaults to a `loggingErrorHandler` that calls `diag.error` — so even that path is silenced when `diag` is no-op'd. Both hooks needed installing.

*Hook installation and validation.* `initObservability()` now sets `diag.setLogger` at `DiagLogLevel.WARN` (mapping `warn`/`error` to `console.error` with an `[observability]` prefix) and registers a `setGlobalErrorHandler` that does the same. With both hooks in place, re-ran the bogus-key scenario — still silent. Lowered `diag` to `DiagLogLevel.ALL` to surface the underlying transport behaviour, which revealed `[obs:verbose] Export succeeded after 0 retry attempts.` Root cause: Langfuse Cloud's OTLP endpoint accepts unknown public keys with HTTP 2xx and filters server-side, so a bad public key produces no transport error to log. The hooks were correctly installed; there was simply no failure for them to surface.

*DNS-failure validation.* To confirm the hooks fire on actual transport failures, set `LANGFUSE_BASE_URL=https://nonexistent-publius-test.invalid` and re-ran the harness with `LANGFUSE_TRACING=1`. Output included `[observability] exporter error: Error: getaddrinfo ENOTFOUND nonexistent-publius-test.invalid` from the global error handler and `[observability] sdk.shutdown failed: ...` from the existing shutdown catch. Repeated the same scenario under the Next.js dev server hitting `/api/ask`; same `[observability] exporter error:` lines surfaced after the BatchSpanProcessor's batch flush. Both contexts produced the expected error logs without affecting request flow. Reverted `diag` log level to `WARN`.

*The bad-credentials silence as a known limitation.* The owner confirmed reading the spec literally — "network errors" means DNS / connection refused / HTTP 4xx/5xx from a real endpoint, all of which now fire the hook. The bad-credentials silence is a Langfuse architecture choice (server-side key filter behind an HTTP 2xx endpoint), not something OTel can detect through the per-request hook. Captured this in `DECISIONS.md` as a known limitation with operational guidance: "if traces stop appearing without console errors, suspect credential rotation first." A future startup-time auth probe slice would close this gap if needed; not in scope for Phase 1.3.

*Real-keys validation.* With real keys and the dev server running, `/api/ask` produced a `publius-ask` trace in the Langfuse UI with `retrieval` (0.72s) and `generation` (1.93s, 1920→31 tokens) children, `source=route`, `prompt_sha256` matching runC's pin, and `k=3`. All four spec checks land: HTTP 200, trace present in UI, retrieval hash + scores + latency captured, generation tokens + model + latency captured.

**Conclusion.** Phase 1.3 observability is wired and validated. Both the route and the harness emit traces through a single audit point. The error-mode discipline is verified — bogus keys do not break the route, transport failures log with an `[observability]` prefix, and the bad-credentials silence is documented as a known limitation. The README's new Operations section points operators at Langfuse Cloud and at the credential-rotation operational guidance.

**What does not exist yet at Phase 1.3:**
- No startup-time auth probe to detect bad credentials (deferred; documented as a known limitation in `DECISIONS.md`).
- No production env vars on Vercel (Phase 1.4 deploy checklist).
- No UI; no production vector store; no SCOTUS corpus. Phases 1.4, 5, and 6 respectively.

## Implementation patterns established during this work

These are patterns, not session notes — they constrain how Phases 1.2 onward should be built.

### The cross-corpus schema is universal-base + typed extensions

Every item across every corpus shares a base schema (id, corpus, item type, authors, dates, text, paragraphs, footnotes). Each corpus then adds a single namespaced extension object — `federalist: { ... }`, `tocqueville: { ... }`, eventually `court: { ... }` — for fields specific to that corpus. New corpora must conform, not introduce one-off structures. `data/SCHEMA.md` is the authority.

`plain_english` (a Phase 4 register-modernization field for English-source corpora, generated via Claude Batch API) and `translation` (a Phase 4 cross-language field for Tocqueville, owner-authored) are intentionally separate fields with different workflows. These were originally a single field and were split during Phase 0 implementation — do not propose merging them. The `translation` field on Tocqueville items currently sits as `null` placeholder across all 124 items; populating it is the editorial gate before Tocqueville enters the index.

### Chunking is paragraph-level body + one chunk per footnote, with header context embedded in the chunk text

A retrieval chunk is not a bare paragraph. It is the paragraph (or footnote) prefixed with a header — paper number, title, authors — separated by a blank line:

```
Federalist No. 78 — The Judiciary Department
Author: Hamilton

To the People of the State of New York: WE PROCEED now to an examination of the judiciary department...
```

This is a deliberate trade. It costs a few tokens per chunk but lets the embedding space encode authorship and paper context, which the probe set verified does not break ranking. If chunk format changes, the probe set must be re-run and re-signed before the new format is treated as accepted.

Footnotes are chunked separately, not glued onto their host paragraph. The probe set includes specific footnote-targeting probes (P05/P06/P07) to verify body-vs-footnote discrimination at retrieval time.

### The retrieval stack uses zero npm dependencies

The Phase 1.1 retrieval path uses Node 22.5+ built-in `node:sqlite` and the `sqlite-vec` extension binary loaded at runtime from `data/eval/vendor/`. The vendor directory is gitignored — every contributor fetches their own platform-appropriate binary per `data/eval/README.md`. This is the deliberate baseline for local retrieval and should be preserved unless there is a concrete reason to introduce a vector-store dependency.

The two non-obvious binding rules learned the hard way:
- `node:sqlite` does not bind raw `ArrayBuffer`. Wrap embedding bytes as `Uint8Array` over the `Float32Array` buffer.
- `sqlite-vec`'s `vec0` virtual table demands `SQLITE_INTEGER` for primary-key bindings. Pass `BigInt(rowid)` to inserts on `chunks_vec`.

Both are in the code; mention here only so an advisor reading the source isn't surprised by them.

### The probe set is a regression artifact, not a one-time test

`data/eval/probes.json` and `data/eval/results-phase1-1.md` together form the regression bar. The probe set must be re-run and re-signed if any of the following change: the corpus content (a regenerate of `federalist.json` or `tocqueville.json`), the chunk format in `data/eval/lib.ts`, or the embedding model. Adding a probe to the active set is preferred over loosening the existing pass bar. The probes were designed against actual content (specific footnote markers, specific authorship-edge cases, a deliberate negative-space probe), not against vague topical similarity.

### Retrieval results carry the metadata the Q&A layer needs to preserve epistemic distinctions

`queryIndex()` in `data/eval/query.ts` returns `Hit` objects with full metadata: `corpus`, `kind` (body / footnote), `item_id`, `paragraph_index` or `marker`, `paper_number`, `title`, `authors`, `authorship_status`, `date`, plus the chunk text and similarity score. This is deliberate. The argument/observation/holding distinction non-negotiated in `CLAUDE.md` is impossible to preserve at the Q&A layer if retrieval flattens the metadata. Don't propose a Phase 1.2 Q&A interface that strips this metadata before passing context to the model.

## Current state of the repository

**What exists in the repo:**
- Cross-corpus schema documentation (`data/SCHEMA.md`).
- Federalist corpus (raw text, parser, parsed JSON, source-fixup layer).
- Tocqueville corpus (raw French text per volume, parser, parsed JSON with `translation: null` placeholders).
- Phase 1.1 retrieval test (`data/eval/`): probe set, library helpers, index builder, query CLI, probe runner, retrieval-test definition, operational README, frozen results artifact for the sign-off.
- Standing-decision docs at the project root (`CLAUDE.md`, `DECISIONS.md`, `README.md`).
- Per-session notes under `notes/` (chronological, not authoritative).
- Vercel project pointed at `ginsudo/publius`, currently serving a 404 because no app code exists.

**What is stubbed:**
- The `translation` field on every Tocqueville item is `null`. Tocqueville will not enter the retrieval index until the owner populates this field. This is a deliberate gate, not a TODO.
- The probe set has three probes (P14, P15, P16) flagged `phase_5_only: true` — two cross-corpus probes and one Tocqueville end-note probe. They are recorded for design intent and skipped by the current runner.
- The local index file `data/eval/index.sqlite` and the `sqlite-vec` extension binary in `data/eval/vendor/` are gitignored and rebuilt per machine.

**What does not exist yet:**
- No Q&A or generation code. `queryIndex()` returns hits; nothing reads them and prompts a model.
- No system prompt. The Q&A system prompt is identified in `CLAUDE.md` as the highest-stakes artifact in the project; it has not been drafted.
- No HTTP boundary, no Next.js routes, no `app/` directory contents, no UI.
- No observability wiring (Helicone or Langfuse). Per `DECISIONS.md` this is wired at the first Vercel deploy with Q&A, not earlier.
- No production vector store. `index.sqlite` is local-only. The Turso vs. Pinecone production decision is deferred to Phase 5.
- No SCOTUS corpus, no fourth-corpus epistemic tag, no critical-theory corpus.
- No reranker, no hybrid retrieval, no cross-encoder. The Phase 1.1 sign-off found `voyage-4-large` raw similarity ranking adequate; `voyage-law-2` is documented as the next thing to try if results regress.

## What a fresh advisor needs to know to advise on Phase 1.2 onward

**The next slice is Phase 1.2 — Q&A layer.** This means wrapping `queryIndex()` with a Claude API call (Sonnet 4.6 per `DECISIONS.md`), passing the retrieved hits as structured context, asking the model the user's question, and returning an answered text with citations back to the chunks. Two things should be designed before code:

1. **The system prompt.** This is the artifact `CLAUDE.md` calls highest-stakes. It must enforce the no-flattening discipline — never synthesize a false consensus across authors or modes; surface Hamilton-vs-Madison disagreement and (later) majority-vs-dissent disagreement when present. It must also handle the case where retrieval returns hits the question doesn't actually need, and the case where the question is out-of-corpus (the negative-space probe P13 was designed against this scenario at the retrieval layer; the system prompt has to handle it at the answer layer). Drafting the system prompt is owner-set; testing it against 10–15 real questions is a Claude Code job per `CLAUDE.md`.

2. **The HTTP boundary.** Phase 1.2 is the natural moment to introduce Next.js. An API route at `/app/api/ask` that takes a question, calls `queryIndex()`, calls Claude, returns the text plus citations. Still no UI — UI is Phase 1.4 onward. The Phase 1.4 work (Vercel deploy + observability) follows from this boundary existing.

**Do not:**
- Add a fourth corpus before resolving its epistemic tag (the argument/observation/holding taxonomy is adequate for the first three corpora; a fourth needs a fourth category, owner's call).
- Migrate to Turso or Pinecone yet — that's Phase 5.
- Add a UI ahead of the system prompt being tested.
- Change the chunk format without re-running the probe set and re-getting owner sign-off.
- Strip retrieval metadata before passing to the model. The Q&A layer needs `corpus`, `kind`, `authorship_status`, paper number, and authors to do its job.
- Propose generalizing Publius into a meta-product (configurable for any base text + corpora). Refused per `DECISIONS.md` ("Meta-product generalization: refused; two architectural seams kept open"). Two seams are intentionally preserved: parameterized modes of authority in the Phase 3.2 system prompt, and Constitution-as-first-class-corpus at Phase 6 with `constitutional_section` migrating to an ID reference. The corresponding `data/SCHEMA.md` migration is deferred until Phase 6 begins — flagged in `DECISIONS.md` so it does not fall off the radar.

**Do consider:**
- How citations should appear in the model's answer. The frozen results artifact shows the metadata we have; the Q&A interface needs to decide which subset is shown to the user and which is system-internal.
- How to handle the disputed-twelve papers in citations. `authorship_status: "disputed"` is in every Hit; the Q&A layer should not silently pick one attribution.
- How the answer should behave when retrieval returns out-of-corpus or weak matches. P13 demonstrated the embedding space separates in-domain from out-of-domain; the Q&A layer needs to take advantage of this rather than confabulating from weak matches.

**Reference points across the project files:**
- `CLAUDE.md` — standing project decisions, including the epistemic distinction and the no-flattening rule.
- `DECISIONS.md` — architectural decisions with reasoning, including the Phase 1.1 sign-off entry.
- `data/SCHEMA.md` — the cross-corpus data schema.
- `data/eval/RETRIEVAL_TEST.md` — what the retrieval test proves and what is deliberately out of scope.
- `data/eval/results-phase1-1.md` — the frozen sign-off artifact.
- `publius_project_plan.md` — the long-form project plan.
