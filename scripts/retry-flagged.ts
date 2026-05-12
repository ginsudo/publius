// Phase 3.2 retry-pass renderer for flagged_for_rewrite paragraphs.
//
// Reads the editorial-pass output (federalist-annotations.json), finds every
// paragraph with editorial_status === 'flagged_for_rewrite', and re-renders
// each one against a refined system prompt (prompts/retry-v0.2.1.md) using
// the Messages API synchronously. Two-phase: fetch writes a sidecar; --apply
// is a second invocation that writes the new renderings + flags back into
// federalist.json and federalist-annotations.json.
//
// Run:
//   node --experimental-strip-types scripts/retry-flagged.ts
//   node --experimental-strip-types scripts/retry-flagged.ts --apply

import { readFileSync, writeFileSync, existsSync, renameSync, unlinkSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import Anthropic from '@anthropic-ai/sdk';
import { loadEnv, REPO_ROOT, FEDERALIST_PATH } from '../data/eval/lib.ts';

// ---------------------------------------------------------------------------
// Paths and constants
// ---------------------------------------------------------------------------

const PROMPT_PATH = resolve(REPO_ROOT, 'prompts', 'retry-v0.2.1.md');
const ANNOTATIONS_PATH = resolve(REPO_ROOT, 'data', 'federalist', 'federalist-annotations.json');
const RETRY_RESULTS_PATH = resolve(REPO_ROOT, 'data', 'federalist', '.retry-results.json');

const MODEL = 'claude-sonnet-4-6';
const MAX_TOKENS = 4000;
const SALUTATION = 'To the People of the State of New York:';

const TARGET_OPEN = '<<<TARGET_PARAGRAPH>>>';
const TARGET_CLOSE = '<<<END_TARGET_PARAGRAPH>>>';

// ---------------------------------------------------------------------------
// Types (subset of generate-plain-english.ts — duplicated rather than exported
// to keep the retry script standalone)
// ---------------------------------------------------------------------------

type FederalistItem = {
  id: string;
  corpus: 'federalist';
  title: string;
  authors: string[];
  date: string;
  paragraphs: string[];
  footnotes: { marker: string; paragraphs: string[] }[];
  plain_english: string[] | null;
  federalist: {
    number: number;
    authorship_status: 'undisputed' | 'disputed' | 'joint';
    authorship_note: string | null;
    publication: { venue: string; raw_dateline: string };
  };
};

type Corpus = {
  corpus: 'federalist';
  source: Record<string, unknown>;
  count: number;
  items: FederalistItem[];
};

type FlagKind = 'AMBIGUOUS' | 'WORD' | 'RHETORIC';
type EditorialStatus = null | 'accepted' | 'edited' | 'flagged_for_rewrite';

type FlagEntry = {
  kind: FlagKind;
  term: string | null;
  note: string;
};

type ParagraphAnnotation = {
  paragraph_index: number;
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

type RawFlag = { kind: FlagKind; note: string };

type RenderResult = {
  rendered: string;
  flags: RawFlag[];
  warnings: string[];
};

type RetrySidecar = Record<string, string | { error: string }>;

// ---------------------------------------------------------------------------
// CLI parsing
// ---------------------------------------------------------------------------

const argv = process.argv.slice(2);
const FLAGS = new Set(argv);
const isApply = FLAGS.has('--apply');

// ---------------------------------------------------------------------------
// User-message builder (identical contract to generate-plain-english.ts)
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
// Postprocess (mirrors generate-plain-english.ts)
// ---------------------------------------------------------------------------

const FOOTNOTE_MARKER_RE = /\((?:\d+|EN|TN-[A-Z])\)/g;
const FLAG_RE = /\[(AMBIGUOUS|WORD|RHETORIC):\s*([^\]]+)\]/g;
const FLAG_BODY_RE = /^\s*["“]([^"”]+)["”]\s*[—–\-]\s*([\s\S]*)$/;

function postprocess(modelOutput: string, originalTarget: string): RenderResult {
  let text = modelOutput.trim();
  const warnings: string[] = [];

  if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith('“') && text.endsWith('”'))) {
    text = text.slice(1, -1).trim();
    warnings.push('stripped surrounding quotes');
  }

  const preambleRe = /^(Here (?:is|are)|Modernized|Rendered|Plain[- ]English)[^\n]{0,120}:\s*\n/i;
  if (preambleRe.test(text)) {
    text = text.replace(preambleRe, '').trim();
    warnings.push('stripped leading preamble line');
  }

  const flags: RawFlag[] = [];
  text = text.replace(FLAG_RE, (_full, kind: string, note: string) => {
    flags.push({ kind: kind as FlagKind, note: note.trim() });
    return '';
  });
  text = text
    .split('\n')
    .map((l) => l.replace(/[ \t]+$/, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();

  const origMarkers = (originalTarget.match(FOOTNOTE_MARKER_RE) || []).slice().sort();
  const rendMarkers = (text.match(FOOTNOTE_MARKER_RE) || []).slice().sort();
  if (origMarkers.join('|') !== rendMarkers.join('|')) {
    warnings.push(
      `footnote marker mismatch — original: [${origMarkers.join(', ') || 'none'}], rendered: [${rendMarkers.join(', ') || 'none'}]`,
    );
  }

  const firstWord = text.split(/\s+/)[0]?.toLowerCase() ?? '';
  if (['here', "here's", 'modernized', 'rendered', 'translation', 'note:'].includes(firstWord)) {
    warnings.push(`suspicious opening word "${firstWord}" — possible preamble leak`);
  }

  return { rendered: text, flags, warnings };
}

function parseFlagBody(body: string): { term: string | null; note: string } {
  const m = body.match(FLAG_BODY_RE);
  if (m) return { term: m[1].trim(), note: m[2].trim() };
  return { term: null, note: body.trim() };
}

// ---------------------------------------------------------------------------
// Find flagged_for_rewrite targets
// ---------------------------------------------------------------------------

type RetryTarget = {
  paperNumber: number;
  paragraphIndex: number;
  customId: string;
  target: string;
  priorEditorialNote: string | null;
};

function findFlaggedTargets(corpus: Corpus, ann: FederalistAnnotations): RetryTarget[] {
  const byNumber = new Map(corpus.items.map((it) => [it.federalist.number, it]));
  const targets: RetryTarget[] = [];
  for (const paper of ann.papers) {
    const item = byNumber.get(paper.paper_number);
    if (!item) throw new Error(`annotations reference Federalist ${paper.paper_number} but corpus has no such item`);
    for (const para of paper.paragraphs) {
      if (para.editorial_status !== 'flagged_for_rewrite') continue;
      const text = item.paragraphs[para.paragraph_index];
      if (text === undefined) {
        throw new Error(`Federalist ${paper.paper_number} paragraph ${para.paragraph_index} not found in corpus`);
      }
      if (text === SALUTATION) {
        throw new Error(`refusing to retry the salutation paragraph (Federalist ${paper.paper_number} para ${para.paragraph_index})`);
      }
      targets.push({
        paperNumber: paper.paper_number,
        paragraphIndex: para.paragraph_index,
        customId: `federalist-${paper.paper_number}-para-${para.paragraph_index}`,
        target: text,
        priorEditorialNote: para.editorial_note,
      });
    }
  }
  return targets;
}

// ---------------------------------------------------------------------------
// Fetch phase: render each target synchronously, write sidecar
// ---------------------------------------------------------------------------

async function renderOne(
  client: Anthropic,
  systemPrompt: string,
  item: FederalistItem,
  paragraphIndex: number,
): Promise<string> {
  const userMessage = buildUserMessage(item, paragraphIndex);
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  });
  return response.content
    .filter((b) => b.type === 'text')
    .map((b) => (b as { type: 'text'; text: string }).text)
    .join('');
}

async function fetchPhase(): Promise<void> {
  loadEnv();
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('missing env: ANTHROPIC_API_KEY (expected in .env.local)');
    process.exit(2);
  }
  if (!existsSync(PROMPT_PATH)) {
    console.error(`system prompt not found at ${PROMPT_PATH}`);
    process.exit(2);
  }
  if (!existsSync(ANNOTATIONS_PATH)) {
    console.error(`annotations file not found at ${ANNOTATIONS_PATH}`);
    process.exit(2);
  }
  const systemPrompt = readFileSync(PROMPT_PATH, 'utf8').trim();
  const corpus: Corpus = JSON.parse(readFileSync(FEDERALIST_PATH, 'utf8'));
  const ann: FederalistAnnotations = JSON.parse(readFileSync(ANNOTATIONS_PATH, 'utf8'));
  const targets = findFlaggedTargets(corpus, ann);

  console.log(`[retry] found ${targets.length} flagged_for_rewrite paragraphs`);
  console.log(`[retry] system prompt: ${PROMPT_PATH} (${systemPrompt.length} chars)`);
  console.log(`[retry] model: ${MODEL}, max_tokens: ${MAX_TOKENS}`);
  console.log('');

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const byNumber = new Map(corpus.items.map((it) => [it.federalist.number, it]));

  const sidecar: RetrySidecar = {};
  let n = 0;
  for (const t of targets) {
    n++;
    const item = byNumber.get(t.paperNumber)!;
    console.log(`[${n}/${targets.length}] ${t.customId} (target ${t.target.length} chars) …`);
    try {
      const text = await renderOne(client, systemPrompt, item, t.paragraphIndex);
      sidecar[t.customId] = text;
      // Quick visibility on truncation: compare rendered char count to original.
      const pp = postprocess(text, t.target);
      const tailOrig = t.target.slice(-60).replace(/\s+/g, ' ');
      const tailRend = pp.rendered.slice(-60).replace(/\s+/g, ' ');
      console.log(`           rendered ${pp.rendered.length} chars, ${pp.flags.length} flags, ${pp.warnings.length} warnings`);
      console.log(`           orig tail: …${tailOrig}`);
      console.log(`           rend tail: …${tailRend}`);
      if (pp.warnings.length) {
        for (const w of pp.warnings) console.log(`           ! ${w}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      sidecar[t.customId] = { error: msg };
      console.log(`           ERROR: ${msg}`);
    }
  }

  const tmp = RETRY_RESULTS_PATH + '.tmp';
  writeFileSync(tmp, JSON.stringify(sidecar, null, 2));
  renameSync(tmp, RETRY_RESULTS_PATH);
  console.log('');
  console.log(`[retry] sidecar written: ${RETRY_RESULTS_PATH}`);
  console.log(`[retry] To write renderings back to corpus + annotations, run:`);
  console.log(`[retry]   node --experimental-strip-types scripts/retry-flagged.ts --apply`);
}

// ---------------------------------------------------------------------------
// Apply phase: write sidecar renderings back to federalist.json +
// federalist-annotations.json. Resets editorial_status / editorial_note to
// null for retried paragraphs; replaces flags with the new ones.
// ---------------------------------------------------------------------------

function applyPhase(): void {
  if (!existsSync(RETRY_RESULTS_PATH)) {
    console.error(`--apply requires ${RETRY_RESULTS_PATH} to exist; run without --apply first.`);
    process.exit(2);
  }
  if (!existsSync(ANNOTATIONS_PATH)) {
    console.error(`annotations file not found at ${ANNOTATIONS_PATH}`);
    process.exit(2);
  }
  const sidecar = JSON.parse(readFileSync(RETRY_RESULTS_PATH, 'utf8')) as RetrySidecar;
  const corpus: Corpus = JSON.parse(readFileSync(FEDERALIST_PATH, 'utf8'));
  const ann: FederalistAnnotations = JSON.parse(readFileSync(ANNOTATIONS_PATH, 'utf8'));
  const targets = findFlaggedTargets(corpus, ann);

  // Verify every flagged target has a successful sidecar entry before mutating
  // anything. Any error or missing entry aborts the apply.
  const failures: string[] = [];
  for (const t of targets) {
    const v = sidecar[t.customId];
    if (v === undefined) {
      failures.push(`${t.customId}: missing sidecar entry`);
    } else if (typeof v === 'object' && v !== null && 'error' in v) {
      failures.push(`${t.customId}: ${v.error}`);
    }
  }
  if (failures.length) {
    console.error(`[apply] ABORTING: ${failures.length} sidecar entries missing or errored:`);
    for (const f of failures) console.error(`  - ${f}`);
    process.exit(1);
  }

  // Build paper -> annotations map for fast lookup.
  const annByPaper = new Map(ann.papers.map((p) => [p.paper_number, p]));
  const corpusByPaper = new Map(corpus.items.map((it) => [it.federalist.number, it]));

  let postprocessWarnings = 0;
  for (const t of targets) {
    const raw = sidecar[t.customId] as string;
    const pp = postprocess(raw, t.target);
    if (pp.warnings.length) {
      postprocessWarnings += pp.warnings.length;
      for (const w of pp.warnings) console.warn(`[apply] ${t.customId}: ${w}`);
    }

    // Update plain_english[i] in corpus.
    const item = corpusByPaper.get(t.paperNumber)!;
    if (item.plain_english === null) {
      throw new Error(`Federalist ${t.paperNumber}: plain_english array is null — cannot retry-update`);
    }
    item.plain_english[t.paragraphIndex] = pp.rendered;

    // Update flags + reset editorial status/note in annotations.
    const paper = annByPaper.get(t.paperNumber)!;
    const para = paper.paragraphs.find((p) => p.paragraph_index === t.paragraphIndex);
    if (!para) throw new Error(`annotations missing paragraph ${t.paperNumber}:${t.paragraphIndex}`);
    para.flags = pp.flags.map((f) => {
      const parsed = parseFlagBody(f.note);
      return { kind: f.kind, term: parsed.term, note: parsed.note };
    });
    para.editorial_status = null;
    para.editorial_note = null;
  }

  // Atomic writes for both files.
  const corpusTmp = FEDERALIST_PATH + '.tmp';
  writeFileSync(corpusTmp, JSON.stringify(corpus, null, 2) + '\n');
  renameSync(corpusTmp, FEDERALIST_PATH);
  console.log(`[apply] corpus written: ${FEDERALIST_PATH}`);

  const annTmp = ANNOTATIONS_PATH + '.tmp';
  writeFileSync(annTmp, JSON.stringify(ann, null, 2) + '\n');
  renameSync(annTmp, ANNOTATIONS_PATH);
  console.log(`[apply] annotations written: ${ANNOTATIONS_PATH}`);

  unlinkSync(RETRY_RESULTS_PATH);
  console.log(`[apply] sidecar cleared: ${RETRY_RESULTS_PATH}`);

  console.log('');
  console.log(`[apply] ${targets.length} paragraphs retried and applied.`);
  console.log(`[apply] postprocess warnings: ${postprocessWarnings}`);
  console.log(`[apply] editorial_status reset to null for all ${targets.length} — re-review via scripts/review-annotations.ts`);
}

// ---------------------------------------------------------------------------
// Main + direct-invocation guard
// ---------------------------------------------------------------------------

async function main() {
  if (isApply) {
    applyPhase();
    return;
  }
  await fetchPhase();
}

const isDirectInvocation =
  typeof process.argv[1] === 'string' &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectInvocation) {
  main().catch((err) => {
    console.error('[fatal]', err);
    process.exit(1);
  });
}
