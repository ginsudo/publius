# data/eval — Phase 1.1 retrieval test

See `RETRIEVAL_TEST.md` for what this test proves and how it passes. This file is operational: how to set up and run it.

## One-time setup

### 1. Voyage API key

Sign up at https://www.voyageai.com/, generate an API key, and put it in `.env.local` at the repo root:

```
VOYAGE_API_KEY=<your key>
```

The variable name is already in `.env.local` (gitignored); you only need to fill in the value.

### 2. sqlite-vec extension binary

`build-index.ts` and `query.ts` use Node's built-in `node:sqlite` and load the [sqlite-vec](https://github.com/asg017/sqlite-vec) extension as a binary. Two platforms are vendored at **v0.1.6** and committed to the repo:

- `vendor/vec0.dylib` — macOS arm64 (development).
- `vendor/vec0.so` — Linux x86_64 (Vercel deployment).

`lib.ts` selects the right one at load time via `process.platform`. Version parity across both binaries is load-bearing — do not upgrade one without upgrading the other and re-running the probe set.

For other platforms (Intel Macs, etc.), fetch the matching v0.1.6 release into `vendor/` locally; do not commit non-arm64-mac / non-linux-x86_64 binaries.

```bash
# Example: Intel Mac
cd data/eval/vendor
VERSION=v0.1.6
ARCHIVE="sqlite-vec-${VERSION#v}-loadable-macos-x86_64.tar.gz"
curl -L "https://github.com/asg017/sqlite-vec/releases/download/${VERSION}/${ARCHIVE}" -o "${ARCHIVE}"
tar -xzf "${ARCHIVE}"
rm "${ARCHIVE}"
```

`lib.ts`'s `findVecExtension()` will then need a third platform branch (or temporary local edit) — flag this if a non-Mac-arm64 / non-Linux-x86_64 contributor environment becomes load-bearing.

## Run

```bash
# Build the index (~1 minute, ~$0.10 in Voyage API cost)
node --experimental-strip-types data/eval/build-index.ts

# Run the active probe set, write data/eval/results.md
node --experimental-strip-types data/eval/run.ts

# Optional: ad-hoc query
node --experimental-strip-types data/eval/query.ts "your question" --k=10
```

After `run.ts` finishes, open `results.md` and fill in the `Owner judgment` line for each probe. The test passes when every active probe is signed off — see `RETRIEVAL_TEST.md`.

## Re-running

`build-index.ts` is idempotent — it drops and recreates the tables, then rebuilds. Re-run it whenever:

- The Federalist corpus regenerates (`data/federalist/federalist.json` changes).
- The chunk format in `lib.ts` changes.
- You want a different embedding model (edit `EMBEDDING_MODEL` in `lib.ts`).

`run.ts` reads the existing `index.sqlite` — no rebuild required between runs unless the index has staled.

## Troubleshooting

- **`VOYAGE_API_KEY not set`** — set it in `.env.local`. The file is gitignored; never commit it.
- **`sqlite-vec extension binary missing`** — the committed binary for your platform is missing. On macOS arm64 or Linux x86_64, the binary should be in `vendor/`; if it's not, your checkout is incomplete. On other platforms, see the fetch step above.
- **`Unsupported platform for sqlite-vec`** — you're not on macOS arm64 or Linux x86_64. Vendor a matching binary locally; see the fetch step above.
- **`Voyage API 401`** — bad API key. Regenerate one in the Voyage console and update `.env.local`.
- **`Voyage API 429`** — rate limited. The runner does not retry; wait a moment and re-run.
- **Node version error** — requires Node 22.5+ for `node:sqlite`. Yesterday's session notes recorded Node 25.9 on the Mac Studio.

## Files in this directory

| File | Purpose | Tracked? |
|------|---------|----------|
| `RETRIEVAL_TEST.md` | What the test proves; pass criteria | yes |
| `README.md` | This file — setup and run | yes |
| `probes.json` | Probe set | yes |
| `lib.ts` | Shared helpers (env, Voyage, sqlite-vec) | yes |
| `build-index.ts` | Chunk + embed + write index | yes |
| `query.ts` | CLI single-question query | yes |
| `run.ts` | Probe-set runner, writes results.md | yes |
| `index.sqlite` | The vector store | yes (committed; deterministic rebuild from corpus + embedding model) |
| `vendor/vec0.dylib` | sqlite-vec macOS arm64 (v0.1.6) | yes |
| `vendor/vec0.so` | sqlite-vec Linux x86_64 (v0.1.6) | yes |
| `results.md` | Latest probe-run report | gitignored |
