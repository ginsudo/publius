// Phase 3.1 plain-English Batch API generator.
//
// Modes:
//   --sample : gate-1 run of 10 hand-picked paragraphs across the coverage
//              matrix (Hamilton/Madison/Jay, undisputed/disputed/joint, with
//              and without footnote markers). Writes a side-by-side review
//              file at prompts/eval/plain-english-sample-results.md.
//              Does NOT mutate data/federalist/federalist.json.
//   (default): gate-2 full run of every paragraph in every paper whose
//              plain_english field is currently null. Writes results to
//              .batch-results.json sidecar; corpus write requires --apply.
//   --apply  : read .batch-results.json sidecar (produced by a prior fetch)
//              and write rendered paragraphs back into federalist.json.
//   --retry <custom_id> : re-run a single paragraph synchronously (Messages
//              API, not Batch) and replace its entry in the sidecar. Used
//              for one-off corrections (e.g., after a corpus text fix).
//              Requires the entry to already exist in the sidecar.
//
// Resume: if data/federalist/.batch-state.json exists, the script resumes
// polling that batch instead of submitting a new one. Use --resume to be
// explicit. Delete the state file (or pass --reset) to start fresh.
//
// Run:
//   node --experimental-strip-types scripts/generate-plain-english.ts --sample
//   node --experimental-strip-types scripts/generate-plain-english.ts
//   node --experimental-strip-types scripts/generate-plain-english.ts --apply
//   node --experimental-strip-types scripts/generate-plain-english.ts --retry federalist-57-para-16
//
// See prompts/plain-english-system.md for the system prompt and design notes.

import { readFileSync, writeFileSync, existsSync, renameSync, unlinkSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import Anthropic from '@anthropic-ai/sdk';
import { loadEnv, REPO_ROOT, FEDERALIST_PATH } from '../data/eval/lib.ts';

// ---------------------------------------------------------------------------
// Paths and constants
// ---------------------------------------------------------------------------

const HERE = dirname(fileURLToPath(import.meta.url));
const PROMPT_PATH = resolve(REPO_ROOT, 'prompts', 'plain-english-system.md');
const STATE_PATH = resolve(REPO_ROOT, 'data', 'federalist', '.batch-state.json');
const BATCH_RESULTS_PATH = resolve(REPO_ROOT, 'data', 'federalist', '.batch-results.json');
const SAMPLE_RESULTS_PATH = resolve(REPO_ROOT, 'prompts', 'eval', 'plain-english-sample-results.md');
const ANNOTATIONS_PATH = resolve(REPO_ROOT, 'data', 'federalist', 'federalist-annotations.json');
const PROMPT_VERSION = 'v0.2';

const MODEL = 'claude-sonnet-4-6';
const MAX_TOKENS = 2000;
const POLL_INTERVAL_MS = 60_000;
const SALUTATION = 'To the People of the State of New York:';

// Sentinel for the "render-only-the-target" boundary marker the input
// instruction puts around the target paragraph; mirrored in the user-message
// builder.
const TARGET_OPEN = '<<<TARGET_PARAGRAPH>>>';
const TARGET_CLOSE = '<<<END_TARGET_PARAGRAPH>>>';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Correction = {
  paragraph_index: number;
  original_text: string;
  corrected_text: string;
  source: string;
  rationale: string;
  corrected_at: string;
};

type FederalistItem = {
  id: string;
  corpus: 'federalist';
  title: string;
  authors: string[];
  date: string;
  language: string;
  paragraphs: string[];
  footnotes: { marker: string; paragraphs: string[] }[];
  plain_english: string[] | null;
  constitutional_section: string | null;
  topic_tags: string[];
  federalist: {
    number: number;
    authorship_status: 'undisputed' | 'disputed' | 'joint';
    authorship_note: string | null;
    publication: { venue: string; raw_dateline: string };
  };
  corrections?: Correction[];
};

type Corpus = {
  corpus: 'federalist';
  source: Record<string, unknown>;
  count: number;
  items: FederalistItem[];
};

type CustomId = `federalist-${number}-para-${number}`;

type BatchState = {
  batch_id: string;
  mode: 'sample' | 'full';
  submitted_at: string;
  request_count: number;
  custom_ids: CustomId[];
};

type FlagKind = 'AMBIGUOUS' | 'WORD' | 'RHETORIC';

type Flag = { kind: FlagKind; note: string };

type RenderResult = {
  rendered: string;
  flags: Flag[];
  warnings: string[];
};

// Annotations layer (Phase 3.2). Stored at data/federalist/federalist-annotations.json.
// Sits alongside the corpus, not inside it; pattern carries forward to Tocqueville
// and SCOTUS annotations once those slices land.

type EditorialStatus = null | 'accepted' | 'edited' | 'flagged_for_rewrite';

type FlagEntry = {
  kind: FlagKind;
  // The quoted term/phrase the flag is about. v0.2 prompt formats WORD/RHETORIC
  // flag bodies as `"term" — note`; AMBIGUOUS flags often describe a passage
  // without quoting a single term, in which case term is null and the entire
  // body lives in `note`.
  term: string | null;
  note: string;
};

type ParagraphAnnotation = {
  paragraph_index: number;
  // Salutations bypass the API; bypassed:true marks them so a reviewer
  // sees the bypass discipline explicitly rather than inferring it from a gap.
  bypassed?: true;
  flags: FlagEntry[];
  editorial_status: EditorialStatus;
  editorial_note: string | null;
};

type PaperAnnotations = {
  paper_number: number;
  paragraphs: ParagraphAnnotation[];
};

type FederalistAnnotations = {
  corpus: 'federalist';
  generated_at: string;
  prompt_version: string;
  prompt_sha256: string;
  papers: PaperAnnotations[];
};

// ---------------------------------------------------------------------------
// CLI parsing
// ---------------------------------------------------------------------------

const argv = process.argv.slice(2);
const FLAGS = new Set(argv);
const isSample = FLAGS.has('--sample');
const isResume = FLAGS.has('--resume');
const isReset = FLAGS.has('--reset');
// --apply: read .batch-results.json sidecar (produced by a prior fetch) and
// write rendered paragraphs back into federalist.json. Without this flag,
// full-mode runs stop after writing the sidecar; the corpus is not mutated.
const isApply = FLAGS.has('--apply');
// --merge-annotations: when --apply finds an existing federalist-annotations.json,
// merge instead of aborting. Editorial state (editorial_status, editorial_note)
// is preserved per (paper, paragraph); flags and the file-level metadata are
// replaced by the new run.
const isMergeAnnotations = FLAGS.has('--merge-annotations');
// --retry <custom_id>: re-run a single paragraph synchronously and update
// its sidecar entry in place. Independent of batch state.
const retryIdx = argv.indexOf('--retry');
const retryCustomIdArg: string | null =
  retryIdx >= 0 && retryIdx + 1 < argv.length ? argv[retryIdx + 1] : null;
const isRetry = retryIdx >= 0;

if (isRetry && !retryCustomIdArg) {
  console.error('[main] --retry requires a custom_id argument: --retry federalist-N-para-I');
  process.exit(2);
}

if (isReset && existsSync(STATE_PATH)) {
  unlinkSync(STATE_PATH);
  console.log(`[reset] removed ${STATE_PATH}`);
}

// ---------------------------------------------------------------------------
// Sample selection (gate-1)
// ---------------------------------------------------------------------------
//
// Hand-picked across the coverage matrix:
//   - Hamilton (undisputed): Fed 1 opening, Fed 1 closing-with-marker,
//     Fed 70 opening, Fed 78 judicial review, Fed 84 no-bill-of-rights
//   - Madison (undisputed): Fed 10 faction, Fed 39 republic
//   - Madison (disputed twelve): Fed 51 ambition
//   - Jay (undisputed): Fed 2 opening
//   - Joint (Madison + Hamilton): Fed 18 early substantive paragraph
//
// Indices are *paragraphs[]* indices in the parsed corpus, NOT 1-based
// paragraph numbers from the source. They are resolved at runtime by
// substring matching on a unique opening phrase from the target paragraph;
// this keeps the sample stable if paragraph indices ever shift.

const SAMPLE_KEYS: { number: number; opening: string; note: string }[] = [
  { number: 1, opening: 'AFTER an unequivocal experience', note: 'Hamilton (undisputed) — Fed 1 canonical opening' },
  { number: 1, opening: 'It may perhaps be thought superfluous', note: 'Hamilton (undisputed) — Fed 1 closing paragraph WITH inline footnote marker (1)' },
  { number: 2, opening: 'WHEN the people of America reflect', note: 'Jay (undisputed) — Fed 2 opening substantive paragraph' },
  { number: 10, opening: 'By a faction, I understand', note: 'Madison (undisputed) — Fed 10 faction definition' },
  { number: 18, opening: 'AMONG the confederacies of antiquity', note: 'Madison + Hamilton (joint) — Fed 18 early substantive paragraph' },
  { number: 39, opening: 'If we resort for a criterion', note: 'Madison (undisputed) — Fed 39 republic definition' },
  { number: 51, opening: 'But the great security against', note: 'Madison (disputed twelve) — Fed 51 "ambition must be made to counteract ambition"' },
  { number: 70, opening: 'THERE is an idea, which is not without its advocates', note: 'Hamilton (undisputed) — Fed 70 opening on energy in the executive' },
  { number: 78, opening: 'The complete independence of the courts of justice', note: 'Hamilton (undisputed) — Fed 78 judicial review reasoning' },
  { number: 84, opening: 'The most considerable of the remaining objections', note: 'Hamilton (undisputed) — Fed 84 no-bill-of-rights opening' },
];

// ---------------------------------------------------------------------------
// Prompt loading (extracts content between `## The prompt` and the first
// `---` horizontal rule, matching prompts/system-prompt.md convention).
// ---------------------------------------------------------------------------

function loadSystemPrompt(): string {
  const raw = readFileSync(PROMPT_PATH, 'utf8');
  const start = raw.indexOf('## The prompt');
  if (start < 0) throw new Error(`marker "## The prompt" not found in ${PROMPT_PATH}`);
  // Skip past the `## The prompt (vN.N)` heading line itself.
  const afterHeading = raw.indexOf('\n', start) + 1;
  const end = raw.indexOf('\n---\n', afterHeading);
  if (end < 0) throw new Error(`closing horizontal rule not found in ${PROMPT_PATH}`);
  return raw.slice(afterHeading, end).trim();
}

// ---------------------------------------------------------------------------
// Custom-ID encoding/decoding
// ---------------------------------------------------------------------------

function makeCustomId(paperNumber: number, paragraphIndex: number): CustomId {
  // Anthropic Batch API requires custom_id to match ^[a-zA-Z0-9_-]{1,64}$
  return `federalist-${paperNumber}-para-${paragraphIndex}` as CustomId;
}

function parseCustomId(customId: string): { paperNumber: number; paragraphIndex: number } {
  const m = customId.match(/^federalist-(\d+)-para-(\d+)$/);
  if (!m) throw new Error(`unparseable custom_id: ${customId}`);
  return { paperNumber: Number(m[1]), paragraphIndex: Number(m[2]) };
}

// ---------------------------------------------------------------------------
// User-message builder (per paragraph)
// ---------------------------------------------------------------------------

function buildUserMessage(item: FederalistItem, paragraphIndex: number): string {
  const prior = paragraphIndex > 0 ? item.paragraphs[paragraphIndex - 1] : null;
  const target = item.paragraphs[paragraphIndex];
  const next = paragraphIndex < item.paragraphs.length - 1 ? item.paragraphs[paragraphIndex + 1] : null;

  const fed = item.federalist;
  const authorshipLine =
    fed.authorship_status === 'undisputed'
      ? `Authors: ${item.authors.join(', ')} (undisputed authorship)`
      : fed.authorship_status === 'disputed'
        ? `Authors: ${item.authors.join(', ')} (one of the disputed twelve; modern attribution per Mosteller and Wallace 1964; the dispute is metadata, not a rendering hint — render the paragraph as the text on the page, not as commentary on authorship)`
        : `Authors: ${item.authors.join(', ')} (joint authorship; PG byline "${item.authors[0]}, with ${item.authors.slice(1).join(', ')}"; the joint nature is metadata, not a rendering hint — render the paragraph as the text on the page, not as commentary on authorship)`;

  const lines: string[] = [
    `Paper: Federalist No. ${fed.number} — "${item.title}"`,
    authorshipLine,
    `First published: ${item.date} (${fed.publication.venue})`,
    '',
    'CONTEXT (read-only — do NOT render):',
  ];

  if (prior !== null) {
    lines.push('--- prior paragraph ---');
    lines.push(prior);
    lines.push('');
  } else {
    lines.push('(target paragraph is the first paragraph of the paper)');
    lines.push('');
  }

  if (next !== null) {
    lines.push('--- next paragraph ---');
    lines.push(next);
    lines.push('');
  } else {
    lines.push('(target paragraph is the last paragraph of the paper)');
    lines.push('');
  }

  lines.push('TARGET PARAGRAPH (render this one only):');
  lines.push(TARGET_OPEN);
  lines.push(target);
  lines.push(TARGET_CLOSE);
  lines.push('');
  lines.push('Return only the rendered paragraph (with any [AMBIGUOUS: ...], [WORD: ...], or [RHETORIC: ...] flags warranted by the system prompt). No preamble, no commentary, no quotation marks around the output.');

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Postprocessing: strip preamble, split flags (AMBIGUOUS/WORD/RHETORIC),
// detect lost footnote markers, normalize whitespace.
// ---------------------------------------------------------------------------

const FOOTNOTE_MARKER_RE = /\((?:\d+|EN|TN-[A-Z])\)/g;

// Matches any of the three flag kinds the v0.2 prompt may emit.
// Content runs from after the kind+colon to the next ']' (no nesting expected).
const FLAG_RE = /\[(AMBIGUOUS|WORD|RHETORIC):\s*([^\]]+)\]/g;

function postprocess(modelOutput: string, originalTarget: string): RenderResult {
  let text = modelOutput.trim();
  const warnings: string[] = [];

  // Strip surrounding quotes if the model wrapped the rendering.
  if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith('\u201c') && text.endsWith('\u201d'))) {
    text = text.slice(1, -1).trim();
    warnings.push('stripped surrounding quotes');
  }

  // Strip a "Here is the..." style preamble line if it leaked through.
  const preambleRe = /^(Here (?:is|are)|Modernized|Rendered|Plain[- ]English)[^\n]{0,120}:\s*\n/i;
  if (preambleRe.test(text)) {
    text = text.replace(preambleRe, '').trim();
    warnings.push('stripped leading preamble line');
  }

  // Extract all [AMBIGUOUS:...] / [WORD:...] / [RHETORIC:...] flags from the
  // text, regardless of position. The v0.2 prompt asks for them appended to
  // the paragraph, but a paragraph can carry multiple flags (e.g. several
  // word-drift cases) and they may end up inline. Strip all of them and
  // collect into a sidecar flags array; the rendered paragraph stays clean.
  const flags: Flag[] = [];
  text = text.replace(FLAG_RE, (_full, kind: string, note: string) => {
    flags.push({ kind: kind as FlagKind, note: note.trim() });
    return '';
  });
  // Tidy the spaces left behind: collapse runs of blank lines, trim trailing
  // whitespace on each line, and strip leading/trailing whitespace overall.
  text = text
    .split('\n')
    .map(l => l.replace(/[ \t]+$/, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();

  // Marker preservation check: every (N) / (EN) / (TN-X) marker in the
  // original must appear in the rendering. Order-independent multiset check.
  const origMarkers = (originalTarget.match(FOOTNOTE_MARKER_RE) || []).slice().sort();
  const rendMarkers = (text.match(FOOTNOTE_MARKER_RE) || []).slice().sort();
  if (origMarkers.join('|') !== rendMarkers.join('|')) {
    warnings.push(
      `footnote marker mismatch — original: [${origMarkers.join(', ') || 'none'}], rendered: [${rendMarkers.join(', ') || 'none'}]`,
    );
  }

  // Suspicious-preamble heuristic (catches preambles the regex missed).
  const firstWord = text.split(/\s+/)[0]?.toLowerCase() ?? '';
  if (['here', "here's", 'modernized', 'rendered', 'translation', 'note:'].includes(firstWord)) {
    warnings.push(`suspicious opening word "${firstWord}" — possible preamble leak`);
  }

  return { rendered: text, flags, warnings };
}

// ---------------------------------------------------------------------------
// Build the request list
// ---------------------------------------------------------------------------

type RequestSpec = {
  custom_id: CustomId;
  paperNumber: number;
  paragraphIndex: number;
  target: string;
};

function findParagraphIndex(item: FederalistItem, opening: string): number {
  for (let i = 0; i < item.paragraphs.length; i++) {
    if (item.paragraphs[i].startsWith(opening)) return i;
  }
  throw new Error(`paragraph starting with "${opening}" not found in Federalist ${item.federalist.number}`);
}

function buildSampleRequests(corpus: Corpus): RequestSpec[] {
  const byNumber = new Map(corpus.items.map(it => [it.federalist.number, it]));
  const out: RequestSpec[] = [];
  for (const key of SAMPLE_KEYS) {
    const item = byNumber.get(key.number);
    if (!item) throw new Error(`Federalist ${key.number} not found in corpus`);
    const idx = findParagraphIndex(item, key.opening);
    out.push({
      custom_id: makeCustomId(key.number, idx),
      paperNumber: key.number,
      paragraphIndex: idx,
      target: item.paragraphs[idx],
    });
  }
  return out;
}

function buildFullRequests(corpus: Corpus): RequestSpec[] {
  // No skip on already-populated plain_english — default mode regenerates from
  // scratch every invocation. Resumability for an in-flight batch is handled
  // via .batch-state.json; the previous "skip populated items" optimization
  // dated to Phase 3.1 when the corpus was empty and is now misleading.
  const out: RequestSpec[] = [];
  for (const item of corpus.items) {
    for (let i = 0; i < item.paragraphs.length; i++) {
      const para = item.paragraphs[i];
      if (para === SALUTATION) continue; // bypass — written through verbatim at write time
      out.push({
        custom_id: makeCustomId(item.federalist.number, i),
        paperNumber: item.federalist.number,
        paragraphIndex: i,
        target: para,
      });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// State file (resume support)
// ---------------------------------------------------------------------------

function readState(): BatchState | null {
  if (!existsSync(STATE_PATH)) return null;
  return JSON.parse(readFileSync(STATE_PATH, 'utf8')) as BatchState;
}

function writeState(state: BatchState): void {
  mkdirSync(dirname(STATE_PATH), { recursive: true });
  writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
}

function clearState(): void {
  if (existsSync(STATE_PATH)) unlinkSync(STATE_PATH);
}

// ---------------------------------------------------------------------------
// Submit + poll
// ---------------------------------------------------------------------------

async function submitBatch(
  client: Anthropic,
  systemPrompt: string,
  corpus: Corpus,
  requests: RequestSpec[],
): Promise<BatchState> {
  console.log(`[submit] preparing ${requests.length} requests…`);
  const byNumber = new Map(corpus.items.map(it => [it.federalist.number, it]));
  const apiRequests = requests.map(req => {
    const item = byNumber.get(req.paperNumber)!;
    return {
      custom_id: req.custom_id,
      params: {
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: systemPrompt,
        messages: [{ role: 'user' as const, content: buildUserMessage(item, req.paragraphIndex) }],
      },
    };
  });

  const batch = await client.messages.batches.create({ requests: apiRequests });
  console.log(`[submit] batch created: ${batch.id} (${batch.processing_status})`);
  const state: BatchState = {
    batch_id: batch.id,
    mode: isSample ? 'sample' : 'full',
    submitted_at: new Date().toISOString(),
    request_count: requests.length,
    custom_ids: requests.map(r => r.custom_id),
  };
  writeState(state);
  console.log(`[submit] state written to ${STATE_PATH}`);
  return state;
}

async function pollUntilEnded(client: Anthropic, batchId: string): Promise<void> {
  while (true) {
    const batch = await client.messages.batches.retrieve(batchId);
    const c = batch.request_counts;
    console.log(
      `[poll ${new Date().toISOString().slice(11, 19)}] status=${batch.processing_status} processing=${c.processing} succeeded=${c.succeeded} errored=${c.errored} canceled=${c.canceled} expired=${c.expired}`,
    );
    if (batch.processing_status === 'ended') return;
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
  }
}

async function fetchResults(client: Anthropic, batchId: string): Promise<Map<string, string | { error: string }>> {
  const out = new Map<string, string | { error: string }>();
  const stream = await client.messages.batches.results(batchId);
  for await (const entry of stream) {
    const cid = entry.custom_id;
    const r = entry.result;
    if (r.type === 'succeeded') {
      const text = r.message.content
        .filter(b => b.type === 'text')
        .map(b => (b as { type: 'text'; text: string }).text)
        .join('');
      out.set(cid, text);
    } else if (r.type === 'errored') {
      out.set(cid, { error: `errored: ${JSON.stringify(r.error)}` });
    } else if (r.type === 'canceled') {
      out.set(cid, { error: 'canceled' });
    } else if (r.type === 'expired') {
      out.set(cid, { error: 'expired' });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Sample-mode review file
// ---------------------------------------------------------------------------

function writeSampleReviewFile(
  corpus: Corpus,
  requests: RequestSpec[],
  results: Map<string, string | { error: string }>,
): void {
  const byNumber = new Map(corpus.items.map(it => [it.federalist.number, it]));
  const lines: string[] = [
    '# Plain-English gate-1 sample results',
    '',
    `Generated: ${new Date().toISOString()}`,
    `Model: ${MODEL}`,
    `System prompt: prompts/plain-english-system.md (v0.1)`,
    `Sample size: ${requests.length} paragraphs`,
    '',
    'Each section shows: coverage note, original paragraph, rendered paragraph,',
    'any postprocess warnings, and any flags the model emitted (AMBIGUOUS / WORD / RHETORIC).',
    '',
    '**Owner review checklist (per project plan §3.2):**',
    '',
    '- [ ] Every argument and logical step preserved',
    '- [ ] Every distinction preserved (esp. multi-noun lists like "power, emolument, and consequence")',
    '- [ ] No editorialization toward any interpretive school',
    '- [ ] Term-of-art preservation (republic, faction, Union, confederacy, etc.)',
    '- [ ] Footnote markers (1), (EN), etc. preserved verbatim — flagged automatically below',
    '- [ ] No metadata bleed (the disputed/joint authorship status of Fed 18 and Fed 51 must NOT appear in the rendering)',
    '- [ ] Hedges preserved ("may perhaps", "would seem", etc.)',
    '- [ ] Voice/register match (Hamilton pugnacious, Madison analytical, Jay declarative)',
    '- [ ] WORD flags catch real semantic drift (not vocabulary that is merely archaic)',
    '- [ ] RHETORIC flags catch passages where rhetorical edge would be lost in modernization',
    '- [ ] AMBIGUOUS flags catch genuine semantic ambiguity (not merely difficult prose)',
    '',
    '---',
    '',
  ];

  for (const req of requests) {
    const item = byNumber.get(req.paperNumber)!;
    const sampleKey = SAMPLE_KEYS.find(k => k.number === req.paperNumber && item.paragraphs[req.paragraphIndex].startsWith(k.opening));
    const note = sampleKey?.note ?? '';
    const result = results.get(req.custom_id);

    lines.push(`## Federalist ${req.paperNumber}, paragraph index ${req.paragraphIndex}`);
    lines.push('');
    lines.push(`**Coverage:** ${note}`);
    lines.push(`**Authorship status (metadata):** ${item.federalist.authorship_status}`);
    lines.push(`**Authors:** ${item.authors.join(', ')}`);
    lines.push('');
    lines.push('### Original');
    lines.push('');
    lines.push('> ' + req.target.replace(/\n/g, '\n> '));
    lines.push('');

    if (typeof result === 'object' && result !== null && 'error' in result) {
      lines.push('### Rendered');
      lines.push('');
      lines.push(`**ERROR:** ${result.error}`);
      lines.push('');
    } else if (typeof result === 'string') {
      const pp = postprocess(result, req.target);
      lines.push('### Rendered');
      lines.push('');
      lines.push('> ' + pp.rendered.replace(/\n/g, '\n> '));
      lines.push('');
      // Sidecar flags channel — grouped by kind for the editorial pass.
      const byKind: Record<FlagKind, string[]> = { AMBIGUOUS: [], WORD: [], RHETORIC: [] };
      for (const f of pp.flags) byKind[f.kind].push(f.note);
      if (pp.flags.length === 0) {
        lines.push('**Flags:** none');
        lines.push('');
      } else {
        lines.push('**Flags:**');
        lines.push('');
        for (const kind of ['AMBIGUOUS', 'WORD', 'RHETORIC'] as FlagKind[]) {
          if (byKind[kind].length === 0) continue;
          lines.push(`*${kind}* (${byKind[kind].length})`);
          for (const note of byKind[kind]) lines.push(`- ${note}`);
          lines.push('');
        }
      }
      if (pp.warnings.length) {
        lines.push('**Postprocess warnings:**');
        for (const w of pp.warnings) lines.push(`- ${w}`);
        lines.push('');
      } else {
        lines.push('**Postprocess warnings:** none');
        lines.push('');
      }
      // Show the raw model output if it differs from the postprocessed output,
      // so the editor can see what was stripped.
      if (result.trim() !== pp.rendered) {
        lines.push('<details><summary>Raw model output (before postprocess)</summary>');
        lines.push('');
        lines.push('```');
        lines.push(result);
        lines.push('```');
        lines.push('');
        lines.push('</details>');
        lines.push('');
      }
    } else {
      lines.push('### Rendered');
      lines.push('');
      lines.push('**MISSING:** no result returned for this custom_id.');
      lines.push('');
    }

    lines.push('---');
    lines.push('');
  }

  mkdirSync(dirname(SAMPLE_RESULTS_PATH), { recursive: true });
  writeFileSync(SAMPLE_RESULTS_PATH, lines.join('\n'));
  console.log(`[sample] wrote ${SAMPLE_RESULTS_PATH}`);
}

// ---------------------------------------------------------------------------
// Postprocess pass over the entire batch
// ---------------------------------------------------------------------------

type ProcessedBatch = {
  // Map keyed by custom_id; only contains entries for non-salutation paragraphs.
  renderings: Map<string, RenderResult>;
  failures: string[];
  warnings: string[];
};

function processBatch(
  corpus: Corpus,
  results: Map<string, string | { error: string }>,
): ProcessedBatch {
  const renderings = new Map<string, RenderResult>();
  const failures: string[] = [];
  const warnings: string[] = [];
  for (const item of corpus.items) {
    for (let i = 0; i < item.paragraphs.length; i++) {
      const para = item.paragraphs[i];
      if (para === SALUTATION) continue; // bypassed — never submitted, not in sidecar
      const cid = makeCustomId(item.federalist.number, i);
      const result = results.get(cid);
      if (typeof result === 'object' && result !== null && 'error' in result) {
        failures.push(`${cid}: ${result.error}`);
        continue;
      }
      if (typeof result !== 'string') {
        failures.push(`${cid}: missing result`);
        continue;
      }
      const pp = postprocess(result, para);
      if (pp.warnings.length) warnings.push(`${cid}: ${pp.warnings.join('; ')}`);
      renderings.set(cid, pp);
    }
  }
  return { renderings, failures, warnings };
}

// ---------------------------------------------------------------------------
// Full-mode corpus write (plain_english only)
// ---------------------------------------------------------------------------

function writePlainEnglish(corpus: Corpus, renderings: Map<string, RenderResult>): void {
  for (const item of corpus.items) {
    const out: string[] = new Array(item.paragraphs.length);
    for (let i = 0; i < item.paragraphs.length; i++) {
      const para = item.paragraphs[i];
      if (para === SALUTATION) {
        out[i] = SALUTATION;
        continue;
      }
      const cid = makeCustomId(item.federalist.number, i);
      const r = renderings.get(cid);
      if (!r) {
        // Defensive: failures are caught before this function is reached.
        throw new Error(`writePlainEnglish: missing rendering for ${cid}`);
      }
      out[i] = r.rendered;
    }
    if (out.length !== item.paragraphs.length) {
      throw new Error(
        `federalist:${item.federalist.number}: plain_english.length ${out.length} !== paragraphs.length ${item.paragraphs.length}`,
      );
    }
    item.plain_english = out;
  }

  const tmpPath = FEDERALIST_PATH + '.tmp';
  writeFileSync(tmpPath, JSON.stringify(corpus, null, 2) + '\n');
  renameSync(tmpPath, FEDERALIST_PATH);
  console.log(`[plain-english] atomic rename complete: ${FEDERALIST_PATH}`);
}

// ---------------------------------------------------------------------------
// Annotations build + write (Phase 3.2)
// ---------------------------------------------------------------------------

// Parse the body of a flag note into (term, note). v0.2 prompt formats
// WORD/RHETORIC bodies as `"term" — note`; AMBIGUOUS bodies often have no
// quoted term. Handles both straight quotes and curly quotes, and both
// em-dash and hyphen separators.
const FLAG_BODY_RE = /^\s*["“]([^"”]+)["”]\s*[—–\-]\s*([\s\S]*)$/;

function parseFlagBody(body: string): { term: string | null; note: string } {
  const m = body.match(FLAG_BODY_RE);
  if (m) {
    return { term: m[1].trim(), note: m[2].trim() };
  }
  return { term: null, note: body.trim() };
}

function buildAnnotations(
  corpus: Corpus,
  renderings: Map<string, RenderResult>,
  promptSha256: string,
): FederalistAnnotations {
  const papers: PaperAnnotations[] = [];
  for (const item of corpus.items) {
    const paragraphs: ParagraphAnnotation[] = [];
    for (let i = 0; i < item.paragraphs.length; i++) {
      const para = item.paragraphs[i];
      if (para === SALUTATION) {
        paragraphs.push({
          paragraph_index: i,
          bypassed: true,
          flags: [],
          editorial_status: null,
          editorial_note: null,
        });
        continue;
      }
      const cid = makeCustomId(item.federalist.number, i);
      const r = renderings.get(cid);
      if (!r) {
        throw new Error(`buildAnnotations: missing rendering for ${cid}`);
      }
      const flags: FlagEntry[] = r.flags.map(f => {
        const parsed = parseFlagBody(f.note);
        return { kind: f.kind, term: parsed.term, note: parsed.note };
      });
      paragraphs.push({
        paragraph_index: i,
        flags,
        editorial_status: null,
        editorial_note: null,
      });
    }
    papers.push({ paper_number: item.federalist.number, paragraphs });
  }
  return {
    corpus: 'federalist',
    generated_at: new Date().toISOString(),
    prompt_version: PROMPT_VERSION,
    prompt_sha256: promptSha256,
    papers,
  };
}

function writeAnnotationsFile(ann: FederalistAnnotations, mergeAnnotations: boolean): void {
  if (existsSync(ANNOTATIONS_PATH)) {
    if (!mergeAnnotations) {
      throw new Error(
        `Refusing to overwrite existing ${ANNOTATIONS_PATH}.\n` +
          `  - To regenerate from scratch (discarding any editorial_status/editorial_note values), delete the file and re-run --apply.\n` +
          `  - To preserve editorial_status and editorial_note while replacing flags, re-run with --apply --merge-annotations.`,
      );
    }
    // Merge: preserve editorial_status and editorial_note from the existing
    // file per (paper_number, paragraph_index). Flags and file-level metadata
    // (generated_at, prompt_sha256, prompt_version) come from the new run.
    const existing = JSON.parse(readFileSync(ANNOTATIONS_PATH, 'utf8')) as FederalistAnnotations;
    const editorialMap = new Map<string, { status: EditorialStatus; note: string | null }>();
    for (const p of existing.papers) {
      for (const para of p.paragraphs) {
        if (para.editorial_status !== null || para.editorial_note !== null) {
          const key = `${p.paper_number}-${para.paragraph_index}`;
          editorialMap.set(key, { status: para.editorial_status, note: para.editorial_note });
        }
      }
    }
    let merged = 0;
    for (const p of ann.papers) {
      for (const para of p.paragraphs) {
        const key = `${p.paper_number}-${para.paragraph_index}`;
        const prev = editorialMap.get(key);
        if (prev) {
          para.editorial_status = prev.status;
          para.editorial_note = prev.note;
          merged++;
        }
      }
    }
    console.log(`[annotations] merge: preserved ${merged} editorial-state entries from existing file`);
  }
  const tmp = ANNOTATIONS_PATH + '.tmp';
  writeFileSync(tmp, JSON.stringify(ann, null, 2) + '\n');
  renameSync(tmp, ANNOTATIONS_PATH);
  console.log(`[annotations] atomic rename complete: ${ANNOTATIONS_PATH}`);
}

function summarize(ann: FederalistAnnotations): void {
  let totalParagraphs = 0;
  let totalAnnotated = 0;
  let totalSalutations = 0;
  const flagCounts: Record<FlagKind, number> = { AMBIGUOUS: 0, WORD: 0, RHETORIC: 0 };
  const papersWithZeroFlags: number[] = [];
  for (const p of ann.papers) {
    let paperFlagCount = 0;
    for (const para of p.paragraphs) {
      totalParagraphs++;
      if (para.bypassed) {
        totalSalutations++;
        continue;
      }
      totalAnnotated++;
      for (const f of para.flags) {
        flagCounts[f.kind]++;
        paperFlagCount++;
      }
    }
    if (paperFlagCount === 0) papersWithZeroFlags.push(p.paper_number);
  }
  const totalFlags = flagCounts.AMBIGUOUS + flagCounts.WORD + flagCounts.RHETORIC;
  console.log('');
  console.log('=== ANNOTATIONS SUMMARY ===');
  console.log(`Total paragraphs: ${totalParagraphs}`);
  console.log(`  Annotated (non-salutation): ${totalAnnotated}`);
  console.log(`  Salutations (bypassed):     ${totalSalutations}`);
  console.log('');
  console.log('Flag counts by kind:');
  console.log(`  AMBIGUOUS: ${flagCounts.AMBIGUOUS}`);
  console.log(`  WORD:      ${flagCounts.WORD}`);
  console.log(`  RHETORIC:  ${flagCounts.RHETORIC}`);
  console.log(`  TOTAL:     ${totalFlags}`);
  console.log('');
  if (papersWithZeroFlags.length > 0) {
    console.log(
      `Papers with zero flags (${papersWithZeroFlags.length}): ${papersWithZeroFlags.join(', ')}`,
    );
  } else {
    console.log('Papers with zero flags: none');
  }
  console.log('===========================');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function dumpResultsSidecar(results: Map<string, string | { error: string }>): void {
  // Persist results so a subsequent --apply invocation can write them back
  // without reaching the API again. Stored as a plain object keyed by
  // custom_id; values are either the rendered text (string) or an error
  // descriptor.
  const obj: Record<string, string | { error: string }> = {};
  for (const [k, v] of results) obj[k] = v;
  writeFileSync(BATCH_RESULTS_PATH, JSON.stringify(obj, null, 2));
  console.log(`[fetch] sidecar written: ${BATCH_RESULTS_PATH}`);
}

// ---------------------------------------------------------------------------
// Single-paragraph retry (synchronous, Messages API not Batch)
// ---------------------------------------------------------------------------

async function retryOne(
  client: Anthropic,
  systemPrompt: string,
  corpus: Corpus,
  customId: string,
): Promise<void> {
  const m = customId.match(/^federalist-(\d+)-para-(\d+)$/);
  if (!m) throw new Error(`invalid custom_id: ${customId}`);
  const paperNumber = Number(m[1]);
  const paragraphIndex = Number(m[2]);

  const item = corpus.items.find(it => it.federalist.number === paperNumber);
  if (!item) throw new Error(`Federalist ${paperNumber} not found in corpus`);
  if (paragraphIndex < 0 || paragraphIndex >= item.paragraphs.length) {
    throw new Error(`paragraph index ${paragraphIndex} out of range for Federalist ${paperNumber} (paragraphs.length=${item.paragraphs.length})`);
  }
  const target = item.paragraphs[paragraphIndex];
  if (target === SALUTATION) {
    throw new Error(`refusing to submit the salutation paragraph; salutations are bypassed and written through verbatim`);
  }

  if (!existsSync(BATCH_RESULTS_PATH)) {
    throw new Error(`--retry requires existing sidecar at ${BATCH_RESULTS_PATH}`);
  }
  const sidecar = JSON.parse(readFileSync(BATCH_RESULTS_PATH, 'utf8')) as Record<string, string | { error: string }>;
  if (!(customId in sidecar)) {
    throw new Error(`custom_id ${customId} not in sidecar; --retry only updates existing entries`);
  }
  const before = sidecar[customId];

  console.log(`[retry] ${customId}: Federalist ${paperNumber}, paragraph index ${paragraphIndex}`);
  console.log(`[retry] target paragraph (${target.length} chars):`);
  console.log(`[retry]   ${target.slice(0, 160)}${target.length > 160 ? '…' : ''}`);

  const userMessage = buildUserMessage(item, paragraphIndex);

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  });

  const text = response.content
    .filter(b => b.type === 'text')
    .map(b => (b as { type: 'text'; text: string }).text)
    .join('');

  // Atomic sidecar update: temp-file + rename so a crash mid-write cannot
  // truncate the existing 1.69 MB sidecar.
  sidecar[customId] = text;
  const tmp = BATCH_RESULTS_PATH + '.tmp';
  writeFileSync(tmp, JSON.stringify(sidecar, null, 2));
  renameSync(tmp, BATCH_RESULTS_PATH);

  console.log(`[retry] sidecar updated for ${customId}`);
  console.log('');
  console.log('--- BEFORE (raw sidecar value) ---');
  console.log(typeof before === 'string' ? before : JSON.stringify(before));
  console.log('');
  console.log('--- AFTER (raw model output) ---');
  console.log(text);
  console.log('');

  const pp = postprocess(text, target);
  console.log('--- AFTER (postprocessed rendering) ---');
  console.log(pp.rendered);
  console.log('');
  if (pp.flags.length) {
    console.log(`Flags (${pp.flags.length}):`);
    for (const f of pp.flags) console.log(`  [${f.kind}] ${f.note}`);
  } else {
    console.log('Flags: none');
  }
  if (pp.warnings.length) {
    console.log(`Postprocess warnings (${pp.warnings.length}):`);
    for (const w of pp.warnings) console.log(`  ${w}`);
  } else {
    console.log('Postprocess warnings: none');
  }
}

function readResultsSidecar(): Map<string, string | { error: string }> {
  if (!existsSync(BATCH_RESULTS_PATH)) {
    throw new Error(`--apply requires ${BATCH_RESULTS_PATH} to exist; run without --apply first to fetch results.`);
  }
  const raw = JSON.parse(readFileSync(BATCH_RESULTS_PATH, 'utf8'));
  const out = new Map<string, string | { error: string }>();
  for (const [k, v] of Object.entries(raw)) out.set(k, v as string | { error: string });
  return out;
}

async function main() {
  loadEnv();
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('missing env: ANTHROPIC_API_KEY (expected in .env.local)');
    process.exit(2);
  }

  const corpus: Corpus = JSON.parse(readFileSync(FEDERALIST_PATH, 'utf8'));

  // Mode-mutex: --retry is independent of all other flags except API key.
  if (isRetry && (isApply || isSample || isResume || isReset || isMergeAnnotations)) {
    console.error('[main] --retry is incompatible with --apply / --sample / --resume / --reset / --merge-annotations');
    process.exit(2);
  }
  if (isMergeAnnotations && !isApply) {
    console.error('[main] --merge-annotations is only valid with --apply');
    process.exit(2);
  }

  // --apply takes a fast path: no submission, no polling, no API contact.
  // Reads the sidecar produced by a prior run, postprocesses every entry,
  // writes the annotations file (abort-vs-merge), writes federalist.json
  // atomically, prints a summary, then clears state + sidecar.
  if (isApply) {
    if (isSample) {
      console.error('[main] --apply is incompatible with --sample (sample mode does not write back to the corpus).');
      process.exit(2);
    }
    const results = readResultsSidecar();
    console.log(`[apply] read ${results.size} results from sidecar`);

    // Load the system prompt to compute its sha256 — pinned in the
    // annotations file as a verifiable record of which prompt produced
    // these flags. Reading the file is cheap; the sha is the audit point.
    const systemPromptForSha = loadSystemPrompt();
    const promptSha256 = createHash('sha256').update(systemPromptForSha).digest('hex');

    const { renderings, failures, warnings } = processBatch(corpus, results);
    if (failures.length) {
      console.error(`[apply] ABORTING: ${failures.length} failures, no write performed:`);
      for (const f of failures) console.error(`  - ${f}`);
      throw new Error('aborted before write — see failures above');
    }
    if (warnings.length) {
      console.warn(`[apply] ${warnings.length} postprocess warnings (non-fatal):`);
      for (const w of warnings) console.warn(`  - ${w}`);
    }

    // Annotations write first: its abort-vs-merge guard can fail, and we'd
    // rather catch that before mutating the corpus. Both writes use atomic
    // tmp+rename; cross-file consistency on a partial failure is bounded.
    const ann = buildAnnotations(corpus, renderings, promptSha256);
    writeAnnotationsFile(ann, isMergeAnnotations);
    writePlainEnglish(corpus, renderings);

    summarize(ann);

    if (existsSync(BATCH_RESULTS_PATH)) unlinkSync(BATCH_RESULTS_PATH);
    clearState();
    console.log(`[apply] corpus + annotations updated; sidecar and state cleared.`);
    return;
  }

  const systemPrompt = loadSystemPrompt();
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  if (isRetry) {
    await retryOne(client, systemPrompt, corpus, retryCustomIdArg!);
    return;
  }

  // Decide whether to submit a new batch or resume.
  let state = readState();
  const requests = isSample ? buildSampleRequests(corpus) : buildFullRequests(corpus);

  if (state) {
    console.log(`[main] resuming existing batch ${state.batch_id} (mode=${state.mode}, ${state.request_count} requests)`);
    if (isSample !== (state.mode === 'sample')) {
      console.error(`[main] mode mismatch: state file is ${state.mode}, current invocation is ${isSample ? 'sample' : 'full'}`);
      console.error(`[main] either run with --reset to discard the existing state, or invoke without --sample to match.`);
      process.exit(2);
    }
  } else if (isResume) {
    console.error('[main] --resume passed but no state file found at ' + STATE_PATH);
    process.exit(2);
  } else {
    console.log(`[main] no state file — submitting new ${isSample ? 'sample' : 'full'} batch with ${requests.length} requests`);
    state = await submitBatch(client, systemPrompt, corpus, requests);
  }

  await pollUntilEnded(client, state.batch_id);
  console.log(`[main] batch ended; fetching results…`);
  const results = await fetchResults(client, state.batch_id);
  console.log(`[main] received ${results.size} results`);

  if (state.mode === 'sample') {
    // Re-derive request specs from the corpus + the state's custom_ids so
    // sample reporting works on resume even if SAMPLE_KEYS changed.
    const reqsForReport: RequestSpec[] = state.custom_ids.map(cid => {
      const { paperNumber, paragraphIndex } = parseCustomId(cid);
      const item = corpus.items.find(it => it.federalist.number === paperNumber)!;
      return { custom_id: cid, paperNumber, paragraphIndex, target: item.paragraphs[paragraphIndex] };
    });
    writeSampleReviewFile(corpus, reqsForReport, results);
    console.log(`[main] sample mode complete — review ${SAMPLE_RESULTS_PATH} before approving full run.`);
    clearState();
  } else {
    // Full mode: dump results to sidecar but do NOT mutate federalist.json.
    // Corpus write requires a separate invocation with --apply so the
    // operator has a chance to inspect the sidecar between fetch and write.
    dumpResultsSidecar(results);
    console.log(`[main] full mode fetch complete.`);
    console.log(`[main] To write rendered paragraphs back into the corpus, run:`);
    console.log(`[main]   node --experimental-strip-types scripts/generate-plain-english.ts --apply`);
  }
}

// Direct-invocation guard: only run main() when this script is executed
// directly via `node ... scripts/generate-plain-english.ts`. If imported
// from another module (e.g., for unit testing), main() must NOT auto-run.
// This guard exists because of a prior incident: an `await import(...)`
// in a smoke-test snippet triggered an unauthorized full-mode batch.
const isDirectInvocation =
  typeof process.argv[1] === 'string' &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectInvocation) {
  main().catch(err => {
    console.error('[fatal]', err);
    process.exit(1);
  });
}
