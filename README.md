# Publius

A precision tool for constitutional interpretation as an intellectual discipline.

Publius surfaces three corpora in genuine dialogue:

- **Argument** — the founders making the case for the Constitution, in the *Federalist Papers* (1787–88)
- **Observation** — a foreign visitor describing what it became, in Tocqueville's *Democracy in America* (1835/1840)
- **Holding and reasoning** — the Court working out what it means, in a curated set of Supreme Court opinions from the founding era to the present

Each corpus is available in the original and in modern English. The Q&A layer respects the distinction between argument, observation, and holding — and surfaces interpretive disagreement rather than synthesizing false consensus.

This is not a civics app, not a legal research tool, not a general-purpose constitutional chatbot. It is built for people who think seriously about constitutional interpretation, and it does not condescend toward an audience that doesn't exist.

## Why this exists

Inspired by Constitutional Interpretation at Princeton — the course Walter Murphy built and Robert George inherited. The course treats the Constitution not as a settled document with a settled meaning, but as a text whose interpretation is itself an intellectual discipline — one with competing schools, real stakes, and a centuries-long tradition of argument. Federalist 78 and *Marbury* and *Lochner* and *Brown* and *Dobbs* were not separate topics. They were moves in the same long conversation.

Most digital tools for engaging with the Constitution flatten that conversation. They give you summaries when you want arguments. They give you consensus when the whole point is the disagreement. They treat the Court as the final word when the Court is one voice in a longer dialogue that includes the framers, the critics, the dissenters, and observers like Tocqueville.

Publius is an attempt to build the tool I wanted to have while taking that course — and the tool I'd want now to keep thinking the way the course taught me to.

## The lineage that informs this project

The Princeton course traces back through one of the longest unbroken intellectual traditions in American constitutional study. The McCormick Professorship of Jurisprudence — the chair under which the course has been taught — was first held by Woodrow Wilson, and passed to Edward S. Corwin, then to Alpheus T. Mason, then to Walter F. Murphy, then to Robert P. George, who has held it since 1995.

Murphy taught Constitutional Interpretation at Princeton for many years before his retirement in 1995. His scholarship — including *Elements of Judicial Strategy*, a foundational work on how Supreme Court Justices actually decide cases — is considered paradigm-shifting in the study of judicial behavior. His students included Justice Samuel Alito, for whom he served as senior thesis advisor; Christopher Eisgruber, now Princeton's president and a former clerk to Justice John Paul Stevens; and generations of constitutional scholars now teaching at universities across the country.

George began as Murphy's preceptor in the course before taking over as lecturer. He served as a Judicial Fellow at the Supreme Court of the United States in 1989–90, receiving the Justice Tom C. Clark Award. He has since become one of the most influential public intellectuals working in constitutional theory and natural law jurisprudence — described by Elena Kagan as "one of the nation's most respected legal theorists."

The course is built around three questions, which Publius takes seriously as its own organizing frame: *What* is the Constitution that is to be interpreted? *Who* has the authority to interpret it? *How* should it be interpreted?

This project does not claim institutional affiliation with the course or its instructors. It is built independently, by a former student, in the spirit the course taught — that constitutional interpretation rewards precision, takes disagreement seriously, and does not flatter the interpreter.

## Status

In active development. See `CLAUDE.md` for project conventions and current architecture. See `DECISIONS.md` for architectural decisions and reasoning. The full project plan lives in the project files.

## What this is not

Not a civics education tool. Not a legal research database. Not politically aligned with any interpretive school. Not a product for a mass audience.

## Operations

Observability is wired through Langfuse Cloud (https://us.cloud.langfuse.com). Each `/api/ask` call emits a `publius-ask` trace with `retrieval` (top-K hits, hash, latency) and `generation` (model, tokens, stop reason) child spans; the harness emits the same shape under `source: "harness"` when run with `LANGFUSE_TRACING=1`. Filter by `source` in the project's traces view to separate route traffic from harness runs.

`LANGFUSE_PUBLIC_KEY` / `LANGFUSE_SECRET_KEY` / `LANGFUSE_BASE_URL` configure the connection; the dev server picks them up from `.env.local`, Vercel reads them from project env vars (per the Phase 1.4 deploy checklist in `DECISIONS.md`). If traces stop appearing without `[observability]` errors in server logs, suspect credential rotation first — see "Phase 1.3 OTel error hooks: known limitation on bad credentials" in `DECISIONS.md`.