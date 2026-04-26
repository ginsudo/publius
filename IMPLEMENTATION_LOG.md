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
- `publius_project_plan.docx` — the long-form project plan.
