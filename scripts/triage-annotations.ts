// Confidence-tiered triage classifier for editorial flags.
//
// Non-interactive runner: takes all unreviewed flagged annotation records
// for a given corpus, calls Claude Sonnet 4.6 with the per-corpus rubric,
// writes triage_tier + triage_rationale + triage_generated_at to each
// record atomically. Default skips records that already carry a non-null
// triage_tier (resume behavior). Re-triage on rubric-version mismatch is
// structural — see RUBRIC VERSION CHECK below.
//
// Run:
//   node --experimental-strip-types scripts/triage-annotations.ts --corpus federalist
//   node --experimental-strip-types scripts/triage-annotations.ts --corpus tocqueville
//
// Flags:
//   --corpus federalist|tocqueville  (required)
//   --dry-run                        enumerate candidates and exit; no API calls, no writes
//   --limit N                        classify at most N candidates this run (sampling)
//   --force                          re-classify all candidates regardless of existing tier
//   --include-reviewed               include records with editorial_status set (back-test
//                                    mode against owner-decided records). Writes only
//                                    triage_* fields; never modifies editorial_status.
//
// Rationale: DECISIONS.md "Confidence-tiered flag triage pipeline."
// Build path: IMPLEMENTATION_LOG.md "Phase 3.2 review — flag review reworked into a confidence-tiered triage pipeline."

import Anthropic from '@anthropic-ai/sdk';
import { readFileSync, writeFileSync, renameSync, appendFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { loadEnv } from '../data/eval/lib.ts';

// ---------------------------------------------------------------------------
// Model and request parameters.
// ---------------------------------------------------------------------------

const MODEL = 'claude-sonnet-4-6';
// 512 is generous given expected JSON output ~70-100 tokens; v1's 256 was
// tight enough that occasional long rationales (smoke-run max 226 chars)
// were a plausible source of the observed ~25% first-attempt parse retries.
const MAX_TOKENS = 512;
const TEMPERATURE = 0;

// ---------------------------------------------------------------------------
// Repo paths.
// ---------------------------------------------------------------------------

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const FEDERALIST_ANN = resolve(REPO_ROOT, 'data/federalist/federalist-annotations.json');
const FEDERALIST_CORPUS = resolve(REPO_ROOT, 'data/federalist/federalist.json');
const TOCQUEVILLE_ANN = resolve(REPO_ROOT, 'data/tocqueville/tocqueville-annotations.json');
const TOCQUEVILLE_CORPUS = resolve(REPO_ROOT, 'data/tocqueville/tocqueville.json');

// ---------------------------------------------------------------------------
// System prompt header — shared across corpora.
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT_HEADER = `You are triaging editorial flags on a literary translation or transliteration. Each flag identifies a possible issue in how the original text was rendered into English. Your job is to assign each flag to one of three confidence tiers:

- "accept" — the rendering can be auto-accepted without further editorial review.
- "rewrite" — the rendering is clearly wrong in a low-ambiguity way and must be rewritten.
- "manual" — anything else: contested, subtle, or requiring editorial judgment.

ASYMMETRIC ERROR TOLERANCE: misrouting a flag to "manual" costs nothing — the editor reviews it the same way they would have anyway. Misrouting a flag to "accept" is a real error — the rendering ships without human inspection. When in doubt, output "manual". Never output "accept" if anything about the flag, the original, or the rendering gives you pause.

THE TABLES BELOW ARE EXHAUSTIVE, NOT ILLUSTRATIVE. A substitution or rendering qualifies for "accept" only if it is a VERBATIM member of the relevant table. Similarity to a table entry is NOT membership. Pattern-matching beyond the literal table contents — concluding "this looks like the kind of substitution the table sanctions" — is exactly the failure mode this instruction exists to prevent. If the flag's term or rendering is not literally in the table, the answer is "manual", regardless of how reasonable the substitution may look.

The corpus-specific rubric below tells you which patterns qualify for "accept" or "rewrite". If a flag does not match an explicit pattern in the rubric, output "manual".`;

// ---------------------------------------------------------------------------
// Tocqueville deterministic pre-check constants and helpers.
//
// These back the Tocqueville adapter's deterministicResolve, which runs
// before classify() in the main loop. The patterns they encode were
// hand-migrated out of the LLM rubric in v3 (see DECISIONS.md, "Triage
// rubric v3"): rendering-content patterns whose triggers are string-checkable
// were exactly the surface where v2's Volume I back-test failed (Hecwelder
// safety hallucination, ch10 ¶451 chapter-heading rewrite mis-fire). The
// LLM is a poor reader of the rendering string it is shown; verifying that
// "the rendering contains X" against the string is what code does well.
//
// Federalist deliberately does not use these helpers — no labeled Federalist
// back-test exists yet, and building un-validated deterministic checks on
// the safety side is the failure mode v3 exists to eliminate.
// ---------------------------------------------------------------------------

export const PERIOD_VOCAB = [
  'sauvages',
  'sauvage',
  'nègres',
  'moeurs',
  'mœurs',
  'commune',
  'buffles',
  'patrie',
  'liberté',
  'néant',
  'élan',
  'cité',
  'peuplade',
  'métis',
] as const;

export const MISSPELLINGS = [
  { wrong: 'Meaupou', right: 'Maupeou' },
  { wrong: 'Hecwelder', right: 'Heckewelder' },
  { wrong: 'Blakstone', right: 'Blackstone' },
  { wrong: 'Francklin', right: 'Franklin' },
] as const;

export const UNTRANSLATED_TERMS = [
  "raison d'État",
  'Ancien Régime',
  'bourgeois',
  'bourgeoisie',
  'arrondissement',
] as const;

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Unicode-aware word boundary: a "word" character is any letter (\p{L}),
// combining mark (\p{M}), or digit (\p{N}). \b in JS regex is ASCII-only and
// would treat "é", "œ", "è" as non-word characters, producing false matches
// inside words like "communément" (would match "commune") or "patriotique"
// (would match "patrie"). Lookarounds give correct French-language behavior.
function wordRegex(term: string, flags = 'iu'): RegExp {
  return new RegExp(
    `(?<![\\p{L}\\p{M}\\p{N}])${escapeRegex(term)}(?![\\p{L}\\p{M}\\p{N}])`,
    flags,
  );
}

export function findPeriodVocab(text: string): string | null {
  for (const term of PERIOD_VOCAB) {
    if (wordRegex(term).test(text)) return term;
  }
  return null;
}

// Italicized in markdown (*term*) or HTML (<em>term</em>). Strict definition:
// the term is the sole content of an italic run (modulo surrounding
// whitespace). The loose reading — "term appears anywhere inside a *…* pair"
// — would false-positive when the closing `*` of one emphasis and the
// opening `*` of the next bridge a bare word between them, e.g.
// `*book A* then bourgeois then *book B*`. That bridge is an Accept-2 false
// positive on the high-risk side of the matrix; the strict form rejects it.
// The rubric phrasing "preserved the French term, italicized" supports the
// strict reading — the term itself is italicized, not embedded in a longer
// italicized phrase.
export function italicizedIn(text: string, term: string): boolean {
  const t = escapeRegex(term);
  const md = new RegExp(`\\*\\s*${t}\\s*\\*`, 'iu');
  const html = new RegExp(`<em\\b[^>]*>\\s*${t}\\s*</em>`, 'iu');
  return md.test(text) || html.test(text);
}

// "(Translator's note: …)", "[Translator's note: …]", "(modern term: …)".
function hasInlineTranslatorNote(text: string): boolean {
  return /[(\[]\s*(?:translator(?:'s)?\s*note|modern\s+term)\s*:/i.test(text);
}

export function matchMisspelling(flag: {
  key: string | null;
  note: string;
}): (typeof MISSPELLINGS)[number] | null {
  for (const m of MISSPELLINGS) {
    const re = wordRegex(m.wrong);
    if (flag.key !== null && re.test(flag.key)) return m;
    if (re.test(flag.note)) return m;
  }
  return null;
}

export function spellingApplied(
  rendering: string,
  m: { wrong: string; right: string },
): boolean {
  return wordRegex(m.right).test(rendering) && !wordRegex(m.wrong).test(rendering);
}

export function spellingNotApplied(
  rendering: string,
  m: { wrong: string; right: string },
): boolean {
  return wordRegex(m.wrong).test(rendering);
}

// ---------------------------------------------------------------------------
// Federalist rubric. Bumping the version string forces re-triage of all
// flagged unreviewed records on next run. Source: EDITORIAL_REVIEW_HANDOFF.md.
// ---------------------------------------------------------------------------

const FEDERALIST_RUBRIC_VERSION = 'federalist-v2';

const FEDERALIST_RUBRIC = `CORPUS: Federalist Papers (English → modern English transliteration)

FLAG KINDS (existing schema): WORD, RHETORIC, AMBIGUOUS

[ACCEPT] — only these patterns qualify. Anything else → "manual".

  1. False-alarm WORD flag.
     - Flag noted a substitution risk on a specific word.
     - The rendering preserved the original word verbatim.
     - The original word is NOT in the "Preserve these words" list below.
     - The rendering has no signs of truncation, dropped clauses, or dangling syntax.

  2. WORD flag matching a settled substitution.
     - The flag's term appears in the "Consistent substitutions accepted" table below.
     - The rendering uses the right-hand substitution from that table.
     - The original word is NOT in the "Preserve these words" list.

[REWRITE] — only these patterns qualify. The rendering must be unambiguously wrong.

  1. WORD flag substituting a "Preserve these words" entry.
     - Flag's term is in the table below.
     - The rendering replaced it with a softer or different word.

  2. Latin phrase translated to English.
     - Flag identifies a Latin phrase (e.g., "Divide et impera").
     - The rendering used English in place of the Latin.

  3. Capitalization stripped.
     - Flag identifies an emphasized capitalized word (UNION, WORD, PLUNDER, DESPERATE DEBTOR, etc.).
     - The rendering uses ordinary case.

  4. Truncation evident.
     - The rendering is substantially shorter than the original and ends mid-thought.
     - Or contains dangling syntax: "so ?", "more quickly than and", or similar broken fragments.
     - Or has clauses dropped where the flag identified a specific term that is now absent.

[MANUAL] — everything else. When uncertain, output "manual".

HARD GUARDS — never output "accept" if any of these is true:

  - Flag is RHETORIC kind (always slow, structural / sonic work).
  - Flag is AMBIGUOUS kind (genuinely uncertain).
  - Flag's term is in the "Preserve these words" list, even when the rendering looks correct.
    (The risk of subtle softening on a load-bearing word is too high to auto-accept.)
  - Flag's note mentions: anaphora, periodic sentence, ironic quotation, aposiopesis,
    self-correction, personification, alliteration, assonance, rhetorical structure.
  - The rendering contains all-caps words that the original does not, or fails to preserve
    all-caps emphasis present in the original.
  - The rendering has any visible sign of truncation or syntactic incompleteness.

PRESERVE THESE WORDS (EXHAUSTIVE LIST) — having the flag's term match any of these forces NOT-accept. These 16 entries are the complete list; any other archaic-sounding word is NOT covered by this guard, but is also NOT auto-acceptable just because it's missing — route to "manual":
  emoluments, sated, culpable, specious, pretended, deluged, denominate,
  "spirit of enterprise", implacable, haughty, "certain characters", trite,
  liberal (18c sense), pernicious, signal (adj.), "not too highly wrought"

CONSISTENT SUBSTITUTIONS ACCEPTED (EXHAUSTIVE LIST OF 8) — these 8 mappings are the COMPLETE set of substitutions that may be auto-accepted. A substitution qualifies for "accept" only if (a) the flag's term is a verbatim member of the left side of one of these rows, AND (b) the rendering uses the right-hand value verbatim. Any substitution not in this exact list — including ones that look "similar" or "obviously of the same kind" — routes to "manual". The classifier does NOT have license to extend this table:
  - laws of nations → international law
  - sanguine → optimistic
  - candor → fairness / openness
  - Chief Magistrate → President / Chief Executive
  - Spanish main → Spanish colonial coast
  - enormities → outrages
  - economy (18c sense) → fiscal prudence
  - infallibly → unfailingly

OUTPUT FORMAT — respond with strict JSON, no markdown, no preamble:
{ "tier": "accept" | "rewrite" | "manual", "rationale": "<one sentence, max 180 chars>" }`;

// ---------------------------------------------------------------------------
// Tocqueville rubric — v3. Narrowed to judgment-tail patterns: the
// rendering-content patterns (Accept 2/3, Rewrite 2/3/4) are resolved
// upstream by the adapter's deterministicResolve before this rubric is
// shown to the LLM. See DECISIONS.md, "Triage rubric v3".
//
// The period-vocabulary paragraph guard is RETAINED in the hard guards
// below. This is defense in depth against a future code path that invokes
// classify() WITHOUT the deterministic resolver in front of it (an
// architectural-drift safety net). It is NOT a backstop for bugs in
// findPeriodVocab itself — those are critical bugs whose safety net is the
// resolver's unit test, not this rubric.
// ---------------------------------------------------------------------------

const TOCQUEVILLE_RUBRIC_VERSION = 'tocqueville-v3';

const TOCQUEVILLE_RUBRIC = `CORPUS: Democracy in America (Tocqueville, French → English)

NOTE: Cases reaching this rubric have already been screened by a deterministic resolver upstream (spelling standardizations, untranslated-term italicization, inline translator's notes, "moeurs" residues, and the period-vocabulary paragraph guard). Those patterns will not reach you; only judgment-tail patterns remain.

FLAG KINDS (existing schema): READING, TEXTURE, TERM

[ACCEPT] — only these patterns qualify. Anything else → "manual".

  1. TERM flag for a settled rendering, applied correctly.
     - Flag's french matches an entry in "Established term renderings" below.
     - The rendering uses the established English exactly.
     - Flag's french is NOT in the "Period vocabulary" table.
     - The paragraph contains NO period-vocabulary terms.

  2. TEXTURE flag for an editorial structural element preserved verbatim,
     OTHER THAN the patterns handled by the deterministic resolver upstream.
     - Flag describes a section break ("* * * * *"), asterisks, chapter sommaire, or similar
       structural element not already handled in code.
     - Rendering is the same structural element, unchanged.
     - The paragraph contains NO period-vocabulary terms.

[REWRITE] — only these patterns qualify.

  1. English-language source quoted in French, back-translated.
     - Flag note identifies a recurring English-language source (see "English sources" below).
     - The rendering shows English text that is clearly NOT the verbatim original
       (e.g., it reads as a back-translation from French rather than canonical English text).

[MANUAL] — everything else. When uncertain, output "manual".

HARD GUARDS — never output "accept" if any of these is true:

  - Flag's french OR flag's note mentions ANY entry from the "Period vocabulary" table below.
  - The surrounding paragraph contains ANY period-vocabulary term, even if the flag is about
    something else entirely. (Stage 1 audit found "moeurs"-only flags on paragraphs containing
    "nègres" — those must never be auto-accepted.)
  - Flag is RHETORIC/TEXTURE about argumentative structure, oxymoron, irony, period
    social/ethnological assessment, or Tocqueville's voice.
  - Flag is READING interpreting argumentative content.
  - The rendering softens, modernizes, or euphemizes any period vocabulary term.

PERIOD VOCABULARY (EXHAUSTIVE LIST of hard-guard terms) — these terms must never appear in an "accept" tier, even if the rendering looks correct. This guard is closed: terms outside this list are not hard-guarded by this rule, but they are also NOT auto-acceptable just because they're missing — route to "manual" if anything else gives you pause:
  sauvages, sauvage, nègres, moeurs, mœurs, commune, buffles, patrie, liberté,
  néant, élan, cité, peuplade, métis

ESTABLISHED TERM RENDERINGS (EXHAUSTIVE LIST) — TERM flag where the flag's french is a VERBATIM member of the left side AND the rendering uses the right-hand value verbatim is a candidate for "accept". This is the COMPLETE list. Similarity is not membership; the classifier may not extend this table by analogy. Variants of established renderings (different word order, partial overlap, "spirit of the table") do NOT qualify. The list:
  - principe générateur → generative principle
  - loi de la représentation → principle of representation
  - corps constituant → constituent body
  - cens → property qualification
  - administrés → administered subjects
  - enseveli → entombed
  - intrigants → intriguers
  - attributions → functions
  - en attendant → until further notice
  - usufruit → temporary use rights
  - platane → sycamore (American context)
  - peuplier de Virginie → tulip tree
  - mélèze → larch
  - chêne vert → live oak
  - état social → social condition
  - intérêt d'individualité → interest of particularity
  - jurisprudence → judicial decisions
  - supplice → torture / torture-death / act of torture
  - sans foi politique → without political faith
  - factieux → faction leaders
  - corps secondaires → intermediate bodies
  - collèges électoraux (Tocqueville's usage) → delegating bodies
  - esprit légiste → legal spirit
  - légistes → lawyers
  - symbole (political/party sense) → creed
  - capacité (civic sense) → qualification / capacity
  - avènement → advent
  - démocratie (capitalized in French) → Democracy
  - entail (for legal substitution) → entail
  - pâture journalière → daily diet
  - lumières → learning OR knowledge (never "Enlightenment")
  - détrompeur → illusions ("cast aside his illusions")
  - les ressorts du gouvernement → the springs of government
  - promenant la torche → carrying the torch

ENGLISH SOURCES (back-translation of any of these in the rendering = "rewrite"):
  - Jefferson, Notes on the State of Virginia
  - Jefferson letters (to Madison and others)
  - Mayflower Compact
  - Kent, Commentaries on American Law
  - Blackstone, Commentaries
  - Story, Commentaries on the Constitution
  - Delolme
  - New York Revised Statutes
  - U.S. Constitution (Preamble; all Articles; all Amendments)
  - State constitutions: New Hampshire, Massachusetts, North Carolina, Virginia,
    South Carolina, Kentucky, Tennessee, Ohio, Louisiana, Mississippi, Alabama, Pennsylvania
  - Federalist No. 51
  - Massachusetts General Assembly committee report on New England Courant

OUTPUT FORMAT — respond with strict JSON, no markdown, no preamble:
{ "tier": "accept" | "rewrite" | "manual", "rationale": "<one sentence, max 180 chars>" }`;

// ---------------------------------------------------------------------------
// Types — minimum needed to read/write the annotation and corpus files.
// ---------------------------------------------------------------------------

type Tier = 'accept' | 'rewrite' | 'manual';

type TriageFields = {
  triage_tier: Tier | null;
  triage_rationale: string | null;
  triage_generated_at: string | null;
};

type FedFlag = { kind: 'WORD' | 'RHETORIC' | 'AMBIGUOUS'; term: string | null; note: string };

type FedParagraphAnn = TriageFields & {
  paragraph_index: number;
  bypassed?: true;
  flags: FedFlag[];
  editorial_status: null | 'accepted' | 'edited' | 'flagged_for_rewrite';
  editorial_note: string | null;
};

type FedPaperAnn = { paper_number: number; paragraphs: FedParagraphAnn[] };

type FedAnnotations = {
  corpus: 'federalist';
  generated_at: string;
  prompt_version: string;
  prompt_sha256: string;
  triage_rubric_version: string | null;
  triage_rubric_sha256: string | null;
  papers: FedPaperAnn[];
};

type FedItem = {
  id: string;
  paragraphs: string[];
  plain_english: string[] | null;
  federalist: { number: number };
};

type FedCorpus = { items: FedItem[] };

type TocFlag = { kind: 'READING' | 'TEXTURE' | 'TERM'; french: string | null; note: string };

type TocParagraphAnn = TriageFields & {
  paragraph_index: number;
  flags: TocFlag[];
  editorial_status: null | 'accepted' | 'edited' | 'flagged_for_rewrite';
  editorial_note: string | null;
};

type TocFootnoteAnn = TriageFields & {
  marker: string;
  flags: TocFlag[];
  editorial_status: null | 'accepted' | 'edited' | 'flagged_for_rewrite';
  editorial_note: string | null;
};

type TocItemAnn = {
  item_id: string;
  paragraphs: TocParagraphAnn[];
  footnotes: TocFootnoteAnn[];
};

type TocAnnotations = {
  corpus: 'tocqueville';
  generated_at: string;
  prompt_version: string;
  prompt_sha256: string;
  triage_rubric_version: string | null;
  triage_rubric_sha256: string | null;
  volume: number;
  items: TocItemAnn[];
};

type TocItem = {
  id: string;
  paragraphs: string[];
  footnotes: { marker: string; paragraphs: string[] }[];
  tocqueville: {
    translation: string[] | null;
    footnotes_translation: { marker: string; paragraphs: string[] }[] | null;
  };
};

type TocCorpus = { items: TocItem[] };

// ---------------------------------------------------------------------------
// Atomic write — matches existing review-annotations CLI pattern.
// ---------------------------------------------------------------------------

function atomicWriteJson(path: string, obj: unknown): void {
  const tmp = path + '.tmp';
  writeFileSync(tmp, JSON.stringify(obj, null, 2) + '\n');
  renameSync(tmp, path);
}

// ---------------------------------------------------------------------------
// Rubric hashing — SHA-256 of (header + "\n\n" + rubric). Stable as long as
// neither string mutates.
// ---------------------------------------------------------------------------

function buildSystemPrompt(rubric: string): string {
  return `${SYSTEM_PROMPT_HEADER}\n\n${rubric}`;
}

function rubricSha256(rubric: string): string {
  return createHash('sha256').update(buildSystemPrompt(rubric)).digest('hex');
}

// ---------------------------------------------------------------------------
// Candidate record — the common shape passed to the classifier.
// ---------------------------------------------------------------------------

type Candidate = {
  locator: string;
  flags: Array<{ kind: string; key: string | null; note: string }>;
  original: string;
  rendering: string;
  // Mutator — applies the result to the underlying annotation record AND writes.
  apply: (tier: Tier, rationale: string, ts: string) => void;
};

// ---------------------------------------------------------------------------
// Corpus adapter — each builds the candidate list and exposes file-level
// triage_rubric_* fields. Adapter encapsulates record traversal so the main
// loop is corpus-agnostic.
// ---------------------------------------------------------------------------

// Deterministic resolver result. The classifier loop applies this directly
// to the annotation record and skips the LLM for that candidate. Rationale
// is prefixed `[deterministic]` so the audit trail in triage_rationale makes
// the resolution source visible without consulting telemetry.
type DetVerdict = { tier: Tier; rationale: string; pattern: string };

interface CorpusAdapter {
  readonly slug: 'federalist' | 'tocqueville';
  readonly rubric: string;
  readonly rubricVersion: string;
  readFileVersion(): { version: string | null; sha: string | null };
  writeFileVersion(version: string, sha: string): void;
  buildCandidates(opts: { includeAlreadyTriaged: boolean; includeReviewed: boolean }): Candidate[];
  // Optional. Only implemented by the Tocqueville adapter in v3. Called by
  // the main loop before classify(); on non-null verdict, the LLM is skipped
  // for that candidate. The Federalist adapter intentionally does NOT
  // implement this — see DECISIONS.md "Triage rubric v3: Federalist deferred".
  deterministicResolve?(c: Candidate): DetVerdict | null;
}

function createFederalistAdapter(): CorpusAdapter {
  const ann: FedAnnotations = JSON.parse(readFileSync(FEDERALIST_ANN, 'utf8'));
  const corpus: FedCorpus = JSON.parse(readFileSync(FEDERALIST_CORPUS, 'utf8'));

  const itemByNumber = new Map<number, FedItem>();
  for (const it of corpus.items) itemByNumber.set(it.federalist.number, it);

  function write(): void {
    atomicWriteJson(FEDERALIST_ANN, ann);
  }

  return {
    slug: 'federalist',
    rubric: FEDERALIST_RUBRIC,
    rubricVersion: FEDERALIST_RUBRIC_VERSION,
    readFileVersion: () => ({
      version: ann.triage_rubric_version,
      sha: ann.triage_rubric_sha256,
    }),
    writeFileVersion: (version, sha) => {
      ann.triage_rubric_version = version;
      ann.triage_rubric_sha256 = sha;
      write();
    },
    buildCandidates: ({ includeAlreadyTriaged, includeReviewed }) => {
      const out: Candidate[] = [];
      for (const paper of ann.papers) {
        const item = itemByNumber.get(paper.paper_number);
        if (!item) continue;
        for (const para of paper.paragraphs) {
          if (para.flags.length === 0) continue;
          if (!includeReviewed && para.editorial_status !== null) continue;
          if (!includeAlreadyTriaged && para.triage_tier !== null) continue;

          const original = item.paragraphs[para.paragraph_index] ?? '';
          const rendering =
            item.plain_english !== null
              ? item.plain_english[para.paragraph_index] ?? ''
              : '(plain_english not populated)';

          out.push({
            locator: `Federalist No. ${paper.paper_number}, paragraph ${para.paragraph_index}`,
            flags: para.flags.map((f) => ({ kind: f.kind, key: f.term, note: f.note })),
            original,
            rendering,
            apply: (tier, rationale, ts) => {
              para.triage_tier = tier;
              para.triage_rationale = rationale;
              para.triage_generated_at = ts;
              write();
            },
          });
        }
      }
      return out;
    },
  };
}

function createTocquevilleAdapter(): CorpusAdapter {
  const ann: TocAnnotations = JSON.parse(readFileSync(TOCQUEVILLE_ANN, 'utf8'));
  const corpus: TocCorpus = JSON.parse(readFileSync(TOCQUEVILLE_CORPUS, 'utf8'));

  const itemById = new Map<string, TocItem>();
  for (const it of corpus.items) itemById.set(it.id, it);

  function write(): void {
    atomicWriteJson(TOCQUEVILLE_ANN, ann);
  }

  // Order matters. Rewrite checks first (a paragraph with a period-vocab
  // term AND an unfixed Hecwelder is still a rewrite, not a manual). Then
  // the period-vocab paragraph guard returns manual. Then accept resolution
  // requires every flag to independently resolve. Anything else → null
  // (LLM handles the residual judgment-tail patterns).
  function deterministicResolveToc(c: Candidate): DetVerdict | null {
    // Rewrite 3 — inline translator's note in the rendering.
    if (hasInlineTranslatorNote(c.rendering)) {
      return {
        tier: 'rewrite',
        rationale: "[deterministic] inline translator's note in rendering (Rewrite 3)",
        pattern: 'Rewrite 3',
      };
    }

    // Rewrite 2 — spelling standardization not applied. Per-flag scan: if
    // any flag references one of the four misspellings and the misspelled
    // form is still verbatim in the rendering, this is a rewrite.
    for (const flag of c.flags) {
      const m = matchMisspelling(flag);
      if (m && spellingNotApplied(c.rendering, m)) {
        return {
          tier: 'rewrite',
          rationale: `[deterministic] spelling not applied: ${m.wrong} → ${m.right} (Rewrite 2)`,
          pattern: 'Rewrite 2',
        };
      }
    }

    // Rewrite 4 — moeurs or mœurs anywhere in the rendering (no paragraph-
    // index precondition; see DECISIONS.md "Moeurs convention").
    for (const form of ['moeurs', 'mœurs'] as const) {
      if (wordRegex(form).test(c.rendering)) {
        return {
          tier: 'rewrite',
          rationale: `[deterministic] "${form}" present in rendering (Rewrite 4)`,
          pattern: 'Rewrite 4',
        };
      }
    }

    // Period-vocab paragraph guard. Original OR rendering. Closed list of
    // 14 terms. A hit routes to manual deterministically — keeps the LLM
    // away from the surface where v2's Hecwelder hallucination occurred.
    const pvOrig = findPeriodVocab(c.original);
    const pvRend = findPeriodVocab(c.rendering);
    if (pvOrig !== null || pvRend !== null) {
      const hit = pvOrig ?? pvRend;
      const where = pvOrig !== null ? 'original' : 'rendering';
      return {
        tier: 'manual',
        rationale: `[deterministic] period-vocabulary term "${hit}" present in ${where} (guard)`,
        pattern: 'period-vocab guard',
      };
    }

    // Accept resolution. Every flag must independently resolve to Accept 2
    // (untranslated-term italicization) or Accept 3 (spelling applied). If
    // any flag does not resolve, fall through to the LLM (null) — accept
    // is the high-risk side of the matrix, and partial deterministic
    // matches are not enough.
    const reasons: string[] = [];
    for (const flag of c.flags) {
      // Accept 3.
      if (flag.kind === 'READING') {
        const m = matchMisspelling(flag);
        if (m && spellingApplied(c.rendering, m)) {
          reasons.push(`spelling ${m.wrong}→${m.right} applied`);
          continue;
        }
      }
      // Accept 2.
      if (flag.kind === 'TERM' && flag.key !== null) {
        const exact = UNTRANSLATED_TERMS.find((t) => t === flag.key);
        if (exact && italicizedIn(c.rendering, exact)) {
          reasons.push(`untranslated term "${exact}" preserved-italicized`);
          continue;
        }
      }
      // Flag did not resolve — defer to the LLM.
      return null;
    }
    if (reasons.length === 0) return null;
    return {
      tier: 'accept',
      rationale: `[deterministic] ${reasons.join('; ')}`,
      pattern: 'Accept',
    };
  }

  return {
    slug: 'tocqueville',
    rubric: TOCQUEVILLE_RUBRIC,
    rubricVersion: TOCQUEVILLE_RUBRIC_VERSION,
    readFileVersion: () => ({
      version: ann.triage_rubric_version,
      sha: ann.triage_rubric_sha256,
    }),
    writeFileVersion: (version, sha) => {
      ann.triage_rubric_version = version;
      ann.triage_rubric_sha256 = sha;
      write();
    },
    deterministicResolve: deterministicResolveToc,
    buildCandidates: ({ includeAlreadyTriaged, includeReviewed }) => {
      const out: Candidate[] = [];
      for (const annItem of ann.items) {
        const item = itemById.get(annItem.item_id);
        if (!item) continue;

        for (const para of annItem.paragraphs) {
          if (para.flags.length === 0) continue;
          if (!includeReviewed && para.editorial_status !== null) continue;
          if (!includeAlreadyTriaged && para.triage_tier !== null) continue;

          const original = item.paragraphs[para.paragraph_index] ?? '';
          const rendering =
            item.tocqueville.translation !== null
              ? item.tocqueville.translation[para.paragraph_index] ?? ''
              : '(translation not populated)';

          out.push({
            locator: `${annItem.item_id} ¶${para.paragraph_index}`,
            flags: para.flags.map((f) => ({ kind: f.kind, key: f.french, note: f.note })),
            original,
            rendering,
            apply: (tier, rationale, ts) => {
              para.triage_tier = tier;
              para.triage_rationale = rationale;
              para.triage_generated_at = ts;
              write();
            },
          });
        }

        for (const fn of annItem.footnotes) {
          if (fn.flags.length === 0) continue;
          if (!includeReviewed && fn.editorial_status !== null) continue;
          if (!includeAlreadyTriaged && fn.triage_tier !== null) continue;

          const fnCorpus = item.footnotes.find((x) => x.marker === fn.marker);
          const fnTr = item.tocqueville.footnotes_translation?.find((x) => x.marker === fn.marker);
          const original = fnCorpus ? fnCorpus.paragraphs.join('\n\n') : '';
          const rendering = fnTr
            ? fnTr.paragraphs.join('\n\n')
            : '(footnotes_translation not populated)';

          out.push({
            locator: `${annItem.item_id} footnote ${fn.marker}`,
            flags: fn.flags.map((f) => ({ kind: f.kind, key: f.french, note: f.note })),
            original,
            rendering,
            apply: (tier, rationale, ts) => {
              fn.triage_tier = tier;
              fn.triage_rationale = rationale;
              fn.triage_generated_at = ts;
              write();
            },
          });
        }
      }
      return out;
    },
  };
}

// ---------------------------------------------------------------------------
// User message construction. Kept compact — the system prompt carries the
// rules; the user message carries the case.
// ---------------------------------------------------------------------------

function buildUserMessage(c: Candidate, corpus: 'federalist' | 'tocqueville'): string {
  const flagLines = c.flags
    .map((f) => (f.key !== null ? `[${f.kind}] "${f.key}" — ${f.note}` : `[${f.kind}] ${f.note}`))
    .join('\n');
  return `CORPUS: ${corpus}
LOCATION: ${c.locator}

FLAGS (${c.flags.length}):
${flagLines}

ORIGINAL:
${c.original}

CURRENT RENDERING:
${c.rendering}`;
}

// ---------------------------------------------------------------------------
// Classifier call. Uses prompt caching on the system block — identical
// across every flag in a run, so cache hits after the first.
// ---------------------------------------------------------------------------

type ClassificationResult = {
  tier: Tier;
  rationale: string;
  rawOutput: string;
  // True when the first attempt failed JSON parsing and the retry was used.
  // The retry may itself have succeeded (terminal === false) or failed
  // (terminal === true, defaulted to manual).
  retried: boolean;
  terminal: boolean;
};

function parseClassification(raw: string): { tier: Tier; rationale: string } | null {
  // Strip any markdown fencing the model might add despite instructions.
  let s = raw.trim();
  const fence = s.match(/^```(?:json)?\s*([\s\S]*?)```$/);
  if (fence) s = fence[1].trim();
  // Find the first { ... } JSON object.
  const first = s.indexOf('{');
  const last = s.lastIndexOf('}');
  if (first < 0 || last < 0 || last < first) return null;
  const jsonText = s.slice(first, last + 1);
  let obj: unknown;
  try {
    obj = JSON.parse(jsonText);
  } catch {
    return null;
  }
  if (typeof obj !== 'object' || obj === null) return null;
  const tier = (obj as { tier?: unknown }).tier;
  const rationale = (obj as { rationale?: unknown }).rationale;
  if (tier !== 'accept' && tier !== 'rewrite' && tier !== 'manual') return null;
  if (typeof rationale !== 'string') return null;
  return { tier, rationale: rationale.slice(0, 240) };
}

async function classify(
  client: Anthropic,
  systemPrompt: string,
  userMessage: string,
  locator: string,
  debugLogPath: string,
): Promise<ClassificationResult> {
  let retried = false;
  let lastRaw = '';

  for (let attempt = 0; attempt < 2; attempt++) {
    const messages =
      attempt === 0
        ? [{ role: 'user' as const, content: userMessage }]
        : [
            { role: 'user' as const, content: userMessage },
            { role: 'assistant' as const, content: lastRaw },
            {
              role: 'user' as const,
              content:
                'Your previous response was not strict JSON. Respond ONLY with valid JSON of the form { "tier": "accept" | "rewrite" | "manual", "rationale": "..." }. No markdown, no preamble.',
            },
          ];

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      temperature: TEMPERATURE,
      system: [
        {
          type: 'text',
          text: systemPrompt,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages,
    });

    const raw = response.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as { type: 'text'; text: string }).text)
      .join('');
    lastRaw = raw;

    const parsed = parseClassification(raw);
    if (parsed) {
      return { tier: parsed.tier, rationale: parsed.rationale, rawOutput: raw, retried, terminal: false };
    }

    // First-attempt parse failure — log the raw output for diagnosis. The
    // log is append-only; one record per failure. Identified by locator so
    // the operator can correlate against the classified record.
    if (attempt === 0) {
      retried = true;
      try {
        appendFileSync(
          debugLogPath,
          `--- ${new Date().toISOString()}  ${locator}  (first-attempt parse failure)\n${raw}\n\n`,
        );
      } catch {
        // Debug logging is best-effort; do not derail classification if the
        // log path is unwritable.
      }
    }
  }

  // Both attempts failed JSON parsing. Default to manual; record the
  // terminal failure in the rationale so the operator can investigate.
  try {
    appendFileSync(
      debugLogPath,
      `--- ${new Date().toISOString()}  ${locator}  (TERMINAL parse failure; defaulted to manual)\n${lastRaw}\n\n`,
    );
  } catch {
    // best-effort
  }
  return {
    tier: 'manual',
    rationale: '(classifier output unparseable after retry; defaulted to manual)',
    rawOutput: lastRaw,
    retried: true,
    terminal: true,
  };
}

// ---------------------------------------------------------------------------
// Rubric version check — structural re-triage policy.
//
// Cases:
//   1. File version null, code version present → first run; write version+sha;
//      classify all candidates with null triage_tier.
//   2. File version === code version AND file sha === code sha → resume; default
//      skips candidates with non-null triage_tier (unless --force).
//   3. File version === code version AND file sha !== code sha → error: rubric
//      mutated without version bump. Operator must bump version or revert source.
//   4. File version !== code version → re-triage all flagged candidates regardless
//      of existing triage_tier. Write new version+sha at start.
// ---------------------------------------------------------------------------

type VersionDecision =
  | { kind: 'first_run' | 'resume' | 'reclassify_all' }
  | { kind: 'error'; message: string };

function decideVersionAction(
  fileVersion: string | null,
  fileSha: string | null,
  codeVersion: string,
  codeSha: string,
): VersionDecision {
  if (fileVersion === null) {
    return { kind: 'first_run' };
  }
  if (fileVersion === codeVersion) {
    if (fileSha === codeSha) return { kind: 'resume' };
    return {
      kind: 'error',
      message: `Rubric drift detected: file version "${fileVersion}" matches code, but rubric SHA differs.\n` +
        `  file sha: ${fileSha}\n` +
        `  code sha: ${codeSha}\n` +
        `The rubric source was changed without a version bump. Bump the version string in\n` +
        `scripts/triage-annotations.ts (e.g., "${codeVersion}" → "${codeVersion.replace(/v(\d+)$/, (_, n) => 'v' + (Number(n) + 1))}")\n` +
        `or revert the source change to match the existing version. Re-running on rubric\n` +
        `change without version bump would silently mix tiers across rubric generations.`,
    };
  }
  return { kind: 'reclassify_all' };
}

// ---------------------------------------------------------------------------
// CLI argument parsing.
// ---------------------------------------------------------------------------

type Args = {
  corpus: 'federalist' | 'tocqueville';
  dryRun: boolean;
  limit: number | null;
  force: boolean;
  // Validation/back-test mode. When set, the candidate set includes records
  // with editorial_status !== null (i.e., already-decided by the owner).
  // The classifier writes only triage_tier / triage_rationale /
  // triage_generated_at; it NEVER modifies editorial_status. This lets the
  // already-decided units act as a labeled test set for confusion-matrix
  // measurement against the classifier's tiering.
  includeReviewed: boolean;
};

function parseArgs(argv: string[]): Args {
  let corpus: 'federalist' | 'tocqueville' | null = null;
  let dryRun = false;
  let limit: number | null = null;
  let force = false;
  let includeReviewed = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--corpus') {
      const v = argv[i + 1];
      if (v !== 'federalist' && v !== 'tocqueville') {
        throw new Error(`--corpus must be 'federalist' or 'tocqueville', got: ${v}`);
      }
      corpus = v;
      i++;
    } else if (arg === '--dry-run') {
      dryRun = true;
    } else if (arg === '--limit') {
      const v = Number(argv[i + 1]);
      if (!Number.isInteger(v) || v <= 0) {
        throw new Error(`--limit must be a positive integer, got: ${argv[i + 1]}`);
      }
      limit = v;
      i++;
    } else if (arg === '--force') {
      force = true;
    } else if (arg === '--include-reviewed') {
      includeReviewed = true;
    } else {
      throw new Error(`unknown argument: ${arg}`);
    }
  }

  if (corpus === null) {
    throw new Error("--corpus is required (one of: 'federalist', 'tocqueville')");
  }
  return { corpus, dryRun, limit, force, includeReviewed };
}

// ---------------------------------------------------------------------------
// Main loop.
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  loadEnv();

  const args = parseArgs(process.argv.slice(2));
  const adapter =
    args.corpus === 'federalist' ? createFederalistAdapter() : createTocquevilleAdapter();

  const codeSha = rubricSha256(adapter.rubric);
  const file = adapter.readFileVersion();
  const decision = decideVersionAction(file.version, file.sha, adapter.rubricVersion, codeSha);

  if (decision.kind === 'error') {
    console.error('[triage] ERROR:');
    console.error(decision.message);
    process.exit(2);
  }

  console.log(`[triage] corpus: ${adapter.slug}`);
  console.log(`[triage] code rubric: ${adapter.rubricVersion} (sha ${codeSha.slice(0, 12)}…)`);
  console.log(`[triage] file rubric: ${file.version ?? 'null'} (sha ${(file.sha ?? 'null').slice(0, 12)}…)`);
  console.log(`[triage] action:      ${decision.kind}`);
  if (args.includeReviewed) {
    console.log(`[triage] mode:        --include-reviewed (back-test against owner-decided records; editorial_status NOT modified)`);
  }

  const includeAlreadyTriaged = decision.kind === 'reclassify_all' || args.force;
  let candidates = adapter.buildCandidates({
    includeAlreadyTriaged,
    includeReviewed: args.includeReviewed,
  });

  if (args.limit !== null) candidates = candidates.slice(0, args.limit);

  console.log(`[triage] candidates:  ${candidates.length}`);

  if (args.dryRun) {
    console.log('[triage] --dry-run set; printing candidate locators and exiting (no API calls, no writes).');
    for (let i = 0; i < Math.min(candidates.length, 20); i++) {
      const c = candidates[i];
      console.log(`  ${i + 1}. ${c.locator}  [${c.flags.map((f) => f.kind).join(',')}]`);
    }
    if (candidates.length > 20) console.log(`  ... and ${candidates.length - 20} more.`);
    return;
  }

  if (candidates.length === 0) {
    console.log('[triage] nothing to do.');
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY not set in environment.');
  }
  const client = new Anthropic({ apiKey });

  // Write the file-level rubric version BEFORE classifying any record, so a
  // crash mid-run leaves the file in a consistent "version X, partially triaged"
  // state rather than "version null, partially triaged."
  adapter.writeFileVersion(adapter.rubricVersion, codeSha);

  const systemPrompt = buildSystemPrompt(adapter.rubric);
  const ts = () => new Date().toISOString();

  const debugLogPath = resolve(tmpdir(), `triage-debug-${adapter.slug}.log`);
  console.log(`[triage] debug log:   ${debugLogPath} (first-attempt parse failures and terminals)`);

  const counts: Record<Tier, number> = { accept: 0, rewrite: 0, manual: 0 };
  // Resolution-source breakdown of `counts`. detCounts[source][tier] tracks
  // how many of each tier came from the deterministic resolver vs the LLM.
  // Their sums match counts: detCounts.deterministic.accept +
  // detCounts.llm.accept === counts.accept, and so on.
  const detCounts: Record<'deterministic' | 'llm', Record<Tier, number>> = {
    deterministic: { accept: 0, rewrite: 0, manual: 0 },
    llm: { accept: 0, rewrite: 0, manual: 0 },
  };
  let parseRetries = 0;
  let parseTerminal = 0;

  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];

    // Deterministic pre-check. Only the Tocqueville adapter implements this
    // in v3; Federalist's deterministicResolve is undefined, so the call
    // falls through to classify() unchanged.
    const det = adapter.deterministicResolve?.(c) ?? null;
    if (det !== null) {
      c.apply(det.tier, det.rationale, ts());
      counts[det.tier]++;
      detCounts.deterministic[det.tier]++;
    } else {
      const userMessage = buildUserMessage(c, adapter.slug);
      let result: ClassificationResult;
      try {
        result = await classify(client, systemPrompt, userMessage, c.locator, debugLogPath);
      } catch (e) {
        console.error(`[triage] API error on ${c.locator}: ${(e as Error).message}`);
        console.error('[triage] stopping run; existing writes are durable. Re-run to resume.');
        throw e;
      }
      c.apply(result.tier, result.rationale, ts());
      counts[result.tier]++;
      detCounts.llm[result.tier]++;
      if (result.retried) parseRetries++;
      if (result.terminal) parseTerminal++;
    }

    if ((i + 1) % 25 === 0 || i + 1 === candidates.length) {
      console.log(
        `[triage] ${i + 1}/${candidates.length}  accept=${counts.accept} rewrite=${counts.rewrite} manual=${counts.manual}  retries=${parseRetries} terminal=${parseTerminal}`,
      );
    }
  }

  const detTotal =
    detCounts.deterministic.accept +
    detCounts.deterministic.rewrite +
    detCounts.deterministic.manual;
  const llmTotal =
    detCounts.llm.accept + detCounts.llm.rewrite + detCounts.llm.manual;

  console.log('');
  console.log('=== TRIAGE SUMMARY ===');
  console.log(`  corpus:           ${adapter.slug}`);
  console.log(`  rubric:           ${adapter.rubricVersion}`);
  console.log(`  candidates:       ${candidates.length}`);
  console.log(`  accept:           ${counts.accept}  (deterministic=${detCounts.deterministic.accept}, llm=${detCounts.llm.accept})`);
  console.log(`  rewrite:          ${counts.rewrite}  (deterministic=${detCounts.deterministic.rewrite}, llm=${detCounts.llm.rewrite})`);
  console.log(`  manual:           ${counts.manual}  (deterministic=${detCounts.deterministic.manual}, llm=${detCounts.llm.manual})`);
  console.log(`  resolution source: deterministic=${detTotal}, llm=${llmTotal}`);
  console.log(`  parse retries:    ${parseRetries} (first attempt failed JSON, second succeeded)`);
  console.log(`  parse terminal:   ${parseTerminal} (both attempts failed; defaulted to manual)`);
  if (parseRetries > 0 || parseTerminal > 0) {
    console.log(`  debug log:        ${debugLogPath}`);
  }
  console.log('======================');
}

// Direct-invocation guard — prevents an `await import(...)` smoke test from
// kicking off a real run. Matches the pattern in review-annotations.ts.
const isDirectInvocation =
  typeof process.argv[1] === 'string' &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectInvocation) {
  main().catch((err) => {
    console.error('[fatal]', err);
    process.exit(1);
  });
}
