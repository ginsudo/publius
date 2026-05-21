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
//
// Rationale: DECISIONS.md "Confidence-tiered flag triage pipeline."
// Build path: IMPLEMENTATION_LOG.md "Phase 3.2 review — flag review reworked into a confidence-tiered triage pipeline."

import Anthropic from '@anthropic-ai/sdk';
import { readFileSync, writeFileSync, renameSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

// ---------------------------------------------------------------------------
// Model and request parameters.
// ---------------------------------------------------------------------------

const MODEL = 'claude-sonnet-4-6';
const MAX_TOKENS = 256;
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

The corpus-specific rubric below tells you which patterns qualify for "accept" or "rewrite". If a flag does not match an explicit pattern in the rubric, output "manual".`;

// ---------------------------------------------------------------------------
// Federalist rubric. Bumping the version string forces re-triage of all
// flagged unreviewed records on next run. Source: EDITORIAL_REVIEW_HANDOFF.md.
// ---------------------------------------------------------------------------

const FEDERALIST_RUBRIC_VERSION = 'federalist-v1';

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

PRESERVE THESE WORDS — having the flag's term match any of these forces NOT-accept:
  emoluments, sated, culpable, specious, pretended, deluged, denominate,
  "spirit of enterprise", implacable, haughty, "certain characters", trite,
  liberal (18c sense), pernicious, signal (adj.), "not too highly wrought"

CONSISTENT SUBSTITUTIONS ACCEPTED — flag's term matching the left side AND rendering using the right side is a candidate for "accept":
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
// Tocqueville rubric.
// ---------------------------------------------------------------------------

const TOCQUEVILLE_RUBRIC_VERSION = 'tocqueville-v1';

const TOCQUEVILLE_RUBRIC = `CORPUS: Democracy in America (Tocqueville, French → English)

FLAG KINDS (existing schema): READING, TEXTURE, TERM

[ACCEPT] — only these patterns qualify. Anything else → "manual".

  1. TERM flag for a settled rendering, applied correctly.
     - Flag's french matches an entry in "Established term renderings" below.
     - The rendering uses the established English exactly.
     - Flag's french is NOT in the "Period vocabulary" table.
     - The paragraph contains NO period-vocabulary terms.

  2. TERM flag for an untranslated/italicized term, preserved correctly.
     - Flag's french matches an entry in "Untranslated terms" below.
     - The rendering preserved the French term, italicized (asterisks or HTML em).
     - The paragraph contains NO period-vocabulary terms.

  3. READING flag for a spelling standardization, applied correctly.
     - Flag identifies a spelling correction listed below.
     - The rendering shows the corrected English spelling.
     - The paragraph contains NO period-vocabulary terms.

  4. TEXTURE flag for an editorial structural element preserved verbatim.
     - Flag describes a section break ("* * * * *"), asterisks, chapter sommaire, or similar.
     - Rendering is the same structural element, unchanged.
     - The paragraph contains NO period-vocabulary terms.

[REWRITE] — only these patterns qualify.

  1. English-language source quoted in French, back-translated.
     - Flag note identifies a recurring English-language source (see "English sources" below).
     - The rendering shows English text that is clearly NOT the verbatim original
       (e.g., it reads as a back-translation from French rather than canonical English text).

  2. Spelling standardization not applied.
     - Flag identifies a spelling correction (Meaupou, Hecwelder, Blakstone, Francklin).
     - The rendering still shows the uncorrected period spelling.

  3. Inline translator's note added by the generation pass.
     - The rendering contains a parenthetical gloss, modernization note, or
       editorial bracket NOT present in the original French (e.g., "(modern term: ...)",
       "(Translator's note: ...)").

  4. Chapter heading with "moeurs" left untranslated.
     - The unit is title-like (paragraph_index 0 of a chapter, or contains a chapter heading).
     - The rendering contains "moeurs" verbatim instead of "mores".

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
  - The rendering contains an inline translator's note (route to "rewrite" instead).

PERIOD VOCABULARY — these terms must never appear in an "accept" tier, even if the rendering looks correct:
  sauvages, sauvage, nègres, moeurs, mœurs, commune, buffles, patrie, liberté,
  néant, élan, cité, peuplade, métis

UNTRANSLATED TERMS — TERM flag for these, preserved-italicized in rendering, is candidate for "accept":
  raison d'État, Ancien Régime, bourgeois, bourgeoisie, arrondissement

ESTABLISHED TERM RENDERINGS — TERM flag where rendering uses the right-hand value verbatim is a candidate for "accept" (selected entries; rendering must match exactly):
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

SPELLING STANDARDIZATIONS — READING flag where rendering applied the standard form is candidate for "accept":
  - Meaupou → Maupeou
  - Hecwelder → Heckewelder
  - Blakstone → Blackstone
  - Francklin → Franklin

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

interface CorpusAdapter {
  readonly slug: 'federalist' | 'tocqueville';
  readonly rubric: string;
  readonly rubricVersion: string;
  readFileVersion(): { version: string | null; sha: string | null };
  writeFileVersion(version: string, sha: string): void;
  buildCandidates(includeAlreadyTriaged: boolean): Candidate[];
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
    buildCandidates: (includeAlreadyTriaged) => {
      const out: Candidate[] = [];
      for (const paper of ann.papers) {
        const item = itemByNumber.get(paper.paper_number);
        if (!item) continue;
        for (const para of paper.paragraphs) {
          if (para.flags.length === 0) continue;
          if (para.editorial_status !== null) continue;
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
    buildCandidates: (includeAlreadyTriaged) => {
      const out: Candidate[] = [];
      for (const annItem of ann.items) {
        const item = itemById.get(annItem.item_id);
        if (!item) continue;

        for (const para of annItem.paragraphs) {
          if (para.flags.length === 0) continue;
          if (para.editorial_status !== null) continue;
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
          if (fn.editorial_status !== null) continue;
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
  parseFailures: number;
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
): Promise<ClassificationResult> {
  let parseFailures = 0;
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
      return { tier: parsed.tier, rationale: parsed.rationale, rawOutput: raw, parseFailures };
    }
    parseFailures++;
  }

  // Both attempts failed JSON parsing. Default to manual; record the failure
  // in the rationale so the operator can investigate.
  return {
    tier: 'manual',
    rationale: '(classifier output unparseable after retry; defaulted to manual)',
    rawOutput: lastRaw,
    parseFailures,
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
};

function parseArgs(argv: string[]): Args {
  let corpus: 'federalist' | 'tocqueville' | null = null;
  let dryRun = false;
  let limit: number | null = null;
  let force = false;

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
    } else {
      throw new Error(`unknown argument: ${arg}`);
    }
  }

  if (corpus === null) {
    throw new Error("--corpus is required (one of: 'federalist', 'tocqueville')");
  }
  return { corpus, dryRun, limit, force };
}

// ---------------------------------------------------------------------------
// Main loop.
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
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

  const includeAlreadyTriaged = decision.kind === 'reclassify_all' || args.force;
  let candidates = adapter.buildCandidates(includeAlreadyTriaged);

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

  const counts: Record<Tier, number> = { accept: 0, rewrite: 0, manual: 0 };
  let parseFailures = 0;
  let inputTokensTotal = 0;
  let outputTokensTotal = 0;
  let cacheReadTotal = 0;
  let cacheWriteTotal = 0;

  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];
    const userMessage = buildUserMessage(c, adapter.slug);
    let result: ClassificationResult;
    try {
      result = await classify(client, systemPrompt, userMessage);
    } catch (e) {
      console.error(`[triage] API error on ${c.locator}: ${(e as Error).message}`);
      console.error('[triage] stopping run; existing writes are durable. Re-run to resume.');
      throw e;
    }

    c.apply(result.tier, result.rationale, ts());
    counts[result.tier]++;
    parseFailures += result.parseFailures;

    if ((i + 1) % 25 === 0 || i + 1 === candidates.length) {
      console.log(
        `[triage] ${i + 1}/${candidates.length}  accept=${counts.accept} rewrite=${counts.rewrite} manual=${counts.manual}  parse_fail=${parseFailures}`,
      );
    }
  }

  console.log('');
  console.log('=== TRIAGE SUMMARY ===');
  console.log(`  corpus:           ${adapter.slug}`);
  console.log(`  rubric:           ${adapter.rubricVersion}`);
  console.log(`  candidates:       ${candidates.length}`);
  console.log(`  accept:           ${counts.accept}`);
  console.log(`  rewrite:          ${counts.rewrite}`);
  console.log(`  manual:           ${counts.manual}`);
  console.log(`  parse failures:   ${parseFailures} (counted; classified as manual)`);
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
