# Claude Code: Orientation for Publius

Conceptual reference for what Claude Code is, what it isn't, and how to think about the working relationship. Companion to `claude_code_operational_guide.md`, which covers day-to-day practice.

## Contents

1. What Claude Code actually is
2. The mental model
3. The division of labor on Publius
4. Phasing notes
5. The honest limit

---

## 1. What Claude Code Actually Is

Claude Code runs in your terminal. You `cd` into a project directory, type `claude`, and you're in an interactive session with a model that has a defined set of tools: read files, write files, edit files, run bash commands, search the codebase, and on newer versions, run subagents for parallel work. Everything happens inside that directory — it can't reach files outside the working directory without explicit grant.

The session is stateful within itself but not across sessions. When you close the terminal, the conversational context is gone. The *code* persists because it's on disk; the *understanding of why the code is the way it is* doesn't, unless you've written it down. This is the single most important operational fact about Claude Code, and it shapes everything else (see `claude_code_operational_guide.md` §4 for how to manage this).

---

## 2. The Mental Model

Claude Code is **Claude with hands.** It can read files, write files, run commands, install packages, run tests, hit APIs, and check its own work. It cannot: see your screen, see a browser, know what looks good, or know what you actually want unless you tell it precisely.

The failure mode is treating it like a magic box: "build me Publius." It will do something, and that something will look impressive for about ten minutes, and then you'll discover it's built on assumptions you didn't make and choices you wouldn't have made, and unwinding it is harder than starting over.

The correct model: **Claude Code is your implementation pair, working in 30-minute increments off specs you provide.** Your job is the spec, the acceptance criteria, and the review. Its job is the implementation. You are the tech lead, the PM, and the scholar; Claude Code is the development assistant.

---

## 3. The Division of Labor on Publius

Some parts of Publius are deeply Claude-Code-suited. Others are not. The distinction matters because misallocating work — letting Claude Code drift into the parts that require your judgment — is how the project loses its identity.

**Claude Code does well:**
- Corpus acquisition scripts (Phase 0.2, 0.3)
- Chunking and embedding pipelines (Phase 1.1)
- API routes and retrieval logic (Phase 3.1)
- Browse and reader UI (Phase 1.2, 1.3)
- Batch API integration (Phase 2.1)
- Test harnesses for the system prompt (Phase 3)
- Deployment configuration (Phase 1.4, 3.4)

**Claude Code cannot replace your judgment on:**
- The system prompt itself (Phase 3.2). Highest-leverage artifact in the project. Draft it yourself; have Claude Code run test questions against it.
- Editorial review of plain English renderings (Phase 2.2). Federalist 10, 51, 78, 79 do precise legal and philosophical work where rendering matters.
- Tocqueville translation review (Phase 4). Claude renders from the French; you set the canonical English. The defensibility of the translation as your intellectual work depends on this.
- Case curation (Phase 6.1). Your call alone. Your formation makes you the right person to do it.
- Interpretive method tagging (Phase 6.4). Tag only where unambiguous; leave contested cases untagged.

The pattern: Claude Code handles the layer where there's a right answer. You handle the layer where there's judgment.

---

## 4. Phasing Notes

The project plan's phasing is sound. Notes on how each phase translates into Claude Code work:

**Phase 0** is mostly not Claude Code — account setup, API keys, GitHub, Vercel done manually. Corpus acquisition scripts are Claude Code work, structured around explicit JSON schemas you define.

**Phase 1** is where Claude Code earns its keep. The plan's instruction — *"Do not skip the retrieval test"* — is the discipline point. The temptation, especially as a non-coder, is to skip ahead to UI because UI feels like progress. Resist this. Build the chunking and embedding pipeline, then a CLI script where you type a query and see top-5 chunks with metadata. No UI until retrieval quality is verified on a test set.

**Phase 2** has a Claude Code piece (Batch API script) and a piece Claude Code cannot do (editorial review). Don't let the line blur. Claude Code generates the renderings; you read them; where you don't like a rendering, you write the replacement or dictate the changes, and Claude Code only updates the JSON.

**Phase 3** — the system prompt is yours. Claude Code can draft, can run test questions, can build the test harness. The prompt itself is the work. This is the point at which deference to the model produces a generic Q&A product instead of Publius.

**Phases 4–6** follow the same pattern. Translation: Claude drafts, you review. Case curation: yours alone. Court opinion ingestion and chunking: Claude Code's work, structured around your decisions on opinion structure and metadata.

---

## 5. The Honest Limit

Two limits worth stating plainly:

**You will hit walls Claude Code can't get past.** Likely candidates: Vercel deployment misconfigurations, Electron build pipeline weirdness, Cloudflare DNS, edge cases in vector store behavior at scale. When you hit one, the right move is not to grind on it with Claude Code — it's to find a human engineer for a one-hour consult. A few hundred dollars of someone's time at the right moment saves a week.

**Claude Code is bad at taste.** It will write working code that's ugly, inconsistent, or architecturally wrong-but-functional. For a product whose audience is the Murphy / George / Dworkin set, the polish layer matters. Plan for a pass — possibly with a human collaborator — before launch where you specifically clean up the things Claude Code couldn't see.

The realistic expectation: Claude Code gets you to a working Phase 3 deploy faster than seems reasonable. After that, the project becomes what it actually is — an editorial and curatorial undertaking with a software layer.