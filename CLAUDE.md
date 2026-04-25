# CLAUDE.md — Publius

Persistent project context for Claude Code sessions. Read this at the start of every session. When something here conflicts with a request in a session, the rule here wins unless the user explicitly overrides it.

## What Publius is

Publius is a precision constitutional intelligence platform for serious students of constitutional interpretation — the audience trained in the Murphy and George courses at Princeton and the Dworkin seminar on legal rights. It is not a civics app, not a legal research tool, not a general-purpose chatbot. The value of the product comes from precision and intellectual seriousness, not breadth.

## The three-corpus epistemic distinction

The Q&A layer must always distinguish three modes of authority:

- **Argument** — what Hamilton, Madison, or Jay argued the Constitution meant or should mean (Federalist Papers, 1787–88)
- **Observation** — what Tocqueville observed American constitutional culture actually doing (Democracy in America, 1835/1840)
- **Holding and reasoning** — what the Court held, how it reasoned, and what dissents argued the Court got wrong (curated Supreme Court opinions)

These are not interchangeable. Never flatten them into a single voice or synthesize a false consensus across them.

## Interpretive neutrality

The product surfaces arguments, not verdicts. Originalist and living constitutionalist readings of the same provision both appear when they exist. Scalia's dissent in Morrison v. Olson may matter more to the intellectual tradition than the majority. Never editorialize toward any interpretive school.

## Translation standard

Plain English renderings preserve every argument, every logical step, every distinction the original makes. Easier to read is not a license to simplify. Flag any passage where the rendering is genuinely uncertain rather than smoothing over it. Editorial review by the project owner is the quality gate — not Claude's judgment alone.

## Corpus hierarchy

Sequence is fixed: Federalist Papers first, Tocqueville Volume I second, Tocqueville Volume II third, curated Supreme Court cases fourth. Do not add scope to a later phase at the expense of a current one.

The Tocqueville source of record is the French original (De la démocratie en Amérique, 1835/1840) — not any existing English translation. The English version is the owner's intellectual work.

The Phase 6 case list is the owner's decision alone.

## Technical stack — fixed, do not revisit without concrete reason

- Framework: Next.js (App Router, TypeScript, Tailwind)
- LLM: Claude API, Sonnet 4.6 for Q&A, Batch API for plain English generation
- Vector store: sqlite-vec locally, Turso or Pinecone on Vercel production
- Desktop: Electron wrapper, same codebase, no feature divergence
- Hosting: Vercel
- DNS/CDN: Cloudflare
- Observability: Helicone or Langfuse, wired from day one

The Mac Studio or the Macbook Air used by owner is the development and build machine. It is not a production server.

## Code conventions

- Corpora live in `/data/<corpus-name>/` (e.g., `/data/federalist/`)
- API routes live in `/app/api/`
- Components live in `/components/`
- End-of-session summaries live in `/notes/`, dated, committed

## Working discipline

- One feature at a time, end to end. Smallest testable slice, not "build the reader."
- Always ask for the plan before executing anything significant. Walk through what files you'd touch, what assumptions you're making, what you'd want confirmed.
- Do not install dependencies casually. Each one is a decision — name the alternative and what it pulls in.
- Read diffs before changes are accepted. Re-view files before editing them again later in the same session.
- Retrieval quality gets verified before any UI is built (Phase 1). No exceptions.
- Tests around retrieval and Q&A response shape — these systems will change repeatedly.

## Diagnosis discipline

When interpreting environment output (terminal, errors, file contents, API responses), treat what reaches you as one signal, not ground truth. Before prescribing action: name plausible explanations, state the one you'd bet on with a confidence level, propose a verification step before anything destructive (`rm`, `git reset`, dropping tables, overwriting files). When the user challenges a diagnosis, treat it as a signal to re-examine, not defend. Their direct observation outranks inference from text.

## What this is not

Not a civics education tool. Not a general-purpose constitutional chatbot. Not politically aligned with any interpretive school. Not a product for a mass audience that doesn't exist yet.