# Phase 1.1 retrieval test

The mandatory retrieval test required by `CLAUDE.md` ("The retrieval test is mandatory before any UI is built — do not skip it") and the project plan.

## What this test proves

Given a hand-curated probe set (`probes.json`), retrieval over the Federalist corpus returns the chunks the project owner judges relevant — and does so with the corpus discriminator, item id, kind (body / footnote), and authorship metadata intact on every result row, so a downstream Q&A layer can preserve the epistemic distinctions documented in `CLAUDE.md` ("argument vs. observation vs. holding") rather than flattening them.

The test is **Federalist-only** by design (Phase 1.1). Tocqueville rejoins the index in Phase 5 once the `translation` field is populated, at which point the cross-corpus probes (`P14`, `P15`, `P16`) become active. They are recorded now to lock the design intent rather than treated as afterthoughts.

## What "pass" means

**Qualitative owner sign-off, not an automated metric.** The runner produces a markdown report (`results.md`) with the top-K hits for each active probe. The project owner reads the hits and fills in the `Owner judgment` line per probe. The test passes when every active probe's judgment is `pass` (or any `partial` / `fail` is documented and acceptable as a known gap).

The runner reports a `must_include` hit/miss check as a sanity signal. This is **not** the pass criterion. A probe whose `must_include` items don't appear in top-K is a yellow flag worth investigation, but a probe with all `must_include` items present can still fail if the surrounding hits are wrong, and a probe whose `must_include` items are missing can still pass if the actual top hits answer the question well in some other way.

## What is deliberately out of scope

- **Q&A / generation layer.** This test exercises retrieval only. Whether the system would answer the question correctly is a Phase 1.2+ concern; whether the answer maintains the no-flattening discipline is a Phase 3 system-prompt concern.
- **Reranking.** No cross-encoder rerank. If voyage-4-large's raw similarity ranking is inadequate, that's a finding to act on — not something to paper over with a rerank stage.
- **UI.** No frontend. Per `CLAUDE.md`, retrieval is verified before UI work begins.
- **Production storage.** `index.sqlite` is local-only, gitignored. The Turso vs. Pinecone production decision is deferred to Phase 5 per `DECISIONS.md`.
- **Observability (Helicone / Langfuse).** Wired at Phase 1.4 (first Vercel deploy with Q&A), not here. Voyage-side cost is reported by the runner directly from the API's `usage.total_tokens`.
- **Tocqueville retrieval.** Phase 5 work (after `translation` is populated). Probes `P14`, `P15`, `P16` are recorded as `phase_5_only: true` and skipped by the runner.

## How to run

See `README.md` for the one-time setup (sqlite-vec extension binary, `VOYAGE_API_KEY`).

```bash
# Build the index (~1 minute, sub-dollar in API cost)
node --experimental-strip-types data/eval/build-index.ts

# Run all active probes against the index, write results.md
node --experimental-strip-types data/eval/run.ts

# Optional: query the index ad-hoc
node --experimental-strip-types data/eval/query.ts "your question" --k=10
```

## Failure-mode triage

If the report comes back with multiple `fail` judgments, the order of investigation:

1. **Re-read the chunk text** of the failing hits in `results.md`. The chunk text includes the paper-number / title / author header that was embedded; if a chunk is being pulled because of header overlap rather than body content, that's a chunking-format issue.
2. **Compare a footnote probe (`P05`, `P06`, `P07`) against its body counterpoint.** If `P05` and `P11` return the same chunks, the chunking didn't discriminate body from footnote.
3. **Compare scores against the negative-space probe (`P13`).** If `P13`'s top-1 score is comparable to in-corpus probes, the embedding space isn't separating in-domain from out-of-domain — a calibration issue, not a retrieval bug per se.
4. **Re-run with `voyage-law-2` for comparison** (per the deferral note in `DECISIONS.md` "Embedding model"). This is the documented next step before any other tuning.

## Files

- `probes.json` — the probe set (16 probes; 13 active for Phase 1.1, 3 deferred to Phase 5).
- `lib.ts` — shared helpers (env, Voyage HTTP, sqlite-vec).
- `build-index.ts` — chunk + embed + write `index.sqlite`.
- `query.ts` — CLI single-question query.
- `run.ts` — runs the active probes, writes `results.md`.
- `results.md` — the report (gitignored; regenerated each run).
- `index.sqlite` — the local vector store (gitignored).
- `vendor/` — sqlite-vec extension binary (gitignored; see `README.md`).
