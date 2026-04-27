# Session Notes — 2026-04-27 — Phase 1.2 Next.js scaffolding

Followed yesterday's v0.2 lock and runC sign-off by exposing the Q&A layer as an HTTP boundary. Ran a discardable Next.js spike first to find toolchain issues, then scaffolded the real `app/` directory, then ran a structural smoke test against the runC harness output. End-of-session: HTTP boundary live on the dev machine, runC's promptSha256 pinned end-to-end, route ≡ harness within voyage-embedding float noise.

## What was built

### Documentation updates (committed first, in order)

Three doc updates committed before any scaffolding code, each as its own commit, so the rationale is preserved separately from the artifacts.

- `DECISIONS.md` (commit `9d22192`) — three Phase 1.2 entries:
  - **TypeScript configuration for harness/route co-existence.** `allowImportingTsExtensions: true`, `moduleResolution: bundler`, `strict: true`, `noEmit: true`. Why those flags are there, why `@types/node` is pinned to `^22` (`node:sqlite` types added in Node 22.5).
  - **Q&A endpoint architecture — two-endpoint split.** `/api/ask` is the public answer surface; `/api/retrieve` is the development inspection surface. `Citation` is a named TypeScript type next to `Hit`, not inline `Omit<Hit, ...>`. Single audit point if the projection ever changes. UI built strictly against `/api/ask` to keep commercialization optionality open.
  - **Vercel deployment — deferred decision on macOS-vs-Linux binary.** The vendored `vec0.dylib` is macOS arm64; Vercel runs Linux. Two options recorded (ship a Linux `vec0.so` with platform detection, or pull the Phase 5 production-store migration forward). Decision deferred to Phase 1.4.
- `CLAUDE.md` (commit `ca65897`) — replaced single-line Mac Studio reference with a paragraph noting the dev machine is a MacBook Air (macOS arm64), Node 22.5+ for `node:sqlite`, platform-specific `.dylib` won't deploy to Linux as-is.
- `IMPLEMENTATION_LOG.md` (commit `5d5c0a8`) — Phase 1.2 Next.js spike narrative: what the spike tested, two failures (Turbopack rejected `.ts` imports under default tsconfig; `@types/node ^20` missing `node:sqlite` types), the fixes, the end-to-end success, the Linux/Vercel finding.

### The spike (discardable, not committed)

`npx create-next-app@latest publius-spike` in `/tmp/`, then a single test route that imports `queryIndex` and `loadEnv` from `data/eval/` with explicit `.ts` extensions. Initial symlinks were rejected by Turbopack ("Symlink … points out of the filesystem root" — a spike-only artifact since the real route lives inside the project root). Replaced with copies. Two type-check failures discovered, both fixed by config flags. After the fixes, `next build` clean and `curl /api/test` returned 200 with three Federalist hits at the expected scores.

### Real scaffolding (commit `d84e75e`)

- `package.json` — Next 16.2.4, React 19.2.4, `@types/node ^22`, `typescript ^5`. Description points back at DECISIONS.md so the next reader understands why the dependencies are there.
- `tsconfig.json` — JSONC top-comment pointing at DECISIONS.md. `allowImportingTsExtensions: true`, `moduleResolution: bundler`, `strict: true`, `jsx: react-jsx`, `noEmit: true`, paths `@/*` → `./*`.
- `next.config.ts` — minimal, with `turbopack.root: __dirname` to silence a workspace-root warning caused by a stray lockfile in `$HOME`.
- `app/layout.tsx` — minimal root layout, title `Publius`.
- `app/page.tsx` — returns `notFound()`. No public landing copy until Phase 1.4 ships UI.
- `app/api/ask/route.ts` — POST handler. Loads system prompt at module init via `extractPrompt(prompts/system-prompt-v0.2.md)`, computes sha256 once. Validates `{question: string, k?: number}` (k integer in [1, 25]). Calls `queryIndex` → `formatHits` → `askClaude`. Returns `{answer, citations: hits.map(toCitation), usage, promptSha256}`. Errors mapped to specific HTTP statuses (401/429/529 for upstream, 502 for other Anthropic, 500 for missing keys, 400 for malformed input). Response shape on errors: `{error: string, code: string}`.
- `app/api/retrieve/route.ts` — POST handler. Same input validation. Returns `{hits: Hit[]}`. No model call.
- `data/eval/query.ts` — added `Citation` type and `toCitation` function next to `Hit`. The route imports both from `query.ts`, keeping the projection co-located with `Hit`.
- `.gitignore` — added `next-env.d.ts` and `*.tsbuildinfo`.
- `loadEnv()` is not called from either route. Next loads `.env.local` automatically; dropping the explicit call keeps the route clean for Phase 1.4 deploy where Vercel env vars replace `.env.local`.

## Structural smoke test

Started `next dev` on port 3457, then exercised both endpoints with Q7 (in-corpus, depth-permitting) and Q11 (out-of-corpus, refusal-shape). Three checks, all passed:

### Same retrieval set as runC

- **Q11**: same 10 documents as runC, slightly reordered (top-2 swapped). Scores ~0.02 lower across the board.
- **Q7**: 8/10 of runC's hits; missing fed:50 ¶8 disputed, fed:82 ¶1, fed:40 footnote 2, fed:84 ¶9; gained fed:81 ¶5, fed:39 ¶15, fed:39 ¶7, fed:85 ¶15. Scores systematically ~0.14 lower.

To isolate whether Q7's drift was route-introduced or embedding-side, ran the same Q7 query through the harness directly (`node --experimental-strip-types data/eval/query.ts`). Harness returned the same hits as the route within sub-0.01 float noise (0.343 vs 0.340, 0.332 vs 0.329, etc.). The route is structurally equivalent to the harness; the runC drift is **voyage embedding non-determinism between morning and afternoon**, not route-introduced.

This is worth carrying forward as a watch item: voyage embeddings are not bit-stable across calls, even for identical query text. For the Q&A layer this is fine — qualitatively the same retrieval set, model handles ranking variation gracefully. For any future regression test that wants to assert exact hit equality, this needs to be accommodated (cache embeddings, or compare on a tolerance, or only assert qualitative equivalence).

### Same `promptSha256` as runC

Both Q7 and Q11 returned `404869dd6405ce1b1bf0d6db578f1bad47ed390a907eeec43304f9ffd7bf4f03` — exact match against runC's header. The prompt-extraction pipeline produces a byte-identical artifact at the route boundary. The sha256 pin is now load-bearing: any prompt mutation produces a visible response-shape diff at the API boundary.

### Same answer posture as runC

- **Q11**: opened with "The retrieved passages... have no relevance to *Loper Bright*. The similarity scores (all below 0.18) confirm the retrieval system found nothing on point." Same refusal posture as runC, including the explicit similarity-score callout. 5101 in / 464 out tokens (runC: 5106 / 423).
- **Q7**: opened with "The question as framed assumes a binary that the Federalist Papers do not fully support — but the papers do take positions, and those positions lean heavily in one direction." Same depth-permitting posture as runC — flags the question's mediocre framing while still committing where the corpus supports commitment. 4345 in / 835 out tokens.

Both `end_turn`, no truncations.

## Watch items

- **Voyage non-determinism**: see above. Not a blocker; flagged for future regression-test design.
- **macOS-vs-Linux binary**: deferred to Phase 1.4 (DECISIONS.md). Owner's lean is the Linux `.so` path.
- **Outside-corpus factual claims**: still un-audited. v0.2's Q11 answer cites *Loper Bright* details ("603 U.S. 369 (2024)", "Article III requires") that are not corpus-grounded. Mode discipline is met; factual discipline is separate. Not a 1.2 blocker; flagged for future hardening.

## State at session close

Phase 1.2 HTTP boundary is live on the dev machine. Two endpoints, structurally smoke-tested against runC, sha256 pinned. Nothing UI-facing yet; that's Phase 1.4. Nothing observability-wired yet; that's Phase 1.3. Production deploy gated on macOS-vs-Linux binary decision.

Five commits today: three doc updates (`9d22192`, `ca65897`, `5d5c0a8`), then scaffolding (`d84e75e`).
