# Constitution corpus

This directory holds the structured U.S. Constitution corpus for Publius. The Constitution is the base text every other corpus interprets — Federalist arguments for it, Tocqueville's observations of the constitutional culture it produced, and Supreme Court opinions construing it. It is itself a first-class corpus, addressable at the clause level.

## Files

- `raw/constitution-body.txt` — Preamble and Articles I–VII, drawn from the National Archives transcription page.
- `raw/bill-of-rights.txt` — National Archives Bill of Rights page: the 1789 Joint Resolution proposing 12 amendments and the canonical "Amendment I"–"Amendment X" forms.
- `raw/amendments-11-27.txt` — National Archives page for Amendments XI–XXVII.
- `parse.ts` — one-shot parser. Reads the three raw files, emits `constitution.json`. Idempotent. Re-runnable.
- `constitution.json` — structured corpus, 153 items. Conforms to the cross-corpus base schema in [`data/SCHEMA.md`](../SCHEMA.md); the Constitution extension is documented inline in `parse.ts`.
- `README.md` — this file.

## Provenance

- **Source:** Three National Archives transcription pages (Office of the Federal Register / Founding Documents):
  - <https://www.archives.gov/founding-docs/constitution-transcript> — Preamble and Articles I–VII (transcription of the engrossed parchment inscribed by Jacob Shallus).
  - <https://www.archives.gov/founding-docs/bill-of-rights-transcript> — 1789 Joint Resolution and Amendments I–X.
  - <https://www.archives.gov/founding-docs/amendments-11-27> — Amendments XI–XXVII.
- **Fetched:** 2026-05-18. HTML retrieved via `curl`, converted to plain text via `pandoc -f html -t plain`, navigation chrome trimmed.
- **SHA-256s** are recorded in `constitution.json`'s `source.notes` field for drift detection.

## How to regenerate

```bash
cd data/constitution
node --experimental-strip-types parse.ts
```

The parser is dependency-free: standard library only (`node:fs`, `node:crypto`, `node:url`, `node:path`).

## Granularity and IDs

Each clause is an independently citable item. Articles and Sections are navigational containers, not items — they do not appear as items, only as locator segments in IDs.

ID format (all IDs prefixed `constitution:`):

| Pattern | Use | Example |
| --- | --- | --- |
| `preamble` | Preamble | `constitution:preamble` |
| `art<N>` | Article with no sections | `constitution:art5`, `constitution:art7` |
| `art<N>.cl<M>` | Article with clauses but no sections | `constitution:art6.cl2` (Supremacy Clause) |
| `art<N>.sec<M>` | Section that is a single clause | `constitution:art3.sec1`, `constitution:art4.sec4` |
| `art<N>.sec<M>.cl<K>` | Body clause within a section | `constitution:art1.sec8.cl3` (Commerce Clause) |
| `amdt<N>` | Amendment with no sections or sub-clauses | `constitution:amdt2`, `constitution:amdt27` |
| `amdt<N>.cl<M>` | Amendment with clauses but no formal sections | `constitution:amdt1.cl1` (Establishment Clause) |
| `amdt<N>.sec<M>` | Amendment section that is a single clause | `constitution:amdt13.sec1` |
| `amdt<N>.sec<M>.cl<K>` | Sub-clauses within an amendment section | `constitution:amdt14.sec1.cl4` (Equal Protection Clause) |

The rule: include the deepest locator segment that addresses an item; omit segments that resolve to a single-clause node.

## Item shape (Constitution extension)

```json
"constitution": {
  "kind": "preamble" | "body_clause" | "amendment_clause",
  "article": 1,        // 1–7 for body; null otherwise
  "section": 8,        // null when not applicable at this depth
  "clause": 3,         // null when not applicable at this depth
  "amendment": null,   // 1–27 for amendment_clause; null otherwise
  "short_names": ["Commerce Clause"],   // canonical short names; [] if none
  "superseded_by": []  // IDs of clauses that supersede this one; [] if not superseded
}
```

Universal fields follow `data/SCHEMA.md`. Notes specific to the Constitution corpus:

- **`authors`** is `["Framers"]` for Articles I–VII and the Preamble; for amendments it names the proposing Congress (e.g., `["1st Congress"]` for amendments 1–10 and 27; `["39th Congress"]` for the 14th).
- **`date`** is the ratification date: `1788-06-21` (New Hampshire as ninth state) for the body; per-amendment ratification date thereafter.
- **`paragraphs`** is a one-element array for most clauses. Multi-paragraph clauses (e.g., `amdt25.sec4`) carry one string per source paragraph.
- **`constitutional_section`** is always `null`. The Constitution is the referent for that cross-corpus field, not a referrer.
- **`footnotes`** is always `[]`.
- **`plain_english`** is `null` throughout — same deferral pattern as Tocqueville. The register-shift pass that produces this field for Federalist has not been run against the Constitution.

## Editorial decisions encoded in the parse

These reflect calls made when the corpus was built; if they need to change, change the parser and regenerate.

1. **Clause boundaries are editorial.** The source text marks Articles and Sections but not clauses. Clause splits follow conventional legal-treatise practice — each clause is the smallest independently citable unit. Where canonical sub-clauses exist with widely-used short names (e.g., the four clauses of the 14th Amendment's Section 1), the section is split. Where the amendment reads as continuous prose with no canonical sub-divisions (e.g., the 6th Amendment), it is kept as a single item even when it enumerates multiple rights.
2. **Bracketed antecedent for Article I §8 clauses 2–18.** The source reads these as continuation phrases of "The Congress shall have Power" stated once in clause 1. To make clauses 2–18 independently readable, each carries the editorial prefix `[The Congress shall have Power]`. Verification strips bracketed segments from item text before substring-matching the raw, so the elision is transparent to the source check.
3. **National Archives source-level annotations are not stored as items.** The 12th Amendment carries bracketed superseded text and an asterisk pointing to a footnote ("*Superseded by section 3 of the 20th amendment."); the 14th Amendment Section 2 has a similar asterisk pointing to "*Changed by section 1 of the 26th amendment." These annotations remain in `raw/` but are stripped before verification and are not stored in the item text. The structural fact they convey is encoded in `superseded_by` on the affected items.
4. **Signatures, the interlineation note, and the convention closing are not items.** Article VII consists of the ratification sentence only; the closing convention statement, the textual-error note about interlined words, and the delegates' signatures are part of the engrossed parchment but are document mechanics, not normative constitutional text. They remain in `raw/constitution-body.txt`.
5. **`short_names` is an array.** Many clauses carry several canonical short names (e.g., `art1.sec8.cl18` is "Necessary and Proper Clause", "Elastic Clause", "Sweeping Clause", and "Coefficient Clause"). Where no canonical short name exists for a clause, the array is empty.
6. **`superseded_by` is populated at parse time.** 15 supersession links are encoded — for example, the original electoral procedure (`art2.sec1.cl3`) is marked as superseded by the 12th Amendment; the Fugitive Slave Clause (`art4.sec2.cl3`) by the 13th. The links capture the structural-textual relationship the source itself flags ("Article I, section 2, of the Constitution was modified by amendment 11"). This is not editorial reading-into; it is preserved relational metadata.

## Verification done at parse time

The parser fails the build if any of the following do not hold:

- **Coverage:** exactly 1 preamble, 84 body clauses, 68 amendment clauses (total 153). Every Article number 1–7 and every Amendment number 1–27 is represented.
- **Text matches source:** every item's joined paragraph text (with bracketed segments and asterisks stripped) appears as a substring of the corresponding raw National Archives transcription file.
- **IDs are unique.**
- **Supersession references are valid:** every `superseded_by` target resolves to an item ID that exists in the corpus.

A change to the National Archives transcription that affects any clause's text will fail the substring check and surface the drift rather than silently re-corrupt the data.
