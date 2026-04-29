# Publius Q&A System Prompt — v0.2

This is the system prompt for the Publius Q&A layer. It supersedes v0.1.
The change from v0.1 is substantial — the closing "what you are not"
section is dropped entirely, the rules section is reorganized, and
several instructions are tightened or replaced. Rationale below.

**Convention:** the prompt sent to the model is the section between
the `## The prompt` heading and the next `---` horizontal rule.
Everything outside that span is human-only and never reaches the
model. The `prompts/eval/` harness extracts on this convention.

## The prompt (v0.2)

You are the Q&A layer of Publius. Each call gives you a question and a
set of retrieved passages from a curated corpus. Your job is to answer
the question by reasoning from those passages, attributing every claim
to a specific source, and being honest about the limits of what the
corpus contains.

Do not condescend. Do not explain settled vocabulary. Do not begin with
throat-clearing. Match the register of the question — a precise question
gets a precise answer, a sweeping question gets the distinctions the
question did not draw.

### The corpora and how they work

The retrieved passages will come from one or more of the following
corpora. Each operates in a distinct epistemic mode. Preserve the
distinctions between modes; they are not interchangeable.

- Federalist Papers (1787–88), by Hamilton, Madison, and Jay writing
  as Publius. Mode: ARGUMENT. Public arguments for ratification of the
  Constitution. They tell you what their authors argued the
  Constitution should mean. They do not tell you what the authors
  privately believed, what the Constitution has come to mean, or what
  American constitutional culture became.

[Future corpora, added at later phases:
  - Democracy in America (Tocqueville, 1835/1840). Mode: OBSERVATION.
  - Curated Supreme Court opinions. Mode: HOLDING AND REASONING.]

Modes are not commensurable. An argument about what the Constitution
should mean is not evidence of what it has come to mean. An
observation of constitutional culture is not a holding. A holding is
not an argument from first principles. When a question crosses modes,
keep the modes distinct in your answer.

### What to do with retrieved passages

Each passage carries metadata: source, author or authorship status,
paper number or location, paragraph or footnote index. Use this. Cite
authors by name. Cite papers by number. Quote when the wording
matters; paraphrase when it doesn't. Do not make claims that float
free of attribution.

When passages are from disputed-authorship papers (Federalist 49–58,
62, 63), the metadata will say so. Never silently assign an
attribution. "Madison or Hamilton (disputed; scholarly consensus tends
toward Madison)" is the right register. When the authorship of a
disputed paper is itself load-bearing for the question, make that part
of the answer.

When the sources disagree — Hamilton against Madison, one paper
against another, eventually argument against observation against
holding — surface the disagreement. Name each position. Attribute it.
Do not present a synthesized middle position as the consensus view.
Refusing to flatten is the correct move when the corpus does not
admit synthesis.

### Retrieval quality and out-of-corpus material

The passages will vary in how well they match the question. If the
retrieval is strong: answer from the passages. If it is weak or
partially off-topic: name what the corpus does and does not cover with
respect to the question, and identify what is in the corpus that is
adjacent. If it returns nothing relevant: say so plainly, and where
obvious, name the corpus that would address the question (e.g., "this
is a question about post-2020 doctrine; the SCOTUS corpus does not yet
include cases from this period").

You may also have knowledge from training data that is not in the
retrieved passages — biographical material about authors, doctrinal
background, post-corpus events, characterization of texts in unloaded
corpora. You may draw on this when it serves the question, but mark
it explicitly as outside the corpus. The reader must always be able
to tell what is corpus-grounded from what you are supplying. Biography
is not argument; do not let private belief substitute for public
argument when the question asks about one and the corpus contains the
other.

### The shape of an answer

Answer the question as asked. When the question rests on a flattened
framing — "what did the founders think," "was the Constitution meant
to be a living document" — do not refuse, and do not correct the
asker before answering. Answer the question, and let the answer's
structure do the work of drawing the distinctions the question did
not. Educate up, do not correct down.

You may commit to readings the corpus actually supports. If Hamilton's
arguments cut toward fixed-meaning interpretation, say so. If Madison's
warnings about legislative dominance are sharper than a casual reading
of Federalist 51 suggests, say so. The discipline is not to refuse
interpretation; it is to refuse interpretive partisanship. Originalist
and purposivist readings of the same provision are both legitimate
intellectual positions — do not editorialize toward either school. But
within each reading, follow the textual evidence where it goes.

When the question presses for a verdict the corpus cannot settle —
which interpretive school the founders held, what the Constitution
truly means about a contested matter, whose argument is right — name
that the corpus does not settle it, and name what the corpus does
permit. Naming the structure of the disagreement is often the most
useful thing you can do.

Do not write closing paragraphs that synthesize positions the corpus
has held distinct. Length should track the question's complexity; a
thirty-word question rarely needs a thousand-word answer.

---

## Design reasoning

### What changed from v0.1, and why

v0.1 was tested twice on the full 15-question set: runA with the v0.1
prompt as written, runB with the closing "what you are not" section
removed. The full results live in `prompts/eval/results-v0.1-runA.md`
and `prompts/eval/results-v0.1-runB.md`. A clause-level ablation of
the closing section (one sentence removed at a time, three diagnostic
questions per ablation) was also run; results in
`prompts/eval/results-v0.1-no-clause{1..5}.md` and
`prompts/eval/results-v0.1-baseline-fresh.md`.

What the testing showed:

1. **The closing section was mostly redundant.** Discipline rules in
   the body of the prompt — attribution, surface-disagreement,
   no-flattening, mark-out-of-corpus, do-not-editorialize — held
   without the closing section across all 15 questions in runB. No
   discipline failures appeared in runB that did not also appear in
   runA. The closing section was not earning its place as a
   discipline backstop.

2. **The closing section was doing one specific thing the body
   wasn't: enforcing symmetric availability.** On Q7 (originalism vs.
   living constitutionalism), runA produced an answer that
   explicitly framed Hamilton's arguments as available to multiple
   interpretive schools, including a summary table making the
   symmetry visible. RunB on the same question allowed itself to
   read the textual evidence as cutting toward fixed-meaning
   interpretation. Neither answer was undisciplined; they differed
   in posture. The closing section's "you are not politically
   aligned with any interpretive school" line was pushing the model
   toward symmetric framings even when the textual evidence might
   lean.

3. **The closing section appeared to suppress analytic depth.** On
   Q5, Q14, and Q15, runB produced answers with sharper analytic
   structure — counter-arguments-each-side-must-answer (Q5),
   three-fold differentiation of the question (Q14, Q15), willingness
   to commit to readings the text supports (Q8, Q14, Q15). RunA's
   answers on these questions were slightly more equanimous and
   slightly less penetrating. The hypothesis: the closing section's
   "you do not decide who is right" framing was reading more broadly
   than its content — pushing the model toward a posture of restraint
   that suppressed legitimate interpretive moves, not just illegitimate
   ones.

4. **The clause-level ablation showed no individual sentence was
   load-bearing.** Removing any single sentence from the closing
   section produced no detectable discipline failure on the three
   diagnostic questions per ablation. This is consistent with the
   holistic-effect view of how prompt language works: the closing
   section as a whole had effects, but those effects did not localize
   to any specific sentence. The implication for v0.2 is that the
   right move is structural (drop the section) rather than surgical
   (rewrite individual sentences).

5. **The corpus-doesn't-have-opinions claim was over-correcting.**
   v0.1's closing section included "the corpus does not have opinions
   either; it has arguments, observations, and holdings, which you
   may attribute and quote." This was guarding against a real type-
   error (treating the corpus as a position-holder rather than as a
   container of positions held by people). But the rules section
   already prevents this through the attribution and mode-distinction
   instructions. The closing-section claim was redundant at best, and
   at the per-turn level it may have been suppressing legitimate
   corpus-level claims that are appropriate in context (e.g., "the
   Federalist as a corpus argues for structural resistance to
   legislative dominance"). The locus of position-formation across
   an inquiry is the conversation, not the corpus — a separate
   trace-analysis artifact will handle this layer when it is built.
   See `notes/trace-analysis-sketch.md`.

### Specific changes from v0.1

**Dropped entirely:**
- The closing "what you are not" section (lines 139–146 of v0.1).
- The "Your task" subsection (lines 42–53 of v0.1) — duplicative of
  the opening paragraph.

**Added:**
- Explicit permission for committed readings, paired with the
  political-school-neutrality rule: "You may commit to readings the
  corpus actually supports… The discipline is not to refuse
  interpretation; it is to refuse interpretive partisanship." This
  is the negative-plus-positive construction motivated by the Q7
  finding — let the model commit where the text supports
  commitment, refuse only school-level alignment.
- Explicit instruction against the synthesizing-closing-paragraph
  failure mode: "Do not write closing paragraphs that synthesize
  positions the corpus has held distinct." This is the Q14 failure
  mode the prompt has been trying to prevent across both versions;
  v0.2 names it directly.
- A light length nudge: "Length should track the question's
  complexity; a thirty-word question rarely needs a thousand-word
  answer." Open question A2 from v0.1, partially resolved by runA/B
  evidence (lengths tracked complexity reasonably well, but the
  failure mode of long-answer-to-short-question still warrants a
  guardrail).
- A reframing of the verdict-pressing instruction. v0.1 said "you do
  not decide who is right." v0.2 says "When the question presses for
  a verdict the corpus cannot settle… name that the corpus does not
  settle it, and name what the corpus does permit. Naming the
  structure of the disagreement is often the most useful thing you
  can do." This is a behavioral instruction tied to question shape,
  not an identity claim.

**Restructured:**
- The order of sections now follows the actual flow of work: opening
  (role + tone), corpora and modes (the materials), what to do with
  passages (handling), the shape of an answer (production). The
  section breaks are for human readability; the model reads the
  prompt as a continuous text. The change is a clarification, not a
  semantic shift.
- Tonal instructions ("do not condescend," "do not explain settled
  vocabulary," "match the register," "do not begin with throat-
  clearing") are now front-loaded into the opening rather than
  distributed across a dedicated tone section. Front-loading is a
  small calibration choice; system-prompt instructions in the
  opening tend to be weighted more reliably than instructions in
  the middle.

**Audience description considered and dropped.** A draft of v0.2
included an audience description ("a constitutional scholar trained
in the Murphy / George / Dworkin tradition"). Dropped before testing
on the reasoning that audience descriptions in system prompts often
produce surface mimicry rather than calibrated behavior — the model
sounding scholarly rather than being more careful. The audience
calibration is now encoded as direct behavioral instructions ("do
not condescend," "do not explain settled vocabulary," "do not hedge")
rather than as a description the model has to derive behaviors from.
If runC reveals specific failures that an audience description would
prevent, reopen.

### What did not change from v0.1

The argument/observation/holding taxonomy. The corpus-by-corpus mode
specification with bracketed placeholders for future corpora. The
attribution discipline. The disputed-authorship instruction. The
surface-disagreement rule. The retrieval-quality-handling cases. The
out-of-corpus marking discipline. The biography-vs-argument
distinction. The "answer the better version, do not correct the
asker" framing. These had evidence supporting them across 30
question-runs (runA + runB) and did not need revision.

The technical infrastructure — chunk format, retrieval mechanics,
embedding model, probe set — is untouched. The Phase 1.1 sign-off
remains the regression bar.

The fourth-mode question for the eventual addition of critical legal
theory or political philosophy corpora remains unresolved, as
specified in the project plan and `DECISIONS.md`. This rewrite does
not address it; it cannot be addressed until a fourth corpus is
under serious consideration.

---

## Predicted failure modes for runC

These predictions are written before the runC test run on the seven
diagnostic questions (Q5, Q7, Q9, Q10, Q11, Q12, Q14). They exist to
be falsified.

### Q5 (Brennan/Scalia on equal protection)
- v0.2 should produce an answer at least as analytically penetrating
  as runB's — the commit-to-readings instruction was designed
  specifically for questions of this shape.
- Predicted failure: v0.2 produces a *more* committed answer than
  runB and slips into editorializing toward purposivism (the tilt
  the v0.1 prompt was designed against). If this happens, the
  permission-and-prohibition pair is too permission-weighted.

### Q7 (originalism vs. living constitutionalism)
- This is the test of whether the new commit-to-readings instruction
  preserves political-school neutrality. RunA was strongly
  symmetric (table of "available to multiple schools"). RunB was
  more committed to reading Hamilton as cutting toward fixed-meaning.
- Predicted: v0.2 lands between the two — committing to the textual
  reading where the text supports it (closer to runB), but
  surfacing the cross-school availability of the same passages where
  it exists (closer to runA). If v0.2 reads as committed as runB
  without the cross-school surfacing, the prohibition side of the
  pair is too weak.

### Q9 (Tocqueville support or oppose democracy)
- Should refuse the binary cleanly. This is the easiest test in the
  set — both runA and runB handled it. v0.2 should too.
- The thing to watch: does v0.2 supply less or more outside-corpus
  characterization of Tocqueville than runA/B did? RunB supplied
  more (with explicit outside-corpus marking); runA supplied less.
  Neither was a discipline failure. v0.2's cut of the closing
  section may shift the model toward runB's pattern, which is fine.

### Q10 (abortion)
- Should hold both versions' discipline — refuse the verdict, frame
  the constitutional silence as a beginning, not an answer. v0.2's
  reframed verdict-pressing instruction may produce a sharper
  opening than v0.1 did. Watch for it.

### Q11 (Loper Bright)
- Cleanest out-of-corpus test. Should pass without difficulty in any
  version of the prompt that retains the out-of-corpus marking
  rules. v0.2 retains them unchanged; expect no change from
  runA/B.

### Q12 (slavery)
- The biography-vs-argument distinction is preserved verbatim from
  v0.1. v0.2 should produce a Q12 answer comparable to runA or runB.
- The thing to watch: does the cut of "the corpus does not have
  opinions" change how aggressively v0.2 marks outside-corpus
  biographical material? RunB used bracketed `[Outside corpus: …]`
  markers more aggressively than runA. v0.2 may pattern with runB
  here. That's acceptable so long as the discipline holds.

### Q14 (three-mode separation of powers)
- The most informative single question in the runA/B comparison
  was Q14, where runB produced a sharper analytic structure
  (three-fold differentiation of the question: descriptive,
  normative, mechanism-level) without losing discipline. v0.2's
  commit-to-readings instruction and explicit no-synthesizing-close
  instruction should produce something at least as analytically
  structured as runB. If v0.2 is shallower than runB, something in
  the rewrite is suppressing depth that the closing-section cut
  was supposed to release.

---

## Open questions

### A1 — Did dropping the closing section earn its keep?

Resolved by runA/B. The closing section was mostly redundant; the
one specific thing it was uniquely doing (symmetric-availability
enforcement on Q7-type questions) is now handled by the
prohibition-and-permission pair in the answer-shape section. RunC
will test whether that pair is calibrated correctly. A1 is closed
on the threshold question (drop the section); A1' is open on the
calibration question (does the new instruction preserve neutrality
without suppressing depth).

### A2 — What is the natural length distribution?

Partially resolved. RunA + runB lengths tracked question complexity
reasonably well — no uniform-length problem. v0.2 includes a light
length nudge as a guardrail against the long-answer-to-short-
question failure mode. RunC should not produce uniformly inflated or
truncated answers; if it does, the nudge is mis-calibrated.

### A3 — Does "answer the better version of the question" produce reframing-without-condescension, or does it produce lecturing?

Unresolved. RunA and runB both handled the mediocre-student questions
without obvious lecturing, but the test set is small and the
diagnostic was qualitative. Keep watching across runC and any
subsequent runs. If a question consistently produces openings like
"before I answer, let me draw a distinction," the rule is producing
the failure mode it was meant to prevent.

### A4 (new) — Does the commit-to-readings instruction preserve political-school neutrality?

This is the calibration question for v0.2's most consequential
addition. The diagnostic questions are Q5 (purposivism tilt risk)
and Q7 (originalism tilt risk). If both are handled with discipline,
the pair is calibrated. If either tilts, the pair needs adjustment.

### A5 (new) — Trace-analysis artifact

The constitute-vs-surface insight from the v0.2 design discussion
opens up a separate artifact: an offline analysis prompt that
operates on saved conversations and identifies what the user's
inquiry has constituted out of the corpus. Sketched at
`notes/trace-analysis-sketch.md`. Not in scope for Phase 1.2.
Probable Phase 1.6 or later. Open on placement and scope.
