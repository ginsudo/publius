# Trace-analysis artifact — sketch

This is a placeholder design for a separate prompt that operates on saved
Publius conversations and identifies what an inquiry has constituted out
of the corpus. It is not in scope for Phase 1.2. Capturing the design
here so it does not fall off the radar.

**Operation type:** Offline. Runs against saved conversations, not in
the per-turn loop.

**Trigger options:** User-initiated review ("what has this inquiry
constituted?"); periodic (monthly, semester-end); cumulative across
multiple inquiries on related themes.

**Input:** A conversation trace — the sequence of questions, retrievals,
and answers from one or more saved Publius sessions.

**Output:** A characterization of what the inquiry has constituted out
of the corpus. Names the structural argument(s) the user's path has
assembled. Distinguishes corpus-stated claims (Hamilton said X) from
user-constituted claims (the inquiry has surfaced X by selecting these
passages in this sequence). Marks where the inquiry encountered the
corpus's limits — questions the corpus did not have material for, places
where retrieval was weak, modes the inquiry could not reach.

**Discipline carried over from per-turn:** Same attribution rules, same
mode distinctions (argument/observation/holding), same out-of-corpus
marking. The trace-analysis prompt is not licensed to do anything the
per-turn prompt is not licensed to do; it is licensed to *aggregate*
across what the per-turn prompt produced.

**The new thing the trace-analysis prompt does:** Names the trace as
the locus of position-formation. "Your inquiry, across these N
questions, has constituted Y" is the move only this prompt makes — and
the move only it makes legitimately, because only it has the whole
trace.

**Where this lives in the project:** Not Phase 1.2. Probably its own
slot — Phase 1.6 or deferred to Phase 5 when Tocqueville joins and
traces become richer. Exact placement is a project-plan decision, not
a prompt-design decision.

**What this requires that does not exist yet:** Trace storage (saved
conversations as first-class objects), a UI for triggering review, the
analysis prompt itself, and probably a separate observability surface
for traces-as-objects-of-study (vs. traces-as-debug-data). All of this
is downstream of v0.2 and does not gate it.
