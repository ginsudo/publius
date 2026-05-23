# Cross-corpus eval — v0.2 prompt against Q-A through Q-D

**Date:** 2026-05-23
**Prompt:** config/system-prompt.md at v0.2 (commit e91f59d or nearest prior)
**Model:** claude-sonnet-4-6
**Evaluator:** owner
**Purpose:** Behavioral evaluation of v0.2 against four cross-corpus questions designed to stress-test epistemic mode discipline and retrieval behavior. Findings motivated the v0.3 prompt additions.

Note: this eval was not run via the prompts/eval/run.ts harness and has no machine-generated results file. The outputs were observed live in the Publius UI. This file is a backfilled record of the findings, not a re-runnable artifact.

---

## Q-A — Names Federalist, implicates Tocqueville

**Question:** What did the Federalist authors assume about the character of the American public — their capacity for self-government, their susceptibility to faction, their relationship to representative institutions — and were those assumptions warranted?

**Finding:** Epistemic mode discipline held. The response correctly marked "were these assumptions warranted?" as crossing from ARGUMENT into OBSERVATION mode and stopped rather than answering from training data. Tocqueville Vol. I, Pt. 1, Ch. 8 was retrieved and cited. Failure mode: the Federalist-only analysis section was longer than the question's center of gravity warranted — length tracked retrieved volume rather than question complexity. Motivated Addition 3 (length as selection discipline).

**Pass/fail:** Pass on epistemic discipline. Partial fail on length calibration.

---

## Q-B — Names Tocqueville, implicates Federalist

**Question:** Tocqueville observed that the legal profession in America served as a de facto aristocracy, moderating democratic excess. What institutional design choices made that role possible?

**Finding:** Retrieval correctly concentrated in Tocqueville Vol. I, Pt. 2, Ch. 8 and did not drift toward Federalist material despite the question asking about institutional design choices. All 10 sources from the same chapter. The response stayed in the observational corpus and answered the question as asked rather than synthesizing with Federalist constitutional architecture. A clean pass.

**Pass/fail:** Pass.

---

## Q-C — Names both corpora

**Question:** Both the Federalist Papers and Tocqueville's Democracy in America treat the danger of majority tyranny as central. Do they agree on what makes a democratic majority dangerous, or are they diagnosing different pathologies?

**Finding:** Retrieval concentrated in Tocqueville (9 of 10 sources) despite the question naming both corpora. The Federalist was surfaced indirectly through Tocqueville's own citations — ¶99 cites Federalist 51, ¶101 quotes Hamilton. The response handled the argument/observation distinction correctly and reached a genuine analytical finding (they agree on institutional danger; they disagree on social danger). Failure mode: cross-corpus citations were treated as incidental rather than as evidence of intellectual dialogue — Tocqueville engaging Hamilton's argument was not named as such. Motivated Addition 2 (cross-corpus citation instruction). The follow-up suggestion did not appear (correct behavior — retrieval was adequate). Motivated Addition 5's boundary condition: Q-C should not trigger the follow-up suggestion.

**Pass/fail:** Pass on epistemic discipline. Partial fail on cross-corpus dialogue surfacing.

---

## Q-D — Names neither corpus

**Question:** Is an independent judiciary compatible with democratic self-government?

**Finding:** All 10 retrieved passages were Tocqueville. Federalist 78 — the canonical text on this question — was named in the response but not retrieved. The response correctly disclosed the gap but did not tell the reader what to ask to close it. Confirms the vocabulary gap problem: the question's philosophical framing ("compatible with democratic self-government") does not share surface vocabulary with Hamilton's constitutional-argumentative framing ("least dangerous branch," "will vs. judgment"). Motivated Addition 1 (retrieval gap disclosure with navigation) and Addition 5's trigger condition: Q-D should produce a follow-up suggestion pointing toward the Federalist 78 gap.

**Pass/fail:** Pass on epistemic discipline. Fail on navigational gap disclosure.

---

## Summary of findings → additions

| Addition | Motivated by |
|----------|-------------|
| 1 — Retrieval gap navigation | Q-D |
| 2 — Cross-corpus citation | Q-C |
| 3 — Length as selection | Q-A |
| 4 — Mode-crossing positive case | Cross-corpus comparison generally |
| 5 — Follow-up suggestion tied to gaps | Q-D (trigger) and Q-C (non-trigger boundary) |
