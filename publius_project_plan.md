# PUBLIUS Constitutional Intelligence Platform — End-to-End Project Plan

*April 2026*

## Product Vision

Publius is the first serious digital tool for constitutional interpretation as an intellectual discipline — not a civics app, not a legal research tool, but something that sits at the intersection of political theory, legal history, and constitutional practice. The target audience is people who think seriously about constitutional interpretation: students and alumni of courses in the tradition of Murphy and George at Princeton, Dworkin's seminars on legal rights, constitutional law clerks, legal scholars, and serious practitioners.

**The product surfaces three corpora in genuine dialogue:**

- The founders arguing for the Constitution (Federalist Papers, 1787–88)
- A foreign observer describing what it became (Tocqueville, Democracy in America, 1835/1840)
- The Court working out what it means (curated Supreme Court opinions, founding era to present)

Each corpus is available in original and modern English. The Q&A layer respects the distinction between argument (Federalist), observation (Tocqueville), and holding/reasoning (Court) — and surfaces genuine interpretive disagreement rather than false synthesis.

## Technical Stack

**Framework: Next.js (App Router, TypeScript, Tailwind CSS)**

- Desktop: Electron wrapper — same codebase, no feature divergence
- Corpus storage: Static JSON in repo (all three corpora are small enough)
- Vector store: sqlite-vec locally; Turso or Pinecone for Vercel production
- LLM runtime: Claude API — Sonnet 4.6 for Q&A; Batch API for plain English generation
- Hosting: Vercel (web); Electron build pipeline (desktop)
- DNS/CDN: Cloudflare
- Observability: Helicone or Langfuse (wired from day one)

## Project Phases

## Phase 0 — Foundation

*Duration: 1–2 days  ·  Goal: Everything in place before product code begins.*

### 0.1  Environment Setup

- Node.js verified, Claude Code installed and authenticated
- Git initialized, GitHub repo created (private)
- Vercel account created, connected to repo
- Anthropic API key secured, added to Vercel environment variables
- .env.local configured for local development

### 0.2  Corpus Acquisition — Federalist Papers

- Pull full text from Project Gutenberg; verify against Library of Congress text
- Structure as JSON: paper number, title, author, date, paragraphs array, constitutional section (stub), topic tags (stub)
- Spot-check 5 papers manually against canonical source
- Flag disputed authorship papers explicitly in the data — Hamilton claimed them; scholarly consensus gives most to Madison

### 0.3  Corpus Acquisition — Democracy in America (French source)

- Pull French original from Gallica (BnF) or Project Gutenberg French corpus — both are clean public domain
- Organize by Volume (I/II), Part, Chapter — canonical structure
- Confirm both 1835 and 1840 volumes are complete
- Store raw French as source of record before any translation work begins

*Decision point before leaving Phase 0: Confirm translation workflow. Recommended: do Federalist Papers product end-to-end first, then run Tocqueville translation as a parallel workstream from Phase 3 onward.*

## Phase 1 — Federalist Papers — Core Product

*Duration: 1–2 weeks  ·  Goal: Working web app: browse, read, dual-mode. No Q&A yet.*

### 1.1  Data Layer

- Build corpus JSON structure via Claude Code
- Write chunking script — paragraph-level, with metadata: paper number, author, paragraph index, constitutional section, topic tags
- Generate embeddings via Anthropic API; store in SQLite with sqlite-vec
- Write retrieval test: given a query string, return top 5 chunks with metadata and verify results before building UI

*Do not skip the retrieval test. Everything else rests on this foundation.*

### 1.2  Browse UI

- Homepage: filterable list of all 85 papers
- Filters: author, constitutional section (Article I–VII), sort by number
- Each list item: number, title, author, date, one-line summary (generate via Batch API — 85 summaries, trivial cost)
- Click navigates to paper reader

### 1.3  Paper Reader

- Full text, paragraph by paragraph
- Toggle: Original / Plain English (plain English stubbed — placeholder state for now)
- Header: paper number, title, author, date, constitutional section tag
- Previous/Next navigation; deep link /paper/51 works directly

### 1.4  First Vercel Deploy — Milestone 1

Deploy what exists. Real URL, works on web and mobile. First thing you can show someone.

## Phase 2 — Plain English — Federalist Papers

*Duration: 3–5 days  ·  Goal: Dual-mode reading fully functional.*

### 2.1  Batch Generation

- Write batch API script
- System prompt: render in contemporary American English, preserve every argument and logical step, no editorializing, flag any passage where meaning is genuinely ambiguous in the original
- Run it — costs ~$5, takes an hour; store as parallel JSON alongside originals

### 2.2  Editorial Review

This is your work, not Claude Code's. Read through flagged passages. Set exact wording on anything that feels off. Papers most likely to require attention: Federalist 10, 51, 78, 79 — these do precise legal and philosophical work where rendering matters.

### 2.3  Wire Up the Toggle

- Plain English mode pulls from parallel corpus
- Toggle state persists in localStorage
- Clear visual indicator when in plain English mode
- Both modes deep-linkable

## Phase 3 — Q&A — Single Corpus

*Duration: 1 week  ·  Goal: Ask interface working against Federalist Papers corpus.*

### 3.1  API Route — /api/ask

- Server-side only — API key never touches client
- Accept question + optional filters (author, paper range, constitutional section)
- Retrieve top 8 chunks from vector store; call Claude API with retrieval context

### 3.2  System Prompt Design

This is the most important single piece of work in the project. Spend real time on it.

- Answer by attributing positions to specific authors
- Quote specific passages, cite paper number and paragraph
- Where Hamilton and Madison disagree, surface the disagreement explicitly
- Where the text is ambiguous or contested by scholars, note it
- Do not editorialize toward any interpretive school
- Do not synthesize a false consensus where genuine disagreement exists
- Response format: structured JSON — author positions, each with quotes and citations

*Construct the prompt so its modes of authority are a parameterized list the prompt operates over, not named things baked into prose. The discipline (no flattening across modes, surface disagreement, attribute precisely) is durable; the specific modes (argument / observation / holding / eventual fourth) are configuration. Phase 3 has only argument; Phases 5 and 6 add observation and holding to the same list.*

*Test the system prompt against 10–15 questions spanning easy and hard cases before considering it done.*

### 3.3  Ask UI

- Top-level nav item: Ask
- Text input, submit; response rendered as structured output: author positions, quoted passages, paper citations
- Each citation links to paper reader at the correct paragraph
- Loading state (calls take 3–8 seconds)

### 3.4  Second Vercel Deploy — Milestone 2

Full working product: browse, read dual-mode, ask. This is the second milestone.

## Phase 4 — Tocqueville Translation

*Duration: Ongoing — parallel with Phase 3+  ·  Goal: Complete Democracy in America in your English.*

This runs as a separate workstream from the product build. Structure:

- Claude renders chapters from the French, flagging uncertain passages
- You review; rewrite any passage to your standard
- Final text stored as your canonical version with editorial decisions documented
- Target: complete Volume I before adding Tocqueville to the product; Volume II follows

Volume I is more immediately relevant to constitutional interpretation — institutions, federalism, judicial power, the legal profession. Volume II is more diffuse (habits of mind, tyranny of the majority as a social phenomenon). Consider publishing Volume I first and treating Volume II as a subsequent release.

*Copyright note: Your translation from the French original, with genuine editorial choices documented, creates a defensible copyright claim. Consult a copyright attorney before publishing. Do not treat this plan as legal advice.*

## Phase 5 — Add Tocqueville Corpus

*Duration: 1 week after translation complete  ·  Goal: Full dual-corpus product.*

### 5.1  Corpus Integration

- Structure Tocqueville JSON: volume, part, chapter, paragraph, source tag
- Same chunking and embedding pipeline, parameterized by corpus
- Metadata tags: source, volume, chapter, topic
- Add to same vector store with corpus filter

### 5.2  Q&A Cross-Corpus

- Update retrieval to span both corpora, returning source-tagged results
- Update system prompt: distinguish argument (Hamilton, 1788) from observation (Tocqueville, 1831–35) — these are different epistemic modes
- Enable cross-corpus synthesis queries as the flagship use case for your audience

### 5.3  UI Updates

- Corpus selector or implicit detection from query
- Reader navigates both corpora
- Filter UI updated for Tocqueville structure (Volume/Part/Chapter vs. numbered papers)

## Phase 6 — Supreme Court Cases

*Duration: 2–3 weeks  ·  Goal: Third corpus — curated canonical opinions.*

### 6.1  Corpus Curation — Your Most Important Decision

You draw this list. Your formation makes you the right person to do it. Suggested frame: cases actually taught at the level of Murphy/George/Dworkin. Approximately 100–150 cases.

Structural categories:

- Foundational: Marbury, McCulloch, Cohens, Gibbons
- Commerce and federal power: Lochner through Lopez, Morrison, NFIB
- Individual rights: Carolene Products, Griswold, Loving, Brandenburg
- Equal protection: Plessy, Brown, Bakke through SFFA
- First Amendment: Schenck through 303 Creative
- Criminal procedure: Mapp, Miranda, Gideon
- Structural: Steel Seizure, Morrison v. Olson, Seila Law
- Recent and contested: Dobbs, Bruen, Trump v. United States

### 6.2  Corpus Acquisition

- CourtListener (Free Law Project) API — full opinion text, free, public domain
- Alternatively: Justia — full text to founding era, reasonably clean HTML
- Structure: case name, year, constitutional provision(s) at issue, majority author, concurrences, dissents, holding summary

**Constitution as first-class corpus.** Acquire the U.S. Constitution and its amendments and structure them as a `constitution:` corpus conforming to the cross-corpus base schema (`data/SCHEMA.md`). At the same time, migrate the universal `constitutional_section` field from a free-text string label to an ID reference into the `constitution:` corpus. SCOTUS items reference the constitutional provisions they interpret by ID; Federalist items already organized around constitutional structure get the same treatment. This makes the base-text-plus-corpora-in-conversation relationship latent in the data without requiring any product surface change. The schema migration is deferred until this Phase 6 work begins — recorded in `DECISIONS.md`, not pre-emptively applied to existing corpora.

### 6.3  Chunking Strategy — Different from Essays

Court opinions require semantic chunking, not paragraph chunking. Each opinion has: syllabus, factual background, legal question, majority reasoning (may have numbered sections), holding, concurrences, dissents. Each chunk carries: case, year, author, opinion type (majority/concurrence/dissent), constitutional provisions, interpretive method where determinable.

### 6.4  Interpretive Method Tagging

Tag opinions by interpretive method where unambiguous only. Scalia: originalist/textualist. Brennan: purposivist/living constitutionalist. Leave contested cases untagged rather than mislabel. This enables intentional retrieval diversity — surfacing ideologically opposed readings of the same provision on purpose.

### 6.5  System Prompt Update — Third Epistemic Mode

Add holding and reasoning alongside argument (Federalist) and observation (Tocqueville). The model must distinguish: what Hamilton argued the Constitution meant in 1788, what Tocqueville observed American constitutional culture doing in 1831, what the Court held in 1803 / 1954 / 1973 / 2022, what a dissent argued the Court got wrong. These are different kinds of authority.

## Long-Term Architecture — Extensible Corpus and User-Composed Dialogue

*Design Principles for All Phases Beyond Phase 6*

The three-corpus structure of Phases 1–6 is the foundation, not the ceiling. The long-term design of Publius is a platform in which the corpus is extensible and the user controls which voices participate in any given dialogue. A student writing on equal protection may compose a conversation that includes Hamilton, the Warren Court, and Derrick Bell. A student working on federalism may exclude Tocqueville entirely. The tool does not decide who sits at the table — it curates the chairs and lets the user choose.

This design principle has two important implications that must be carried forward into every subsequent phase. First, the corpus pipeline built in Phases 1–6 must be architected for extensibility from the start — parameterized by corpus, with consistent metadata schemas across sources, so that adding a new body of work does not require rebuilding the retrieval layer. Second, the epistemic taxonomy that governs the Q&A layer — argument (Federalist), observation (Tocqueville), holding and reasoning (Court) — is adequate for the first three corpora but will require extension as the corpus expands. Critical legal theorists, political philosophers, and dissenting traditions do not fit cleanly into these three modes. What the fourth category is called, and how the system prompt handles incommensurable frameworks rather than merely disagreeing positions within a shared framework, is an open design question to be resolved before any fourth corpus enters the product. Do not add a new corpus without first resolving how it will be epistemically tagged.

The user-composition model also changes the nature of the tool's influence. Rather than the developer deciding which voices speak to each other, the tool encodes curatorial judgment at the level of corpus quality and epistemic tagging, while leaving dialogue composition to the user. This is the structural implementation of the interpretive neutrality commitment — not just an aspiration but a design property.

Two distinctions worth being explicit about. **Extensible corpus** means more corpora can be added to *Publius* — additional bodies of work that join the same dialogue alongside the founders, Tocqueville, and the Court. It does not mean Publius is reconfigurable as a different product around a different base text. **User-composed dialogue** means the user of Publius selects which voices from the curated corpora participate in any given inquiry; it does not mean the user defines new corpora, new epistemic modes, or stages a Publius-shaped tool around a different intellectual tradition. A meta-product that takes any base text and stages a curated dialogue with corpora in conversation with it — Talmud with its commentary tradition, Shakespeare with sources and criticism, scientific papers with citation networks — is explicitly out of scope. The curatorial and prompt-design judgment that makes Publius rigorous comes from a specific intellectual formation, Murphy / George / Dworkin constitutional interpretation, and is not a generic capability to be exposed as configuration. See the corresponding entry in `DECISIONS.md` for the architectural seams kept open without committing to this generalization.

## Phase 7 — Polish and Launch

*Duration: 1 week  ·  Goal: Observability, performance, and first real users.*

- Wire Helicone or Langfuse — every query, latency, and cost visible from day one of real traffic
- Verify Q&A cold start latency under 8 seconds; confirm retrieval is fast at production corpus sizes
- Register domain via Cloudflare Registrar
- Write about page: what it is, what it's for, who the audience is — no hedging
- No social media push until the product is something you're proud of
- First users: people in your network who would have taken Murphy or George

## Decision Log

Things to decide before each phase. Your call on all of them.

| Decision | When | Options / Notes |
| --- | --- | --- |
| Tocqueville translation pace | Before Phase 2 | Parallel workstream recommended; do not let it block product phases |
| Volume I only vs. both at launch | Phase 4 | Volume I first is cleaner; Vol II as subsequent release |
| Case list curation | Phase 6 start | Your judgment — no one else can make it |
| Interpretive method tagging | Phase 6 | Only where unambiguous; leave contested cases untagged |
| Fourth epistemic category | Before any Phase 8+ corpus | The argument/observation/holding taxonomy breaks when CLS or political theory enters. What the fourth mode is called, and how the system prompt handles incommensurable frameworks, must be resolved before adding any new corpus. See Long-Term Architecture section. |
| Theoretical texts in corpus | Phase 6+ | Dworkin, George, Murphy, Bell as extensible corpora? Inform prompts first, add corpus later. User composes the dialogue — do not add a corpus without resolving its epistemic tag. |
| Monetization | Post-launch | Free, freemium, or institutional licensing — decide after you see who's using it |

## What You're Actually Building

By Phase 6 you have something that doesn't exist anywhere: a precision tool for constitutional interpretation as an intellectual discipline, with three corpora in genuine dialogue — the founders arguing for the Constitution, a foreign observer describing what it became, and the Court working out what it means — surfaced through a Q&A layer that respects the distinctions between argument, observation, and holding, and a reading experience that makes all three accessible in both original and modern English.

Beyond Phase 6, you have a platform: an extensible corpus architecture in which the user composes the dialogue, choosing which voices participate in any given inquiry. The long-term product is the first serious instrument for constitutional interpretation as a genuine intellectual discipline — one that can stage encounters between Hamilton and Derrick Bell, between Scalia's originalism and Brennan's purposivism, between the founders' argument and Tocqueville's observation — without flattening any voice into another or deciding in advance who should speak to whom.

The Murphy / Dworkin / George formation is not incidental to this product. It is constitutive of it. The curatorial and prompt design judgments made at every phase are informed by that training in ways that cannot be replicated by someone who doesn't have it.

---

*Confidential  ·  April 2026  ·  Updated with Long-Term Architecture section*
