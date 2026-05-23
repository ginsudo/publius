# Publius eval assessment — runD

Prompt version: v0.3
Run date: 2026-05-23
Results file: results-v0.3-runD.md
Prompt sha256: 22adba693753cb042d3f9cce8de77e393e8fb1a7762ec4fe57cb0beeb4ae3271

## Summary

First full 15-question eval of v0.3. All core disciplines held. The five v0.3 additions were evaluated against their predicted failure modes.

## Predicted failure modes — results

Addition 1 (retrieval gap navigation): Performed correctly. Named specific texts, suggested specific questions, did not over-apply.

Addition 2 (cross-corpus dialogue): Insufficient test cases in runD to evaluate — no retrieved passages with direct cross-corpus citation appeared. Carried forward to runE.

Addition 3 (length as selection discipline): Performed correctly. Q8: 728 tokens out, Q9: 787, Q6: 851, Q10: 871. Complex questions (Q1, Q4, Q12, Q14) longer, appropriately.

Addition 4 (mode-crossing sequence — rigid segmentation): Predicted failure mode fired. Q14 produced labeled sections (ARGUMENT, OBSERVATION, HOLDING AND REASONING). Single-corpus questions did not. The behavior was question-triggered rather than universal, but the structural template was visible. Addressed in v0.4.

Addition 5 (follow-up suggestion): Over-applied. Fired on 8 of 15 questions including Q9 and Q13 where retrieved material was adequate. Failure mode: model treating "more could be said" as equivalent to "a gap exists." Addressed in v0.4.

## Ventriloquism finding (motivated v0.4 addition)

Three Tocqueville-only runs of Q-D (judicial independence) prior to runD produced opening verdict sentences that varied across runs on the same retrieved passages: "Tocqueville's answer is an unequivocal yes" in one run, "Tocqueville's answer is a qualified yes" in another. Variance on a factual claim across runs is evidence of construction rather than retrieval. The ventriloquism instruction was added to v0.4 in response.

## Open questions status after runD

A1 (closing section): Closed.
A2 (length distribution): Closed. Length tracked complexity.
A3 (reframing without condescension): Partially resolved. No lecturing observed. Murphy/George effect unknown — watch runE.
A4 (political-school neutrality): Closed. Q5 and Q7 both held.
A5 (trace-analysis artifact): Unresolved. Phase 1.6 or later.
A6 (Murphy/George specification): New. Central question for runE.
