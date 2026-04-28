# Federalist corpus corrections

This file documents every correction made to the Federalist Papers corpus
text in `data/federalist/federalist.json` after initial ingestion. Each
entry corresponds to a `corrections[]` entry on the relevant paper item;
this file is the human-readable index, that field is the structured
machine-readable record.

When a correction is made:

1. Update the relevant paragraph in `paragraphs[]` of the paper item.
2. Append a structured entry to `corrections[]` on that paper item.
3. Add a section below with the same information in prose form.

A correction is warranted when the corpus text departs from a recognized
scholarly edition (Founders Online, Cooke 1961, etc.) in a way that
changes meaning, introduces a transcription artifact, or creates a
spurious flag during downstream processing. Updates that are merely
stylistic (punctuation normalization, quote-mark variants) do not count
and should not be made — the corpus follows the source transmission.

---

## Federalist 57, paragraph 16 — duplicated phrase

**Date corrected:** 2026-04-28
**Source consulted:** Founders Online — The Papers of James Madison
([founders.archives.gov](https://founders.archives.gov/))

### Before

> Reason, on the contrary, assures us, that as in so great a number a fit
> representative would be most likely to be found, so the choice would be
> less likely to be diverted from him by **the intrigues of the ambitious
> or the ambitious or the bribes of the rich**.

### After

> Reason, on the contrary, assures us, that as in so great a number a fit
> representative would be most likely to be found, so the choice would be
> less likely to be diverted from him by **the intrigues of the ambitious,
> or the bribes of the rich**.

### Rationale

Project Gutenberg's Federalist transmission and Yale Avalon's
transcription both contain the duplicated phrase "the intrigues of the
ambitious or the ambitious or" — almost certainly a transcription error
introduced at some point downstream of the printed source. The scholarly
Founders Online edition, prepared from the Papers of James Madison, gives
the passage without the duplication: a clean parallel between "the
intrigues of the ambitious" and "the bribes of the rich."

The error was discovered during Phase 3.1 plain-English generation when
the model surfaced the duplication as an `[AMBIGUOUS: ...]` flag,
silently eliding the duplicated phrase in its rendering and noting in the
flag that the source text appeared garbled. We treat Founders Online as
authoritative for cases where Project Gutenberg / Avalon disagree with
the scholarly edition, and the corpus is corrected to match.

After this correction, paragraph 16 was re-rendered via the
`--retry federalist-57-para-16` path in
`scripts/generate-plain-english.ts` so the sidecar entry reflects the
corrected source. The original sidecar entry (which contained the elided
rendering plus the AMBIGUOUS flag) was replaced.
