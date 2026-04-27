# CLAUDE.md — Publius Project

This file is read automatically at the start of every Claude Code session. It encodes standing decisions that are not up for re-litigation. When a suggestion conflicts with anything here, that is a bug in the model's behavior — correct it and consider whether this file needs to be tighter. When a new standing decision is made mid-project, it goes here immediately.

---

## Core Design Principles

**The corpus is designed to be extensible and the user controls dialogue composition. These are first-class design principles, not later additions. Every architectural decision should preserve them.** See the Long-Term Architecture section of the project plan (`publius_project_plan.md`) for the full rationale.

The three-corpus structure (Federalist Papers, Tocqueville, Supreme Court opinions) is the foundation. Future corpora — critical legal theory, political philosophy, dissenting traditions — will be added by the user's choice, not the developer's. The corpus pipeline must be parameterized by corpus from day one, with consistent metadata schemas, so adding a new body of work never requires rebuilding the retrieval layer.

---

## The Epistemic Distinction — Non-Negotiable

The Q&A layer must always distinguish between three modes of authority:

- **Argument** — what Hamilton, Madison, or Jay argued the Constitution meant (Federalist Papers)
- **Observation** — what Tocqueville observed American constitutional culture actually doing (Democracy in America)
- **Holding and reasoning** — what the Court held, how it reasoned, and what dissents argued the Court got wrong (Supreme Court opinions)

These are not interchangeable. Never flatten them into a single voice. Never synthesize a false consensus across them.

**Open question — fourth epistemic category:** The argument/observation/holding taxonomy is adequate for the first three corpora. It will require extension before any fourth corpus enters the product (CLS, political philosophy, or other traditions that critique rather than operate within the framework). Do not add a new corpus without first resolving how it will be epistemically tagged. This is a design decision for the project owner, not Claude Code.

---

## The No-Flattening Rule

- Do not editorialize toward any interpretive school
- Do not synthesize a false consensus where genuine disagreement exists
- Surface disagreements between authors (Hamilton vs. Madison), between justices (majority vs. dissent), and across corpora (what the founders argued vs. what the Court eventually held)
- Originalist and living constitutionalist readings of the same provision should both appear when they exist

---

## Fixed Technical Stack

Do not revisit these without a concrete reason from the project owner:

- **Framework:** Next.js (App Router, TypeScript, Tailwind CSS)
- **Desktop:** Electron wrapper — same codebase, no feature divergence
- **Corpus storage:** Static JSON in repo
- **Vector store:** sqlite-vec locally; Turso or Pinecone for Vercel production
- **LLM runtime:** Claude API — Sonnet 4.6 for Q&A; Batch API for plain English generation
- **Hosting:** Vercel (web); Electron build pipeline (desktop)
- **DNS/CDN:** Cloudflare
- **Observability:** Helicone or Langfuse — wired from day one, not added later
- **Dev environment:** Development happens on a MacBook Air (macOS arm64). The project does not depend on any specific local machine — any macOS arm64 machine running Node 22.5+ can build and run the dev environment. The `data/eval/vendor/vec0.dylib` is platform-specific; non-Apple-Silicon machines would require a different binary build. Vercel deployment requires a Linux binary per the deferred decision in DECISIONS.md.

---

## Corpus Hierarchy

When scope questions arise, sequence matters:

1. Federalist Papers (Phases 1–3)
2. Tocqueville, Volume I (Phase 4–5)
3. Tocqueville, Volume II (Phase 5, subsequent)
4. Supreme Court opinions — curated list, owner's decision alone (Phase 6)
5. Additional corpora — owner decides, epistemic tag resolved first (Phase 8+)

Do not add scope to a later phase at the expense of a current one.

---

## File and Code Conventions

- Corpora live in `/data/` — parameterized by corpus slug (e.g., `/data/federalist/`, `/data/tocqueville/`, `/data/court/`)
- API routes live in `/app/api/`
- Components live in `/components/`
- Corpus JSON schema must be consistent across all corpora to support extensibility — any new corpus must conform to the shared schema, not introduce a one-off structure
- The retrieval test (Phase 1.1) is mandatory before any UI is built — do not skip it

---

## The System Prompt

The system prompt for the Q&A layer is the highest-stakes artifact in the project. Claude Code drafts and runs tests against it; the project owner sets it. Do not treat a system prompt that produces plausible-sounding output as done — test it against 10–15 questions spanning easy and hard cases, including cases where genuine disagreement should surface and where a naive model would flatten it.

---

## What This Project Is Not

- Not a general-purpose constitutional chatbot
- Not a civics education tool
- Not politically aligned with any interpretive school
- Not a product for a mass audience
- Not a tool that decides which voices speak to each other — the user does that

---

## IMPLEMENTATION_LOG.md and session close

**IMPLEMENTATION_LOG.md is updated before any session ends.** Every session that produces substantive work — experiments, prompt changes, architectural decisions, scope changes, conceptual reframings — appends a path-narrative entry to IMPLEMENTATION_LOG.md as part of session close. The entry covers what was attempted, what was found, what was decided, and why — not just the resulting state. State changes belong in DECISIONS.md; the path that produced them belongs in IMPLEMENTATION_LOG.md.

If a session ends without an IMPLEMENTATION_LOG entry, that is a failure of the session, not an optional skip. The session is not complete until the entry is in.

Sessions that produce no substantive work (a quick lookup, a tooling check, a question with no decision attached) do not need an entry. The judgment call is whether a future session would benefit from knowing what happened in this one. When in doubt, write the entry.

---

## The two records, distinguished

- **DECISIONS.md** — standing decisions and their rationale. *What was decided.* Refer to it when wondering "should we use Pinecone or Turso?" — the answer is there.
- **IMPLEMENTATION_LOG.md** — historical record of what got built and why. *The path.* Refer to it when wondering "why does v0.2's closing section work the way it does?" — the experimental story is there.

Both are updated through the project. State changes go in DECISIONS.md; path-and-reasoning go in IMPLEMENTATION_LOG.md. They are not redundant.

---

*Last updated: April 2026. Update this file whenever a new standing decision is made.*
