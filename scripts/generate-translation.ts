// Phase 4 Tocqueville translation generator.
//
// Modes:
//   --sample : gate-1 run over three hand-picked Volume I items (intro
//              paras 0-4, part2.ch6 paras 0-3, t1.notes.A all paras).
//              Synchronous Messages API; writes
//              data/tocqueville/.translation-sample.json (raw outputs) and
//              data/tocqueville/translation-sample-results.md (side-by-side
//              review file). Does NOT mutate tocqueville.json.
//   (default): submit every Volume I item to the Batch API (one request
//              per item). Writes state to .translation-batch-state.json
//              while polling, then dumps results to
//              .translation-batch-results.json. Corpus write requires
//              --apply.
//   --apply  : read .translation-batch-results.json sidecar (produced by
//              a prior fetch) and write translation + footnotes_translation
//              back into tocqueville.json. Also writes
//              data/tocqueville/tocqueville-annotations.json.
//   --retry <item_id> <paragraph_index> : re-run a single paragraph
//              synchronously and splice the new translation/flags into
//              the existing sidecar entry. Requires the sidecar to exist
//              and to already contain an entry for <item_id>.
//
// Resume: if .translation-batch-state.json exists, the script resumes
// polling that batch instead of submitting a new one. Use --resume to be
// explicit. Delete the state file (or pass --reset) to start fresh.
//
// Volume II items are out of scope and are never touched.

import { readFileSync, writeFileSync, existsSync, renameSync, unlinkSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import Anthropic from '@anthropic-ai/sdk';
import { loadEnv, REPO_ROOT } from '../data/eval/lib.ts';
import { extractPrompt } from '../lib/ask.ts';

// ---------------------------------------------------------------------------
// Paths and constants
// ---------------------------------------------------------------------------

const TOCQUEVILLE_PATH = resolve(REPO_ROOT, 'data', 'tocqueville', 'tocqueville.json');
const PROMPT_PATH = resolve(REPO_ROOT, 'prompts', 'tocqueville-translation-system.md');
const STATE_PATH = resolve(REPO_ROOT, 'data', 'tocqueville', '.translation-batch-state.json');
const BATCH_RESULTS_PATH = resolve(REPO_ROOT, 'data', 'tocqueville', '.translation-batch-results.json');
const SAMPLE_RAW_PATH = resolve(REPO_ROOT, 'data', 'tocqueville', '.translation-sample.json');
const SAMPLE_RESULTS_PATH = resolve(REPO_ROOT, 'data', 'tocqueville', 'translation-sample-results.md');
const ANNOTATIONS_PATH = resolve(REPO_ROOT, 'data', 'tocqueville', 'tocqueville-annotations.json');
const PROMPT_VERSION = 'v1.0';

const MODEL = 'claude-sonnet-4-6';
const MAX_TOKENS = 8000;
const POLL_INTERVAL_MS = 60_000;
const TARGET_VOLUME = 1;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Footnote = { marker: string; paragraphs: string[] };

type TocquevilleExt = {
  volume: 1 | 2;
  part: number | null;
  chapter: number | null;
  kind: 'avertissement' | 'introduction' | 'chapter' | 'end_note' | 'appendix';
  chapter_summary: string | null;
  references_page: number | null;
  tome: 1 | 2 | 3 | 4;
  end_notes_referenced: string[];
  translation: string[] | null;
  footnotes_translation?: Footnote[];
};

type TocquevilleItem = {
  id: string;
  corpus: 'tocqueville';
  title: string;
  authors: string[];
  date: string;
  language: string;
  paragraphs: string[];
  footnotes: Footnote[];
  plain_english: string[] | null;
  constitutional_section: string | null;
  topic_tags: string[];
  tocqueville: TocquevilleExt;
};

type Corpus = {
  corpus: 'tocqueville';
  source: Record<string, unknown>;
  count: number;
  items: TocquevilleItem[];
};

type FlagKind = 'READING' | 'TEXTURE' | 'TERM';
// french is null when the model emits a flag as a single descriptive
// sentence without quoting a specific French phrase — e.g.,
// `[TEXTURE: Tocqueville quotes the English-language source title in italics.]`.
// Mirrors federalist annotations' `term: string | null` convention.
type Flag = { kind: FlagKind; french: string | null; note: string };

type BatchState = {
  batch_id: string;
  mode: 'full';
  submitted_at: string;
  request_count: number;
  custom_ids: string[];
};

// Parsed translation for one item. For sample/retry modes, paragraphs and
// flags may be sparse — keyed by the indices the caller asked for.
type ParagraphSlot = { paragraph_index: number; translation: string; flags: Flag[] };
type FootnoteSlot = { marker: string; paragraphs: string[]; flags: Flag[] };

type ParsedItem = {
  item_id: string;
  paragraphs: ParagraphSlot[];
  footnotes: FootnoteSlot[];
  warnings: string[];
};

// Annotations layer — written by --apply, sits alongside tocqueville.json.
type EditorialStatus = null | 'accepted' | 'edited' | 'flagged_for_rewrite';

type FlagEntry = { kind: FlagKind; french: string | null; note: string };

type ParagraphAnnotation = {
  paragraph_index: number;
  flags: FlagEntry[];
  editorial_status: EditorialStatus;
  editorial_note: string | null;
};

type FootnoteAnnotation = {
  marker: string;
  flags: FlagEntry[];
  editorial_status: EditorialStatus;
  editorial_note: string | null;
};

type ItemAnnotations = {
  item_id: string;
  paragraphs: ParagraphAnnotation[];
  footnotes: FootnoteAnnotation[];
};

type TocquevilleAnnotations = {
  corpus: 'tocqueville';
  generated_at: string;
  prompt_version: string;
  prompt_sha256: string;
  volume: 1;
  items: ItemAnnotations[];
};

// ---------------------------------------------------------------------------
// CLI parsing
// ---------------------------------------------------------------------------

const argv = process.argv.slice(2);
const FLAGS = new Set(argv);
const isSample = FLAGS.has('--sample');
const isResume = FLAGS.has('--resume');
const isReset = FLAGS.has('--reset');
const isApply = FLAGS.has('--apply');
const retryIdx = argv.indexOf('--retry');
const retryItemIdArg: string | null =
  retryIdx >= 0 && retryIdx + 1 < argv.length ? argv[retryIdx + 1] : null;
const retryParaIdxArg: string | null =
  retryIdx >= 0 && retryIdx + 2 < argv.length ? argv[retryIdx + 2] : null;
const isRetry = retryIdx >= 0;

if (isRetry && (!retryItemIdArg || retryParaIdxArg === null)) {
  console.error('[main] --retry requires two args: --retry <item_id> <paragraph_index>');
  process.exit(2);
}

if (isReset && existsSync(STATE_PATH)) {
  unlinkSync(STATE_PATH);
  console.log(`[reset] removed ${STATE_PATH}`);
}

// ---------------------------------------------------------------------------
// Hard-coded gate-1 sample set. Not configurable.
// ---------------------------------------------------------------------------

type SampleSpec = { item_id: string; paragraph_indices: number[] | 'all'; note: string };

const SAMPLE_SPECS: SampleSpec[] = [
  {
    item_id: 'tocqueville:vol1.introduction',
    paragraph_indices: [0, 1, 2, 3, 4],
    note: 'Introduction — opening five paragraphs (sets the conceptual frame: equality of conditions)',
  },
  {
    item_id: 'tocqueville:vol1.part2.ch6',
    paragraph_indices: [0, 1, 2, 3],
    note: 'Part II, Chapter 6 — opening four paragraphs (Tocqueville on what democratic government actually delivers)',
  },
  {
    item_id: 'tocqueville:vol1.t1.notes.A',
    paragraph_indices: 'all',
    note: 'Tome 1 end-note A — full note (includes inline footnote marker [163])',
  },
];

// ---------------------------------------------------------------------------
// Custom-ID encoding. The Batch API requires ^[a-zA-Z0-9_-]{1,64}$, and
// Tocqueville item IDs contain ":" and ".". Replace both with "-".
// ---------------------------------------------------------------------------

function encodeCustomId(itemId: string): string {
  const encoded = itemId.replace(/[:.]/g, '-');
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(encoded)) {
    throw new Error(`encoded custom_id "${encoded}" (from "${itemId}") violates Batch API constraints`);
  }
  return encoded;
}

function decodeCustomId(customId: string, corpus: Corpus): TocquevilleItem {
  const match = corpus.items.find(it => encodeCustomId(it.id) === customId);
  if (!match) throw new Error(`unknown custom_id: ${customId}`);
  return match;
}

// ---------------------------------------------------------------------------
// User-message builder. One message per item (or per sample slice).
// ---------------------------------------------------------------------------

function describeItem(item: TocquevilleItem): string {
  const t = item.tocqueville;
  const partStr = t.part === null ? 'null' : String(t.part);
  const chapterStr = t.chapter === null ? 'null' : String(t.chapter);
  return [
    `Item ID: ${item.id}`,
    `Title: ${item.title}`,
    `Kind: ${t.kind} | Volume: ${t.volume} | Part: ${partStr} | Chapter: ${chapterStr} | Tome: ${t.tome}`,
    `First published: ${item.date}`,
  ].join('\n');
}

// Collect footnote markers referenced inline in a slice of paragraphs, in
// the order they first appear. Used to decide which footnotes to include
// alongside a paragraph slice.
const INLINE_MARKER_RE = /\[(?:TN-[A-Za-z]+|[A-Z]+|\d+)\]/g;

function inlineMarkersIn(paragraphs: string[]): string[] {
  const seen: string[] = [];
  const set = new Set<string>();
  for (const p of paragraphs) {
    const matches = p.match(INLINE_MARKER_RE) || [];
    for (const m of matches) {
      if (!set.has(m)) {
        set.add(m);
        seen.push(m);
      }
    }
  }
  return seen;
}

type ParagraphInclusion = { paragraph_index: number; french: string };

function buildUserMessage(
  item: TocquevilleItem,
  paragraphs: ParagraphInclusion[],
  footnotes: Footnote[],
): string {
  const lines: string[] = [];
  lines.push(describeItem(item));
  lines.push('');
  lines.push('Translate the French paragraphs below. Mirror the heading structure exactly.');
  lines.push('After each translated paragraph, emit any READING / TEXTURE / TERM flags that apply,');
  lines.push('one per line, in the format specified in the system prompt.');
  lines.push('');
  lines.push('Required output format:');
  lines.push('');
  lines.push('  ### Paragraph <N>');
  lines.push('  <English translation of paragraph N>');
  lines.push('  [READING: ... — ...]    (zero or more flag lines)');
  lines.push('');
  lines.push('  ### Paragraph <N+1>');
  lines.push('  ...');
  lines.push('');
  lines.push('  ### Footnote [<marker>]');
  lines.push('  <English translation of the footnote>');
  lines.push('  [TERM: ... — ...]');
  lines.push('');
  lines.push('Use exactly the heading text shown — including the brackets around footnote markers.');
  lines.push('Do not add a preamble. Do not summarize. Translate only the paragraphs and footnotes given.');
  lines.push('');
  lines.push('=== FRENCH SOURCE ===');
  lines.push('');
  for (const p of paragraphs) {
    lines.push(`### Paragraph ${p.paragraph_index}`);
    lines.push(p.french);
    lines.push('');
  }
  if (footnotes.length > 0) {
    lines.push('=== FOOTNOTES ===');
    lines.push('');
    for (const fn of footnotes) {
      lines.push(`### Footnote ${fn.marker}`);
      lines.push(fn.paragraphs.join('\n'));
      lines.push('');
    }
  }
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Output parsing
// ---------------------------------------------------------------------------

// Match any [KIND: ...] block. The body can contain em-dashes, quoted
// material, etc., but not square brackets — those would prematurely close
// the flag. Parse the french/note split as a second step against the body.
const FLAG_RE = /\[(READING|TEXTURE|TERM):\s*([^\[\]]+)\]/g;
const PARA_HEADING_RE = /^###\s+Paragraph\s+(\d+)\s*$/;
const FOOTNOTE_HEADING_RE = /^###\s+Footnote\s+(\[[A-Za-z0-9\-]+\])\s*$/;

// A flag body may take one of three shapes:
//   `"phrase" — note`     (curly or straight quotes, em/en-dash or hyphen)
//   `*phrase* — note`     (italicized phrase)
//   `note`                (no quoted/italicized french prefix at all — the
//                          whole body is the note. Seen in the gate-1
//                          sample when the model treats a flag as a single
//                          descriptive sentence.)
const FLAG_BODY_QUOTED_RE = /^\s*["“]([^"”]+)["”]\s*[—–\-]\s*([\s\S]+)$/;
const FLAG_BODY_ITALIC_RE = /^\s*\*([^*]+)\*\s*[—–\-]\s*([\s\S]+)$/;

function parseFlagBody(body: string): { french: string | null; note: string } {
  const q = body.match(FLAG_BODY_QUOTED_RE);
  if (q) return { french: q[1].trim(), note: q[2].trim() };
  const i = body.match(FLAG_BODY_ITALIC_RE);
  if (i) return { french: i[1].trim(), note: i[2].trim() };
  return { french: null, note: body.trim() };
}

function extractFlags(text: string): { cleaned: string; flags: Flag[] } {
  const flags: Flag[] = [];
  const cleaned = text.replace(FLAG_RE, (_full, kind: string, body: string) => {
    const parsed = parseFlagBody(body);
    flags.push({ kind: kind as FlagKind, french: parsed.french, note: parsed.note });
    return '';
  });
  return {
    cleaned: cleaned.split('\n').map(l => l.replace(/[ \t]+$/, '')).join('\n').replace(/\n{3,}/g, '\n\n').trim(),
    flags,
  };
}

function parseItemOutput(rawOutput: string, itemId: string): ParsedItem {
  const lines = rawOutput.split('\n');
  const paragraphs: ParagraphSlot[] = [];
  const footnotes: FootnoteSlot[] = [];
  const warnings: string[] = [];

  // Walk through the output, recognising paragraph and footnote headings.
  let currentKind: 'paragraph' | 'footnote' | null = null;
  let currentParaIdx = -1;
  let currentMarker: string | null = null;
  let buf: string[] = [];

  const flushCurrent = () => {
    if (currentKind === null) return;
    const text = buf.join('\n');
    const { cleaned, flags } = extractFlags(text);
    if (currentKind === 'paragraph') {
      paragraphs.push({ paragraph_index: currentParaIdx, translation: cleaned, flags });
    } else if (currentKind === 'footnote' && currentMarker !== null) {
      // Footnote may itself contain paragraph breaks (rare but possible);
      // preserve them by splitting on blank lines.
      const fnParas = cleaned.split(/\n{2,}/).map(s => s.trim()).filter(s => s.length > 0);
      footnotes.push({ marker: currentMarker, paragraphs: fnParas.length > 0 ? fnParas : [cleaned], flags });
    }
    buf = [];
  };

  for (const line of lines) {
    const pMatch = line.match(PARA_HEADING_RE);
    const fMatch = line.match(FOOTNOTE_HEADING_RE);
    if (pMatch) {
      flushCurrent();
      currentKind = 'paragraph';
      currentParaIdx = Number(pMatch[1]);
      currentMarker = null;
    } else if (fMatch) {
      flushCurrent();
      currentKind = 'footnote';
      currentMarker = fMatch[1];
      currentParaIdx = -1;
    } else {
      buf.push(line);
    }
  }
  flushCurrent();

  // Drop any leading "=== FRENCH SOURCE ===" or "=== FOOTNOTES ===" sentinels
  // that may have slipped into the first paragraph buffer if the model echoed
  // the section divider.
  for (const slot of paragraphs) {
    slot.translation = slot.translation
      .replace(/^=== [A-Z ]+ ===\s*/g, '')
      .trim();
  }

  if (paragraphs.length === 0 && footnotes.length === 0) {
    warnings.push(`${itemId}: no paragraph or footnote headings parsed from output`);
  }

  // Detect duplicate paragraph indices, which would indicate a bad parse or
  // a model that emitted a paragraph twice.
  const seen = new Set<number>();
  for (const slot of paragraphs) {
    if (seen.has(slot.paragraph_index)) {
      warnings.push(`${itemId}: paragraph index ${slot.paragraph_index} appears more than once in output`);
    }
    seen.add(slot.paragraph_index);
  }

  return { item_id: itemId, paragraphs, footnotes, warnings };
}

// ---------------------------------------------------------------------------
// Marker preservation check
// ---------------------------------------------------------------------------

function markerMultiset(text: string): string[] {
  return (text.match(INLINE_MARKER_RE) || []).slice().sort();
}

function checkMarkerPreservation(
  source: string,
  translation: string,
  label: string,
): string[] {
  const src = markerMultiset(source);
  const trg = markerMultiset(translation);
  if (src.join('|') !== trg.join('|')) {
    return [
      `${label}: inline marker mismatch — source: [${src.join(', ') || 'none'}], translation: [${trg.join(', ') || 'none'}]`,
    ];
  }
  return [];
}

// ---------------------------------------------------------------------------
// Build request list (full mode = one per Vol I item)
// ---------------------------------------------------------------------------

type RequestSpec = {
  custom_id: string;
  item_id: string;
};

function buildFullRequests(corpus: Corpus): RequestSpec[] {
  return corpus.items
    .filter(it => it.tocqueville.volume === TARGET_VOLUME)
    .map(it => ({ custom_id: encodeCustomId(it.id), item_id: it.id }));
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
// Batch submission and polling
// ---------------------------------------------------------------------------

async function submitBatch(
  client: Anthropic,
  systemPrompt: string,
  corpus: Corpus,
  requests: RequestSpec[],
): Promise<BatchState> {
  console.log(`[submit] preparing ${requests.length} requests…`);
  const byId = new Map(corpus.items.map(it => [it.id, it]));
  const apiRequests = requests.map(req => {
    const item = byId.get(req.item_id)!;
    const paragraphInclusions: ParagraphInclusion[] = item.paragraphs.map((p, i) => ({
      paragraph_index: i,
      french: p,
    }));
    return {
      custom_id: req.custom_id,
      params: {
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: systemPrompt,
        messages: [
          {
            role: 'user' as const,
            content: buildUserMessage(item, paragraphInclusions, item.footnotes ?? []),
          },
        ],
      },
    };
  });

  const batch = await client.messages.batches.create({ requests: apiRequests });
  console.log(`[submit] batch created: ${batch.id} (${batch.processing_status})`);
  const state: BatchState = {
    batch_id: batch.id,
    mode: 'full',
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

async function fetchResults(
  client: Anthropic,
  batchId: string,
): Promise<Map<string, string | { error: string }>> {
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

function dumpResultsSidecar(results: Map<string, string | { error: string }>): void {
  const obj: Record<string, string | { error: string }> = {};
  for (const [k, v] of results) obj[k] = v;
  const tmp = BATCH_RESULTS_PATH + '.tmp';
  writeFileSync(tmp, JSON.stringify(obj, null, 2));
  renameSync(tmp, BATCH_RESULTS_PATH);
  console.log(`[fetch] sidecar written: ${BATCH_RESULTS_PATH}`);
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

// ---------------------------------------------------------------------------
// Sample mode (synchronous Messages API, 3 calls)
// ---------------------------------------------------------------------------

async function runSample(
  client: Anthropic,
  systemPrompt: string,
  corpus: Corpus,
): Promise<void> {
  const byId = new Map(corpus.items.map(it => [it.id, it]));
  const rawResults: Record<string, string> = {};
  const reviewSections: string[] = [];

  reviewSections.push('# Tocqueville translation — gate-1 sample results');
  reviewSections.push('');
  reviewSections.push(`Generated: ${new Date().toISOString()}`);
  reviewSections.push(`Model: ${MODEL}`);
  reviewSections.push(`System prompt: prompts/tocqueville-translation-system.md (${PROMPT_VERSION})`);
  reviewSections.push(`Sample size: ${SAMPLE_SPECS.length} item slices`);
  reviewSections.push('');
  reviewSections.push('Each section shows: coverage note, item header, French source, English translation,');
  reviewSections.push('any postprocess warnings, and any READING / TEXTURE / TERM flags emitted by the model.');
  reviewSections.push('');
  reviewSections.push('**Owner review checklist (gate-1 for Phase 4):**');
  reviewSections.push('');
  reviewSections.push('- [ ] Register matches the brief (Orwell/Didion/Wilson/Walzer/Baldwin, formal but not academic)');
  reviewSections.push('- [ ] No abstraction floats free — every abstract claim has a concrete anchor');
  reviewSections.push('- [ ] Tocqueville\'s analytical detachment preserved; irony dry, not marked');
  reviewSections.push('- [ ] Periodic sentences kept where the English can sustain them');
  reviewSections.push('- [ ] No verbatim French-clause gloss — meaning rendered as English prose');
  reviewSections.push('- [ ] Standing terms: *moeurs* italicized + first-occurrence translator\'s note; *liberté* → liberty; *association* → association');
  reviewSections.push('- [ ] Inline footnote markers ([1], [A], [163], etc.) preserved at equivalent points');
  reviewSections.push('- [ ] Flags surface genuine decisions, not routine word choices');
  reviewSections.push('- [ ] No editorialization, no smoothing, no added explanatory material outside translator\'s notes');
  reviewSections.push('');
  reviewSections.push('---');
  reviewSections.push('');

  for (const spec of SAMPLE_SPECS) {
    const item = byId.get(spec.item_id);
    if (!item) throw new Error(`sample item not in corpus: ${spec.item_id}`);
    if (item.tocqueville.volume !== TARGET_VOLUME) {
      throw new Error(`sample item ${spec.item_id} is not in Volume ${TARGET_VOLUME}`);
    }

    const indices: number[] =
      spec.paragraph_indices === 'all'
        ? item.paragraphs.map((_, i) => i)
        : spec.paragraph_indices;

    const paragraphInclusions: ParagraphInclusion[] = indices.map(i => {
      if (i < 0 || i >= item.paragraphs.length) {
        throw new Error(`sample paragraph index ${i} out of range for ${spec.item_id} (paragraphs.length=${item.paragraphs.length})`);
      }
      return { paragraph_index: i, french: item.paragraphs[i] };
    });

    // Include any footnotes whose markers are referenced inline in the
    // selected paragraph slice. End-note items typically have nested
    // footnotes too (notes.A has [163] referenced inline in para 1).
    const referencedMarkers = new Set(inlineMarkersIn(paragraphInclusions.map(p => p.french)));
    const fnsToInclude = (item.footnotes ?? []).filter(fn => referencedMarkers.has(fn.marker));

    const userMessage = buildUserMessage(item, paragraphInclusions, fnsToInclude);

    console.log(`[sample] ${item.id} — ${indices.length} paragraph(s), ${fnsToInclude.length} footnote(s)…`);
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    });
    const rawText = response.content
      .filter(b => b.type === 'text')
      .map(b => (b as { type: 'text'; text: string }).text)
      .join('');
    rawResults[item.id] = rawText;

    const parsed = parseItemOutput(rawText, item.id);

    reviewSections.push(`## ${item.id}`);
    reviewSections.push('');
    reviewSections.push(`**Coverage:** ${spec.note}`);
    reviewSections.push(`**Title:** ${item.title}`);
    reviewSections.push(`**Kind:** ${item.tocqueville.kind} | **Tome:** ${item.tocqueville.tome} | **Part:** ${item.tocqueville.part ?? 'null'} | **Chapter:** ${item.tocqueville.chapter ?? 'null'}`);
    reviewSections.push(`**Paragraphs translated:** ${indices.length}${spec.paragraph_indices === 'all' ? ' (all)' : ` (indices ${indices.join(', ')})`}`);
    reviewSections.push(`**Footnotes translated:** ${fnsToInclude.length}${fnsToInclude.length > 0 ? ` (markers: ${fnsToInclude.map(f => f.marker).join(', ')})` : ''}`);
    reviewSections.push('');

    for (const incl of paragraphInclusions) {
      const slot = parsed.paragraphs.find(s => s.paragraph_index === incl.paragraph_index);
      reviewSections.push(`### Paragraph ${incl.paragraph_index}`);
      reviewSections.push('');
      reviewSections.push('**Source (French):**');
      reviewSections.push('');
      reviewSections.push('> ' + incl.french.replace(/\n/g, '\n> '));
      reviewSections.push('');
      reviewSections.push('**Translation:**');
      reviewSections.push('');
      if (!slot) {
        reviewSections.push('**MISSING:** no parsed translation block for this paragraph index.');
        reviewSections.push('');
        continue;
      }
      reviewSections.push('> ' + slot.translation.replace(/\n/g, '\n> '));
      reviewSections.push('');
      const markerWarn = checkMarkerPreservation(incl.french, slot.translation, `paragraph ${incl.paragraph_index}`);
      if (slot.flags.length > 0) {
        reviewSections.push('**Flags:**');
        reviewSections.push('');
        for (const f of slot.flags) {
          reviewSections.push(
            f.french !== null
              ? `- *${f.kind}* — *${f.french}* — ${f.note}`
              : `- *${f.kind}* — ${f.note}`,
          );
        }
        reviewSections.push('');
      } else {
        reviewSections.push('**Flags:** none');
        reviewSections.push('');
      }
      if (markerWarn.length > 0) {
        reviewSections.push('**Marker check:**');
        for (const w of markerWarn) reviewSections.push(`- ${w}`);
        reviewSections.push('');
      }
    }

    for (const fn of fnsToInclude) {
      const slot = parsed.footnotes.find(s => s.marker === fn.marker);
      reviewSections.push(`### Footnote ${fn.marker}`);
      reviewSections.push('');
      reviewSections.push('**Source (French):**');
      reviewSections.push('');
      reviewSections.push('> ' + fn.paragraphs.join('\n\n').replace(/\n/g, '\n> '));
      reviewSections.push('');
      reviewSections.push('**Translation:**');
      reviewSections.push('');
      if (!slot) {
        reviewSections.push('**MISSING:** no parsed translation block for this footnote.');
        reviewSections.push('');
        continue;
      }
      reviewSections.push('> ' + slot.paragraphs.join('\n\n').replace(/\n/g, '\n> '));
      reviewSections.push('');
      if (slot.flags.length > 0) {
        reviewSections.push('**Flags:**');
        reviewSections.push('');
        for (const f of slot.flags) {
          reviewSections.push(
            f.french !== null
              ? `- *${f.kind}* — *${f.french}* — ${f.note}`
              : `- *${f.kind}* — ${f.note}`,
          );
        }
        reviewSections.push('');
      } else {
        reviewSections.push('**Flags:** none');
        reviewSections.push('');
      }
    }

    if (parsed.warnings.length > 0) {
      reviewSections.push('**Parse warnings:**');
      for (const w of parsed.warnings) reviewSections.push(`- ${w}`);
      reviewSections.push('');
    }

    reviewSections.push('<details><summary>Raw model output</summary>');
    reviewSections.push('');
    reviewSections.push('```');
    reviewSections.push(rawText);
    reviewSections.push('```');
    reviewSections.push('');
    reviewSections.push('</details>');
    reviewSections.push('');
    reviewSections.push('---');
    reviewSections.push('');
  }

  // Persist raw outputs for replay.
  mkdirSync(dirname(SAMPLE_RAW_PATH), { recursive: true });
  const rawTmp = SAMPLE_RAW_PATH + '.tmp';
  writeFileSync(rawTmp, JSON.stringify(rawResults, null, 2));
  renameSync(rawTmp, SAMPLE_RAW_PATH);
  console.log(`[sample] raw outputs written: ${SAMPLE_RAW_PATH}`);

  const reviewText = reviewSections.join('\n');
  const reviewTmp = SAMPLE_RESULTS_PATH + '.tmp';
  writeFileSync(reviewTmp, reviewText);
  renameSync(reviewTmp, SAMPLE_RESULTS_PATH);
  console.log(`[sample] review file written: ${SAMPLE_RESULTS_PATH}`);

  // Echo to stdout per brief.
  console.log('');
  console.log('============================================================');
  console.log('=== SAMPLE REVIEW (also written to translation-sample-results.md) ===');
  console.log('============================================================');
  console.log('');
  console.log(reviewText);
}

// ---------------------------------------------------------------------------
// Retry mode (synchronous Messages API, splice paragraph into sidecar)
// ---------------------------------------------------------------------------

async function retryOne(
  client: Anthropic,
  systemPrompt: string,
  corpus: Corpus,
  itemId: string,
  paragraphIndex: number,
): Promise<void> {
  const item = corpus.items.find(it => it.id === itemId);
  if (!item) throw new Error(`item ${itemId} not found in corpus`);
  if (item.tocqueville.volume !== TARGET_VOLUME) {
    throw new Error(`item ${itemId} is in Volume ${item.tocqueville.volume}; retry is restricted to Volume ${TARGET_VOLUME}`);
  }
  if (paragraphIndex < 0 || paragraphIndex >= item.paragraphs.length) {
    throw new Error(`paragraph index ${paragraphIndex} out of range for ${itemId} (paragraphs.length=${item.paragraphs.length})`);
  }

  if (!existsSync(BATCH_RESULTS_PATH)) {
    throw new Error(`--retry requires the sidecar to exist at ${BATCH_RESULTS_PATH}`);
  }
  const sidecar = JSON.parse(readFileSync(BATCH_RESULTS_PATH, 'utf8')) as Record<string, string | { error: string }>;
  const customId = encodeCustomId(itemId);
  const before = sidecar[customId];
  if (before === undefined) {
    throw new Error(`sidecar has no entry for ${itemId} (custom_id ${customId}); --retry only updates existing entries`);
  }
  if (typeof before !== 'string') {
    throw new Error(`sidecar entry for ${itemId} is an error record, not a translation: ${JSON.stringify(before)}`);
  }

  console.log(`[retry] ${itemId} paragraph ${paragraphIndex}`);
  const target = item.paragraphs[paragraphIndex];
  console.log(`[retry] source (${target.length} chars): ${target.slice(0, 160)}${target.length > 160 ? '…' : ''}`);

  // Build a single-paragraph user message. Footnotes whose markers are
  // inline-referenced by the target paragraph are included so the model has
  // the full context the original full-item call had for that marker.
  const referenced = new Set(inlineMarkersIn([target]));
  const fnsToInclude = (item.footnotes ?? []).filter(fn => referenced.has(fn.marker));
  const userMessage = buildUserMessage(
    item,
    [{ paragraph_index: paragraphIndex, french: target }],
    fnsToInclude,
  );

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  });
  const rawText = response.content
    .filter(b => b.type === 'text')
    .map(b => (b as { type: 'text'; text: string }).text)
    .join('');

  const parsedNew = parseItemOutput(rawText, itemId);
  const newSlot = parsedNew.paragraphs.find(s => s.paragraph_index === paragraphIndex);
  if (!newSlot) {
    throw new Error(
      `[retry] could not parse a "### Paragraph ${paragraphIndex}" block from the model output. Raw output:\n${rawText}`,
    );
  }

  // Splice the new block into the existing sidecar entry's raw text.
  const updatedRaw = spliceParagraphBlock(before, paragraphIndex, rawText, itemId);

  sidecar[customId] = updatedRaw;
  const tmp = BATCH_RESULTS_PATH + '.tmp';
  writeFileSync(tmp, JSON.stringify(sidecar, null, 2));
  renameSync(tmp, BATCH_RESULTS_PATH);
  console.log(`[retry] sidecar updated for ${itemId} paragraph ${paragraphIndex}`);

  // Report what changed.
  const parsedBefore = parseItemOutput(before, itemId);
  const oldSlot = parsedBefore.paragraphs.find(s => s.paragraph_index === paragraphIndex);
  console.log('');
  console.log('--- BEFORE (parsed translation for this paragraph) ---');
  console.log(oldSlot?.translation ?? '(no prior translation for this index)');
  console.log('');
  console.log('--- AFTER (parsed translation for this paragraph) ---');
  console.log(newSlot.translation);
  console.log('');
  if (newSlot.flags.length > 0) {
    console.log('Flags:');
    for (const f of newSlot.flags) {
      console.log(
        f.french !== null
          ? `  [${f.kind}] ${f.french} — ${f.note}`
          : `  [${f.kind}] ${f.note}`,
      );
    }
  } else {
    console.log('Flags: none');
  }
  const markerWarn = checkMarkerPreservation(target, newSlot.translation, `paragraph ${paragraphIndex}`);
  if (markerWarn.length > 0) {
    console.log('');
    console.log('Marker check:');
    for (const w of markerWarn) console.log(`  ${w}`);
  }
}

// Replace the `### Paragraph <N>` block in `existingRaw` with the matching
// block from `newRaw`. If `existingRaw` has no such block, append it.
function spliceParagraphBlock(
  existingRaw: string,
  paragraphIndex: number,
  newRaw: string,
  itemId: string,
): string {
  const newBlock = extractParagraphBlock(newRaw, paragraphIndex);
  if (newBlock === null) {
    throw new Error(`[splice] no "### Paragraph ${paragraphIndex}" heading in retry output for ${itemId}`);
  }

  const lines = existingRaw.split('\n');
  const startRe = new RegExp(`^###\\s+Paragraph\\s+${paragraphIndex}\\s*$`);
  const otherStartRe = /^###\s+(Paragraph|Footnote)\b/;
  let start = -1;
  let end = lines.length;
  for (let i = 0; i < lines.length; i++) {
    if (startRe.test(lines[i])) {
      start = i;
      break;
    }
  }
  if (start === -1) {
    // No prior block — append the new block at the end.
    return existingRaw.replace(/\s*$/, '') + '\n\n' + newBlock + '\n';
  }
  for (let i = start + 1; i < lines.length; i++) {
    if (otherStartRe.test(lines[i])) {
      end = i;
      break;
    }
  }
  const before = lines.slice(0, start).join('\n').replace(/\s+$/, '');
  const after = lines.slice(end).join('\n').replace(/^\s+/, '');
  const middle = newBlock.trim();
  return [before, middle, after].filter(s => s.length > 0).join('\n\n') + '\n';
}

function extractParagraphBlock(raw: string, paragraphIndex: number): string | null {
  const lines = raw.split('\n');
  const startRe = new RegExp(`^###\\s+Paragraph\\s+${paragraphIndex}\\s*$`);
  const otherStartRe = /^###\s+(Paragraph|Footnote)\b/;
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (startRe.test(lines[i])) {
      start = i;
      break;
    }
  }
  if (start === -1) return null;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (otherStartRe.test(lines[i])) {
      end = i;
      break;
    }
  }
  return lines.slice(start, end).join('\n').replace(/\s+$/, '');
}

// ---------------------------------------------------------------------------
// Apply mode
// ---------------------------------------------------------------------------

function applyToCorpus(corpus: Corpus): void {
  const results = readResultsSidecar();
  console.log(`[apply] read ${results.size} results from sidecar`);

  const systemPrompt = extractPrompt(PROMPT_PATH);
  const promptSha256 = createHash('sha256').update(systemPrompt).digest('hex');

  const volumeOneItems = corpus.items.filter(it => it.tocqueville.volume === TARGET_VOLUME);
  console.log(`[apply] Volume ${TARGET_VOLUME} items in corpus: ${volumeOneItems.length}`);

  const parsedByItem = new Map<string, ParsedItem>();
  const failures: string[] = [];

  for (const item of volumeOneItems) {
    const cid = encodeCustomId(item.id);
    const r = results.get(cid);
    if (r === undefined) {
      failures.push(`${item.id} (custom_id ${cid}): no result in sidecar`);
      continue;
    }
    if (typeof r !== 'string') {
      failures.push(`${item.id} (custom_id ${cid}): ${('error' in r) ? r.error : 'unknown error'}`);
      continue;
    }
    const parsed = parseItemOutput(r, item.id);
    parsedByItem.set(item.id, parsed);
  }

  if (failures.length > 0) {
    console.error(`[apply] ABORTING: ${failures.length} failures, no write performed:`);
    for (const f of failures) console.error(`  - ${f}`);
    throw new Error('aborted before write — see failures above');
  }

  // Build complete translation + footnotes_translation for each item, with
  // strict shape checks. Verification per the brief is fatal, not warning.
  const annotationsItems: ItemAnnotations[] = [];
  const verificationErrors: string[] = [];
  const verificationWarnings: string[] = [];

  for (const item of volumeOneItems) {
    const parsed = parsedByItem.get(item.id)!;
    // Paragraphs
    const translation: string[] = new Array(item.paragraphs.length);
    const paragraphAnnotations: ParagraphAnnotation[] = [];
    for (let i = 0; i < item.paragraphs.length; i++) {
      const slot = parsed.paragraphs.find(s => s.paragraph_index === i);
      if (!slot) {
        verificationErrors.push(`${item.id}: missing translation for paragraph ${i}`);
        translation[i] = '';
        paragraphAnnotations.push({
          paragraph_index: i,
          flags: [],
          editorial_status: null,
          editorial_note: null,
        });
        continue;
      }
      translation[i] = slot.translation;
      paragraphAnnotations.push({
        paragraph_index: i,
        flags: slot.flags.map(f => ({ kind: f.kind, french: f.french, note: f.note })),
        editorial_status: null,
        editorial_note: null,
      });
      const markerWarn = checkMarkerPreservation(
        item.paragraphs[i],
        slot.translation,
        `${item.id} paragraph ${i}`,
      );
      verificationErrors.push(...markerWarn);
    }
    if (translation.length !== item.paragraphs.length) {
      verificationErrors.push(
        `${item.id}: translation.length ${translation.length} !== paragraphs.length ${item.paragraphs.length}`,
      );
    }

    // Footnotes
    const fnTranslations: Footnote[] = [];
    const footnoteAnnotations: FootnoteAnnotation[] = [];
    for (const fn of item.footnotes ?? []) {
      const slot = parsed.footnotes.find(s => s.marker === fn.marker);
      if (!slot) {
        verificationErrors.push(`${item.id}: missing translation for footnote ${fn.marker}`);
        fnTranslations.push({ marker: fn.marker, paragraphs: [] });
        footnoteAnnotations.push({
          marker: fn.marker,
          flags: [],
          editorial_status: null,
          editorial_note: null,
        });
        continue;
      }
      fnTranslations.push({ marker: fn.marker, paragraphs: slot.paragraphs });
      footnoteAnnotations.push({
        marker: fn.marker,
        flags: slot.flags.map(f => ({ kind: f.kind, french: f.french, note: f.note })),
        editorial_status: null,
        editorial_note: null,
      });
    }

    item.tocqueville.translation = translation;
    item.tocqueville.footnotes_translation = fnTranslations;

    annotationsItems.push({
      item_id: item.id,
      paragraphs: paragraphAnnotations,
      footnotes: footnoteAnnotations,
    });

    // Soft warning: any extra translated paragraphs not present in source.
    for (const slot of parsed.paragraphs) {
      if (slot.paragraph_index >= item.paragraphs.length) {
        verificationWarnings.push(`${item.id}: model emitted paragraph_index ${slot.paragraph_index} but source only has ${item.paragraphs.length} paragraphs`);
      }
    }
  }

  // Volume II untouched check.
  for (const item of corpus.items) {
    if (item.tocqueville.volume !== TARGET_VOLUME) {
      if (item.tocqueville.translation !== null) {
        verificationErrors.push(`${item.id}: Volume ${item.tocqueville.volume} item should have translation === null, but is not null`);
      }
    }
  }

  if (annotationsItems.length !== volumeOneItems.length) {
    verificationErrors.push(
      `annotations item count ${annotationsItems.length} !== Volume ${TARGET_VOLUME} item count ${volumeOneItems.length}`,
    );
  }

  if (verificationErrors.length > 0) {
    console.error(`[apply] ABORTING: ${verificationErrors.length} verification errors, no write performed:`);
    for (const e of verificationErrors) console.error(`  - ${e}`);
    throw new Error('verification failed — see errors above');
  }
  if (verificationWarnings.length > 0) {
    console.warn(`[apply] ${verificationWarnings.length} verification warnings (non-fatal):`);
    for (const w of verificationWarnings) console.warn(`  - ${w}`);
  }

  // Write annotations file first (abort-on-existing if applicable).
  if (existsSync(ANNOTATIONS_PATH)) {
    throw new Error(
      `Refusing to overwrite existing ${ANNOTATIONS_PATH}. Delete the file and re-run --apply to regenerate from scratch.`,
    );
  }
  const annotations: TocquevilleAnnotations = {
    corpus: 'tocqueville',
    generated_at: new Date().toISOString(),
    prompt_version: PROMPT_VERSION,
    prompt_sha256: promptSha256,
    volume: TARGET_VOLUME,
    items: annotationsItems,
  };
  const annTmp = ANNOTATIONS_PATH + '.tmp';
  writeFileSync(annTmp, JSON.stringify(annotations, null, 2) + '\n');
  renameSync(annTmp, ANNOTATIONS_PATH);
  console.log(`[annotations] atomic rename complete: ${ANNOTATIONS_PATH}`);

  // Now write the corpus atomically.
  const corpusTmp = TOCQUEVILLE_PATH + '.tmp';
  writeFileSync(corpusTmp, JSON.stringify(corpus, null, 2) + '\n');
  renameSync(corpusTmp, TOCQUEVILLE_PATH);
  console.log(`[corpus] atomic rename complete: ${TOCQUEVILLE_PATH}`);

  summarize(corpus, annotations);

  if (existsSync(BATCH_RESULTS_PATH)) unlinkSync(BATCH_RESULTS_PATH);
  clearState();
  console.log('[apply] sidecar and state cleared.');
}

function summarize(corpus: Corpus, ann: TocquevilleAnnotations): void {
  let totalParagraphs = 0;
  let totalFootnotes = 0;
  const flagCounts: Record<FlagKind, number> = { READING: 0, TEXTURE: 0, TERM: 0 };
  const itemsWithZeroFlags: string[] = [];
  for (const itemAnn of ann.items) {
    let itemFlags = 0;
    for (const p of itemAnn.paragraphs) {
      totalParagraphs++;
      for (const f of p.flags) {
        flagCounts[f.kind]++;
        itemFlags++;
      }
    }
    for (const fn of itemAnn.footnotes) {
      totalFootnotes++;
      for (const f of fn.flags) {
        flagCounts[f.kind]++;
        itemFlags++;
      }
    }
    if (itemFlags === 0) itemsWithZeroFlags.push(itemAnn.item_id);
  }
  const total = flagCounts.READING + flagCounts.TEXTURE + flagCounts.TERM;
  console.log('');
  console.log('=== TRANSLATION SUMMARY ===');
  console.log(`Volume ${TARGET_VOLUME} items translated: ${ann.items.length}`);
  console.log(`Total paragraphs:        ${totalParagraphs}`);
  console.log(`Total footnotes:         ${totalFootnotes}`);
  console.log('');
  console.log('Flag counts by kind:');
  console.log(`  READING: ${flagCounts.READING}`);
  console.log(`  TEXTURE: ${flagCounts.TEXTURE}`);
  console.log(`  TERM:    ${flagCounts.TERM}`);
  console.log(`  TOTAL:   ${total}`);
  console.log('');
  if (itemsWithZeroFlags.length > 0) {
    console.log(`Items with zero flags (${itemsWithZeroFlags.length}):`);
    for (const id of itemsWithZeroFlags) console.log(`  - ${id}`);
  } else {
    console.log('Items with zero flags: none');
  }
  console.log('===========================');
  void corpus; // referenced for future cross-checks
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  loadEnv();
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('missing env: ANTHROPIC_API_KEY (expected in .env.local)');
    process.exit(2);
  }

  const corpus: Corpus = JSON.parse(readFileSync(TOCQUEVILLE_PATH, 'utf8'));

  if (isRetry && (isApply || isSample || isResume || isReset)) {
    console.error('[main] --retry is incompatible with --apply / --sample / --resume / --reset');
    process.exit(2);
  }

  if (isApply) {
    if (isSample) {
      console.error('[main] --apply is incompatible with --sample (sample mode does not write back to the corpus).');
      process.exit(2);
    }
    applyToCorpus(corpus);
    return;
  }

  const systemPrompt = extractPrompt(PROMPT_PATH);
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  if (isRetry) {
    await retryOne(client, systemPrompt, corpus, retryItemIdArg!, Number(retryParaIdxArg));
    return;
  }

  if (isSample) {
    await runSample(client, systemPrompt, corpus);
    return;
  }

  // Default: full Volume I batch submission.
  let state = readState();
  const requests = buildFullRequests(corpus);

  if (state) {
    console.log(`[main] resuming existing batch ${state.batch_id} (${state.request_count} requests)`);
  } else if (isResume) {
    console.error('[main] --resume passed but no state file found at ' + STATE_PATH);
    process.exit(2);
  } else {
    console.log(`[main] no state file — submitting new full batch with ${requests.length} requests`);
    state = await submitBatch(client, systemPrompt, corpus, requests);
  }

  await pollUntilEnded(client, state.batch_id);
  console.log(`[main] batch ended; fetching results…`);
  const results = await fetchResults(client, state.batch_id);
  console.log(`[main] received ${results.size} results`);

  dumpResultsSidecar(results);
  console.log(`[main] full mode fetch complete.`);
  console.log(`[main] To write translations back into the corpus, run:`);
  console.log(`[main]   node --experimental-strip-types scripts/generate-translation.ts --apply`);
}

// Direct-invocation guard — see generate-plain-english.ts for the prior
// incident this guard exists to prevent. Importing this module must NOT
// auto-run main().
const isDirectInvocation =
  typeof process.argv[1] === 'string' &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectInvocation) {
  main().catch(err => {
    console.error('[fatal]', err);
    process.exit(1);
  });
}
