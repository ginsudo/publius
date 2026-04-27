# Claude Code: Operational Guide for Publius

Reference document for working with Claude Code as the implementation assistant on the Publius project. This is operational practice — what to do during sessions, how to structure work, where the sharp edges are. For conceptual orientation on what Claude Code is and how to think about the working relationship, see `claude_code_orientation.md`.

## Contents

1. Project setup and the `CLAUDE.md` file
2. Session structure and the working loop
3. Plan mode and permissions
4. Context management across sessions
5. Git discipline
6. Where Claude Code will cost you time
7. Specific mechanical habits
8. Operational checklist

---

## 1. Project Setup and the `CLAUDE.md` File

Claude Code automatically reads a file called `CLAUDE.md` from the project root at the start of each session. It functions as persistent project context — coding conventions, architectural decisions, things you don't want re-litigated every session.

For Publius, `CLAUDE.md` should encode the standing decisions from the project instructions:

- The three-corpus epistemic distinction (argument / observation / holding)
- The no-flattening rule for Q&A
- The technical stack as fixed (Next.js, Claude API Sonnet 4.6, sqlite-vec local / Turso or Pinecone production, Electron desktop, Vercel hosting, Helicone or Langfuse from day one)
- The corpus hierarchy (Federalist → Tocqueville Vol I → Tocqueville Vol II → Court cases)
- The Mac Studio is dev-only, not a production server
- Project-specific code conventions: where corpora live, where API routes live, naming patterns
- The rule that retrieval gets verified before UI gets built (Phase 1)

**Discipline:** when Claude Code suggests something that violates a `CLAUDE.md` rule, that's not a debate — it's a bug in the model's behavior. Correct it and consider whether `CLAUDE.md` needs to be tighter. When you make a new standing decision mid-project, it goes into `CLAUDE.md` immediately.

**Nested files:** you can have nested `CLAUDE.md` files in subdirectories — e.g., `/data/CLAUDE.md` documenting the corpus JSON schema, `/app/api/CLAUDE.md` documenting API conventions. Claude Code reads the relevant ones based on what it's working on.

**Companion file — `DECISIONS.md`:** keep this alongside `CLAUDE.md` to capture architecturally significant choices with reasoning. `CLAUDE.md` is "what to do." `DECISIONS.md` is "why we decided this and what we considered." The latter is for you, as project lead, to refer back to when a future session asks "should we use Pinecone or Turso?" and you've already done that analysis.

**Companion file — `IMPLEMENTATION_LOG.md`:** the historical record of what got built and why — the path that produced each architectural decision, each prompt revision, each experiment. `DECISIONS.md` is "what we decided." `IMPLEMENTATION_LOG.md` is "what we tried, what we found, what came of it." Updated at session close as part of standard discipline (see CLAUDE.md). When a future session asks "why does v0.2's closing section work the way it does?" the experimental story is there, not in `DECISIONS.md`.

---

## 2. Session Structure and the Working Loop

The loop to run, over and over, for the entire project:

1. **Decide the next slice.** Smallest thing that's end-to-end testable. Not "build the reader" — "render Federalist 10 as JSON to the page with paragraph breaks intact."
2. **Ask for the plan first.** "Before you write any code, walk me through what you'd do, what files you'd touch, what assumptions you're making, and what you'd want me to confirm." Read the plan. Push back on anything that smells off.
3. **Approve, then let it execute.** It will write code, possibly run it, possibly install packages. Watch what it's doing. If it starts doing something you didn't approve, stop it (Ctrl+C).
4. **Test the slice yourself.** Open the page, click the thing, run the script. Don't take its word that it works.
5. **Commit to git.** Every working slice. This is the undo button when something later breaks.
6. **End-of-session summary.** "Summarize what we built today, what's stubbed, what's the next logical slice." The summary lands as a path-narrative entry in `IMPLEMENTATION_LOG.md`, committed. Start the next session by opening that entry. (The `/notes/` directory holds historical session summaries from the project's earlier weeks and is no longer the active session-close artifact — see `CLAUDE.md` and `DECISIONS.md`.)

---

## 3. Plan Mode and Permissions

Claude Code has a plan mode — toggle so the model produces a plan and waits for approval before executing. For this project, leave it on by default for any session touching more than one file.

**Permissions:** by default, Claude Code asks before running shell commands, writing files outside its current working set, and a few other operations. You can grant blanket permissions per-session. Recommendation: don't, at least for the first few weeks. The friction of approving each action is also the friction that catches the moment when it's about to do something unintended. After working with it for a few weeks, you'll know which operations to grant freely.

---

## 4. Context Management Across Sessions

The context window is large but not infinite. Long sessions degrade in two ways: the model loses earlier decisions, and cost-per-turn grows. Symptoms:

- It forgets a convention you established 90 minutes ago
- It re-introduces a bug you fixed earlier
- It starts suggesting libraries you'd already ruled out

**The practice:** end sessions deliberately. When you finish a logical slice, ask for the end-of-session summary, save it, and start the next session fresh with that summary as the opening message. More disciplined than "let the session run all day" and produces materially better code.

**`/clear` between unrelated tasks within a session.** Wipes context without ending the session. Useful when you've finished one slice and want to start another without polluting the new slice with the old one's context.

---

## 5. Git Discipline

Claude Code can run git commands. You can — and should — let it commit on your behalf at logical checkpoints, with commit messages it drafts and you approve.

**Pattern:** at the end of each working slice, "commit this with a message describing what we just did and why." Read the commit message before approving. Bad commit messages are an early warning that the model doesn't actually understand what it just built.

**Branch hygiene:** for anything beyond Phase 1, work on feature branches. `git checkout -b phase-3-ask-api`. When the feature is working and reviewed, merge to main. When a session goes sideways, `git reset --hard` to the last commit costs nothing because everything was committed.

---

## 6. Where Claude Code Will Cost You Time

Honest list, in rough order of how much time they'll burn:

**Vercel and deployment configuration.** Claude Code is much better at writing application code than at debugging why a Next.js app builds locally but fails on Vercel. The error surface is environment-specific in ways the model often guesses about. When deployment breaks in non-obvious ways, the fastest path is usually Vercel's docs or a human, not more turns with Claude Code.

**Vector store and embedding pipeline at scale.** Small-corpus retrieval (Federalist alone) will work. When you're at three corpora with semantic chunking on opinions, retrieval quality issues become subtle — the model returns plausible-but-wrong chunks and Claude Code can't see they're wrong without your evaluation. This is a "you have to write evals" problem, not a "ask Claude Code to fix it" problem.

**Electron.** Build pipeline is fiddly, cross-platform packaging is fiddly, and Claude Code's training data on Electron is uneven. Budget more time here than seems reasonable. Consider deferring Electron until web is fully shipped.

**Anything involving the Anthropic API where the API has changed recently.** Claude Code's knowledge of the Anthropic API specifically is *not* better than chat-Claude's, despite intuitions to the contrary. When in doubt, point it at the current docs URL and have it read them rather than relying on what it remembers.

**The honest limit:** you will hit walls Claude Code can't get you past. When you do, the right move is not to grind on it for six hours — it's to find a human engineer for a one-hour consult. Budget for this. A few hundred dollars of someone's time at the right moment will save you a week.

---

## 7. Specific Mechanical Habits

- **Tell it where things go.** "Put the corpus in `/data/federalist/`, the API routes in `/app/api/`, components in `/components/`." Otherwise it picks, and its picks are inconsistent across sessions.
- **Make it explain unfamiliar code.** "Walk me through what this file does, line by line, like I'm a PM not an engineer." This is how you catch things that are wrong.
- **Don't let it install dependencies casually.** Every npm package is a decision. Ask: "Why this library? What's the alternative? What does it pull in?"
- **Point it at specific files rather than letting it search.** "Edit `/app/api/ask/route.ts` to add filtering by author" is faster and more accurate than "add author filtering to the ask endpoint."
- **Have it write tests.** Especially around retrieval and around the Q&A response shape. You'll change these systems repeatedly; tests are how you know you didn't break them.
- **Read its diffs before accepting them.** Claude Code shows you what it's about to change. The rate at which you catch real problems by reading diffs is high enough to justify the time.
- **Re-view files before editing in long sessions.** Claude Code doesn't automatically re-read a file before editing it again later in the same session — it works from its memory of what it wrote. Ask it to `view` the file first.

---

## 8. Operational Checklist

Quick scan before/during/after sessions.

**Before a session:**
- [ ] Last session's path-narrative entry in `IMPLEMENTATION_LOG.md` open
- [ ] Current branch is correct (`git branch`)
- [ ] Working directory is clean or known-state (`git status`)
- [ ] The next slice is defined in one sentence

**Starting a session:**
- [ ] Paste in last session's summary as opening context
- [ ] State the slice and ask for the plan first
- [ ] Confirm assumptions before approving the plan

**During a session:**
- [ ] Read diffs before approving
- [ ] Watch for `CLAUDE.md` violations
- [ ] `/clear` between unrelated tasks
- [ ] Note any new standing decisions for `DECISIONS.md`

**Ending a session:**
- [ ] Test the slice yourself
- [ ] Commit with a meaningful message
- [ ] Ask for the end-of-session summary as a path-narrative entry in IMPLEMENTATION_LOG.md
- [ ] Update `CLAUDE.md` or `DECISIONS.md` if anything new emerged