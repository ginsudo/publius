# Publius eval assessment — runE

Prompt version: v0.4
Run date: 2026-05-23
Results file: results-v0.4-runE.md
Prompt sha256: cac307dbc001228130a6b23fe9c0ffd2c28e464cee9f1fa1b80378cada1b2da5

## Summary

First full 15-question eval of v0.4. The Murphy/George audience specification (A6) did not produce mimicry — answers are more analytically direct than runD, not more hedged. All core disciplines held. The ventriloquism instruction produced the intended attribution-not-ventriloquism behavior. Follow-up suggestion over-application persists.

## Predicted failure modes — results

Audience specification (mimicry risk): Did not fire. Answers enter the argument directly. Q7 opens with a clean diagnosis of the question's false premise. Q14 opens "The honest answer is: neither framing quite fits." No academic throat-clearing observed.

Ventriloquism instruction (over-correction risk): Did not fire. Q9 no longer opens with a verdict sentence — "The binary the question offers is precisely what Tocqueville's method refuses" versus runD's "Tocqueville's answer is: neither." Q2 enters the argument without asserting a Tocqueville position.

Mode-crossing restructure (under-sequencing risk): Did not fire. Q14 handled modes separately and named the relationship without labeled section headers. Q2 handled the relationship in natural prose.

Follow-up suggestion recalibration (over-suppression risk): Did not fire in the direction predicted. Over-application persists instead: fired on 10 of 15 questions. The "complete means adequately address what was asked — not that more could be said" clause is not fully suppressing extension-suggesting behavior on Q6, Q10, Q12, Q13. Live issue for v0.5 consideration.

Synthesis prohibition as standalone paragraph: No new failure modes. No synthesizing closes observed.

## Notable results

Q14 is the strongest answer in the set — three-corpus, no labeled sections, relationship-naming between modes working as designed, clean close without synthesis.

Q9 (Tocqueville support/oppose binary): Clean refusal of the binary, 702 tokens, no follow-up suggestion. Correct on all dimensions.

Q1 (Hamilton/Marshall): Sharp engagement with the distinction between Hamilton's structural argument and Marshall's institutional assertion.

## Open questions status after runE

A1: Closed.
A2: Closed.
A3: Closed. No lecturing on mediocre questions in runE. Murphy/George specification did not produce condescension.
A4: Closed.
A5 (trace-analysis artifact): Unresolved. Phase 1.6 or later.
A6 (Murphy/George specification): Closed favorably. Calibration, not mimicry.
A7 (new): Follow-up suggestion over-application persists at 10/15. Consider v0.5 addition to further constrain the condition. Low priority — the suggestions are not wrong, just sometimes unnecessary.
