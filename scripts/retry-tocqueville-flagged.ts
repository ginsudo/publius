// Phase 4 Tocqueville retry runner for flagged_for_rewrite units.
//
// Reads data/tocqueville/tocqueville-annotations.json, finds every paragraph
// and footnote with editorial_status === 'flagged_for_rewrite', filters out
// the SKIP_UNITS set (source-restoration cases where the editorial note does
// NOT supply verbatim English text, plus source-verification anomalies), and
// re-renders each remaining unit synchronously against
// prompts/tocqueville-retry-v1.md.
//
// Two-phase: fetch writes a sidecar at data/tocqueville/.retry-results.json;
// --apply is a separate invocation that writes the new renderings + flags
// back into tocqueville.json and tocqueville-annotations.json, and resets
// editorial_status / editorial_note to null for every retried unit so the
// editor can re-review them through scripts/review-annotations.ts.
//
// Run:
//   node --experimental-strip-types scripts/retry-tocqueville-flagged.ts
//   node --experimental-strip-types scripts/retry-tocqueville-flagged.ts --apply
//   node --experimental-strip-types scripts/retry-tocqueville-flagged.ts --dry-run
//
// --dry-run enumerates targets and skips without making any API calls.

import { readFileSync, writeFileSync, existsSync, renameSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline';
import Anthropic from '@anthropic-ai/sdk';
import { loadEnv, REPO_ROOT } from '../data/eval/lib.ts';
import { extractPrompt } from '../lib/ask.ts';

// ---------------------------------------------------------------------------
// Paths and constants
// ---------------------------------------------------------------------------

const TOCQUEVILLE_PATH = resolve(REPO_ROOT, 'data', 'tocqueville', 'tocqueville.json');
const ANNOTATIONS_PATH = resolve(REPO_ROOT, 'data', 'tocqueville', 'tocqueville-annotations.json');
const PROMPT_PATH = resolve(REPO_ROOT, 'prompts', 'tocqueville-retry-v1.md');
const RETRY_RESULTS_PATH = resolve(REPO_ROOT, 'data', 'tocqueville', '.retry-results.json');

// Same model + beta header as generate-translation.ts. Sync calls cap at
// SYNC_MAX_TOKENS (16K) — translation calls are small units, not full chapters.
const MODEL = 'claude-opus-4-7';
const SYNC_MAX_TOKENS = 16_000;
const BETA_HEADER = 'output-300k-2026-03-24' as const;
const TARGET_VOLUME = 1;

const TARGET_OPEN = '<<<TARGET>>>';
const TARGET_CLOSE = '<<<END_TARGET>>>';

// ---------------------------------------------------------------------------
// Types (subset of generate-translation.ts; duplicated to keep this standalone)
// ---------------------------------------------------------------------------

type FlagKind = 'READING' | 'TEXTURE' | 'TERM';
type EditorialStatus = null | 'accepted' | 'edited' | 'flagged_for_rewrite';

type Flag = { kind: FlagKind; french: string | null; note: string };

type Footnote = { marker: string; paragraphs: string[] };

type TocquevilleItem = {
  id: string;
  paragraphs: string[];
  footnotes: Footnote[];
  tocqueville: {
    volume: 1 | 2;
    translation: string[] | null;
    footnotes_translation?: Footnote[];
    // Other fields preserved; we never write to them.
    [k: string]: unknown;
  };
  [k: string]: unknown;
};

type Corpus = {
  corpus: 'tocqueville';
  source: Record<string, unknown>;
  count: number;
  items: TocquevilleItem[];
};

type ParagraphAnnotation = {
  paragraph_index: number;
  flags: Flag[];
  editorial_status: EditorialStatus;
  editorial_note: string | null;
  // triage_* fields preserved; we never write to them.
  [k: string]: unknown;
};

type FootnoteAnnotation = {
  marker: string;
  flags: Flag[];
  editorial_status: EditorialStatus;
  editorial_note: string | null;
  [k: string]: unknown;
};

type ItemAnnotations = {
  item_id: string;
  paragraphs: ParagraphAnnotation[];
  footnotes: FootnoteAnnotation[];
};

type TocquevilleAnnotations = {
  corpus: 'tocqueville';
  volume: 1;
  items: ItemAnnotations[];
  [k: string]: unknown;
};

// ---------------------------------------------------------------------------
// Skip list — units the retry runner deliberately does not process.
//
// Cluster A: source-restoration cases where the editorial note does NOT
// supply the verbatim English text (only the cases where the note DOES
// supply verbatim text are auto-processed: Preamble, 1st/5th/10th Amendments,
// Article II §4, and notes.O ¶? cases with full text inline).
//
// Cluster F: source-verification anomalies that require Pagnerre / APS /
// other external scholarship before any change is safe.
//
// Both clusters become a separate manual workflow handled by the editor.
// ---------------------------------------------------------------------------

type SkipEntry = {
  item_id: string;
  kind: 'paragraph' | 'footnote';
  locator: string; // ¶<index> for paragraphs, [<marker>] for footnotes
  reason: string;
};

const SKIP_UNITS: SkipEntry[] = [
  // Cluster A — source restoration without verbatim English in editorial note
  { item_id: 'tocqueville:vol1.part1.ch1',  kind: 'footnote',  locator: '[18]', reason: 'A: Jefferson Notes Q VI — first quotation not verbatim in editorial note' },
  { item_id: 'tocqueville:vol1.part1.ch2',  kind: 'paragraph', locator: '¶36',  reason: 'A: Mayflower Compact — Avalon Project text not in editorial note' },
  { item_id: 'tocqueville:vol1.t1.notes.G', kind: 'paragraph', locator: '¶0',   reason: 'A: Jefferson Memoirs — source text not in editorial note' },
  { item_id: 'tocqueville:vol1.t1.notes.G', kind: 'paragraph', locator: '¶2',   reason: 'A: Kent Commentaries — source text not in editorial note' },
  { item_id: 'tocqueville:vol1.t1.notes.G', kind: 'paragraph', locator: '¶5',   reason: 'A: Kent Commentaries closing — source text not in editorial note' },
  { item_id: 'tocqueville:vol1.t1.notes.G', kind: 'paragraph', locator: '¶7',   reason: 'A: NY Revised Statutes vol. 3 Appendix p. 51 — source text not in editorial note' },
  { item_id: 'tocqueville:vol1.t1.notes.K', kind: 'paragraph', locator: '¶4',   reason: 'A: Jefferson to Madison 28 Aug 1789 — source text not in editorial note' },
  { item_id: 'tocqueville:vol1.t1.notes.M', kind: 'paragraph', locator: '¶3',   reason: 'A: Blackstone Commentaries Bk I ch 2 — source text not in editorial note' },
  { item_id: 'tocqueville:vol1.t1.notes.N', kind: 'paragraph', locator: '¶5',   reason: 'A: MA/NC/VA constitutions — source text not in editorial note' },
  { item_id: 'tocqueville:vol1.t1.notes.N', kind: 'paragraph', locator: '¶6',   reason: 'A: NH constitution p. 105 — source text not in editorial note' },
  { item_id: 'tocqueville:vol1.t1.notes.N', kind: 'paragraph', locator: '¶8',   reason: 'A: SC/KY/TN/OH/LA/MS/AL/PA constitutions — source text not in editorial note' },
  { item_id: 'tocqueville:vol1.t1.notes.O', kind: 'paragraph', locator: '¶8',   reason: 'A: Article I Section 1 — only fragment supplied in editorial note' },
  { item_id: 'tocqueville:vol1.t1.notes.O', kind: 'paragraph', locator: '¶258', reason: 'A: State constitutional provision (source unidentified)' },
  { item_id: 'tocqueville:vol1.t1.notes.O', kind: 'paragraph', locator: '¶266', reason: 'A: State constitutional provision (source unidentified)' },
  { item_id: 'tocqueville:vol1.t1.notes.O', kind: 'paragraph', locator: '¶267', reason: 'A: State constitutional provision (source unidentified)' },
  { item_id: 'tocqueville:vol1.part2.ch7',  kind: 'paragraph', locator: '¶100', reason: 'A: Federalist 51 (Madison) — source text not in editorial note' },
  { item_id: 'tocqueville:vol1.part2.ch7',  kind: 'paragraph', locator: '¶101', reason: 'A: Federalist 51 (Madison) continuation — source text not in editorial note' },
  { item_id: 'tocqueville:vol1.part2.ch7',  kind: 'paragraph', locator: '¶102', reason: 'A: Jefferson quotation — source unidentified' },
  { item_id: 'tocqueville:vol1.part2.ch8',  kind: 'footnote',  locator: '[31]', reason: 'A: Story Commentaries Bk III ch XXXVIII — source text not in editorial note' },
  { item_id: 'tocqueville:vol1.t2.notes.A', kind: 'paragraph', locator: '¶3',   reason: 'A: Massachusetts General Assembly committee report on New England Courant — source text not in editorial note' },

  // Cluster F — source-verification anomalies (Pagnerre / APS / external scholarship)
  { item_id: 'tocqueville:vol1.part1.ch8',  kind: 'paragraph', locator: '¶58',  reason: 'F: constatation → constitution — printer\'s error emendation needs Pagnerre verification' },
  { item_id: 'tocqueville:vol1.t1.notes.C', kind: 'paragraph', locator: '¶13',  reason: 'F: Geiberger / Zeisberger identification — needs APS Memoirs vol. 3 confirmation' },
  { item_id: 'tocqueville:vol1.t1.notes.F', kind: 'paragraph', locator: '¶63',  reason: 'F: M. Varden — identity uncertain, do not guess' },
  { item_id: 'tocqueville:vol1.part2.ch3',  kind: 'paragraph', locator: '¶48',  reason: 'F: l\'un / l\'autre referents unclear — needs Pagnerre verification' },
  { item_id: 'tocqueville:vol1.part2.ch3',  kind: 'paragraph', locator: '¶49',  reason: 'F: placement anomaly — needs Pagnerre verification' },
  { item_id: 'tocqueville:vol1.part2.ch3',  kind: 'footnote',  locator: '[2]',  reason: 'F: conviction réfléchie et maîtresse d\'elle — possible truncation, needs Pagnerre verification' },
];

function skipKey(item_id: string, kind: 'paragraph' | 'footnote', locator: string): string {
  return `${item_id}|${kind}|${locator}`;
}

const SKIP_MAP = new Map(SKIP_UNITS.map(e => [skipKey(e.item_id, e.kind, e.locator), e]));

// ---------------------------------------------------------------------------
// CLI parsing
// ---------------------------------------------------------------------------

const argv = process.argv.slice(2);
const FLAGS = new Set(argv);
const isApply = FLAGS.has('--apply');
const isDryRun = FLAGS.has('--dry-run');

if (isApply && isDryRun) {
  console.error('--apply and --dry-run are incompatible');
  process.exit(2);
}

// ---------------------------------------------------------------------------
// Retry target discovery
// ---------------------------------------------------------------------------

type RetryTarget = {
  item_id: string;
  kind: 'paragraph' | 'footnote';
  locator: string;
  paragraph_index: number | null;
  marker: string | null;
  target_french: string;
  prior_translation: string;
  editorial_note: string;
  prior_flags: Flag[];
  custom_id: string;
};

type SkipRecord = { item_id: string; kind: 'paragraph' | 'footnote'; locator: string; reason: string };

function findRetryTargets(
  corpus: Corpus,
  ann: TocquevilleAnnotations,
): { targets: RetryTarget[]; skipped: SkipRecord[]; unmatchedSkips: SkipEntry[] } {
  const byId = new Map(corpus.items.map(it => [it.id, it]));
  const targets: RetryTarget[] = [];
  const skipped: SkipRecord[] = [];
  const matchedKeys = new Set<string>();

  for (const itemAnn of ann.items) {
    const item = byId.get(itemAnn.item_id);
    if (!item) throw new Error(`annotations reference ${itemAnn.item_id} but corpus has no such item`);
    if (item.tocqueville.volume !== TARGET_VOLUME) continue;

    for (const p of itemAnn.paragraphs) {
      if (p.editorial_status !== 'flagged_for_rewrite') continue;
      const locator = `¶${p.paragraph_index}`;
      const key = skipKey(itemAnn.item_id, 'paragraph', locator);
      const skipEntry = SKIP_MAP.get(key);
      if (skipEntry) {
        matchedKeys.add(key);
        skipped.push({ item_id: itemAnn.item_id, kind: 'paragraph', locator, reason: skipEntry.reason });
        continue;
      }
      const french = item.paragraphs[p.paragraph_index];
      if (french === undefined) {
        throw new Error(`${itemAnn.item_id} paragraph ${p.paragraph_index} not found in corpus`);
      }
      const trans = item.tocqueville.translation?.[p.paragraph_index];
      if (trans === undefined || trans === null) {
        throw new Error(`${itemAnn.item_id} paragraph ${p.paragraph_index} has no prior translation`);
      }
      targets.push({
        item_id: itemAnn.item_id,
        kind: 'paragraph',
        locator,
        paragraph_index: p.paragraph_index,
        marker: null,
        target_french: french,
        prior_translation: trans,
        editorial_note: p.editorial_note ?? '',
        prior_flags: p.flags,
        custom_id: `${itemAnn.item_id}|paragraph|${p.paragraph_index}`,
      });
    }

    for (const fn of itemAnn.footnotes) {
      if (fn.editorial_status !== 'flagged_for_rewrite') continue;
      const locator = fn.marker;
      const key = skipKey(itemAnn.item_id, 'footnote', locator);
      const skipEntry = SKIP_MAP.get(key);
      if (skipEntry) {
        matchedKeys.add(key);
        skipped.push({ item_id: itemAnn.item_id, kind: 'footnote', locator, reason: skipEntry.reason });
        continue;
      }
      const sourceFn = item.footnotes.find(f => f.marker === fn.marker);
      if (!sourceFn) {
        throw new Error(`${itemAnn.item_id} footnote ${fn.marker} not found in corpus`);
      }
      const transFn = item.tocqueville.footnotes_translation?.find(f => f.marker === fn.marker);
      if (!transFn) {
        throw new Error(`${itemAnn.item_id} footnote ${fn.marker} has no prior translation`);
      }
      targets.push({
        item_id: itemAnn.item_id,
        kind: 'footnote',
        locator,
        paragraph_index: null,
        marker: fn.marker,
        target_french: sourceFn.paragraphs.join('\n\n'),
        prior_translation: transFn.paragraphs.join('\n\n'),
        editorial_note: fn.editorial_note ?? '',
        prior_flags: fn.flags,
        custom_id: `${itemAnn.item_id}|footnote|${fn.marker}`,
      });
    }
  }

  const unmatchedSkips = SKIP_UNITS.filter(e => !matchedKeys.has(skipKey(e.item_id, e.kind, e.locator)));
  return { targets, skipped, unmatchedSkips };
}

// ---------------------------------------------------------------------------
// User-message construction
// ---------------------------------------------------------------------------

function getAdjacentContext(
  item: TocquevilleItem,
  target: RetryTarget,
): { prior: string | null; next: string | null } {
  if (target.kind === 'paragraph') {
    const idx = target.paragraph_index!;
    const prior = idx > 0 ? item.paragraphs[idx - 1] : null;
    const next = idx < item.paragraphs.length - 1 ? item.paragraphs[idx + 1] : null;
    return { prior, next };
  }
  const fns = item.footnotes;
  const idx = fns.findIndex(f => f.marker === target.marker);
  if (idx < 0) return { prior: null, next: null };
  const prior = idx > 0 ? fns[idx - 1].paragraphs.join('\n\n') : null;
  const next = idx < fns.length - 1 ? fns[idx + 1].paragraphs.join('\n\n') : null;
  return { prior, next };
}

function buildUserMessage(item: TocquevilleItem, target: RetryTarget): string {
  const { prior, next } = getAdjacentContext(item, target);
  const unitLabel =
    target.kind === 'paragraph' ? `paragraph ${target.paragraph_index}` : `footnote ${target.marker}`;
  const lines: string[] = [];
  lines.push(`Item: ${item.id}`);
  lines.push(`Unit: ${unitLabel}`);
  lines.push('');
  lines.push('The prior rendering was rejected for this reason:');
  lines.push(target.editorial_note.length > 0 ? target.editorial_note : '(no editorial note recorded)');
  lines.push('');
  lines.push('Address this specifically in the new rendering.');
  lines.push('');
  if (target.prior_flags.length > 0) {
    lines.push('Flags from the prior rendering (for context only):');
    for (const f of target.prior_flags) {
      const body = f.french !== null ? `${f.french} — ${f.note}` : f.note;
      lines.push(`  [${f.kind}: ${body}]`);
    }
    lines.push('');
  }
  lines.push('CONTEXT (read-only — do NOT render):');
  lines.push('');
  if (prior !== null) {
    lines.push(`--- prior ${target.kind} ---`);
    lines.push(prior);
    lines.push('');
  } else {
    lines.push(`(target ${target.kind} is the first ${target.kind} in the item)`);
    lines.push('');
  }
  lines.push(`--- prior rendering (rejected) ---`);
  lines.push(target.prior_translation);
  lines.push('');
  if (next !== null) {
    lines.push(`--- next ${target.kind} ---`);
    lines.push(next);
    lines.push('');
  } else {
    lines.push(`(target ${target.kind} is the last ${target.kind} in the item)`);
    lines.push('');
  }
  lines.push('FRENCH SOURCE (render this one only):');
  lines.push(TARGET_OPEN);
  lines.push(target.target_french);
  lines.push(TARGET_CLOSE);
  lines.push('');
  lines.push('Return only the rendered translation, followed by any READING / TEXTURE / TERM flag lines. No preamble.');
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Postprocess (mirrors generate-translation.ts patterns)
// ---------------------------------------------------------------------------

const FOOTNOTE_MARKER_RE = /\[(?:TN-[A-Za-z]+|[A-Z]+|\d+)\]/g;
const FLAG_RE = /\[(READING|TEXTURE|TERM):\s*([^\[\]]+)\]/g;
const FLAG_BODY_QUOTED_RE = /^\s*["“]([^"”]+)["”]\s*[—–\-]\s*([\s\S]+)$/;
const FLAG_BODY_ITALIC_RE = /^\s*\*([^*]+)\*\s*[—–\-]\s*([\s\S]+)$/;

function parseFlagBody(body: string): { french: string | null; note: string } {
  const q = body.match(FLAG_BODY_QUOTED_RE);
  if (q) return { french: q[1].trim(), note: q[2].trim() };
  const i = body.match(FLAG_BODY_ITALIC_RE);
  if (i) return { french: i[1].trim(), note: i[2].trim() };
  return { french: null, note: body.trim() };
}

type PostprocessResult = {
  rendered: string;
  flags: Flag[];
  warnings: string[];
};

function postprocess(modelOutput: string, originalFrench: string): PostprocessResult {
  let text = modelOutput.trim();
  const warnings: string[] = [];

  if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith('“') && text.endsWith('”'))) {
    text = text.slice(1, -1).trim();
    warnings.push('stripped surrounding quotes');
  }

  const preambleRe = /^(Here (?:is|are)|Translation|Rendered|English)[^\n]{0,120}:\s*\n/i;
  if (preambleRe.test(text)) {
    text = text.replace(preambleRe, '').trim();
    warnings.push('stripped leading preamble line');
  }

  const flags: Flag[] = [];
  text = text.replace(FLAG_RE, (_full, kind: string, body: string) => {
    const parsed = parseFlagBody(body);
    flags.push({ kind: kind as FlagKind, french: parsed.french, note: parsed.note });
    return '';
  });
  text = text
    .split('\n')
    .map(l => l.replace(/[ \t]+$/, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();

  const origMarkers = (originalFrench.match(FOOTNOTE_MARKER_RE) || []).slice().sort();
  const rendMarkers = (text.match(FOOTNOTE_MARKER_RE) || []).slice().sort();
  if (origMarkers.join('|') !== rendMarkers.join('|')) {
    warnings.push(
      `footnote marker mismatch — source: [${origMarkers.join(', ') || 'none'}], rendered: [${rendMarkers.join(', ') || 'none'}]`,
    );
  }

  const firstWord = text.split(/\s+/)[0]?.toLowerCase() ?? '';
  if (['here', "here's", 'translation', 'rendered', 'note:'].includes(firstWord)) {
    warnings.push(`suspicious opening word "${firstWord}" — possible preamble leak`);
  }

  return { rendered: text, flags, warnings };
}

// ---------------------------------------------------------------------------
// Sidecar I/O
// ---------------------------------------------------------------------------

type SidecarEntry = { rendered_raw: string } | { error: string };
type Sidecar = Record<string, SidecarEntry>;

function readSidecar(): Sidecar {
  if (!existsSync(RETRY_RESULTS_PATH)) {
    throw new Error(`sidecar not found at ${RETRY_RESULTS_PATH} — run without --apply first.`);
  }
  return JSON.parse(readFileSync(RETRY_RESULTS_PATH, 'utf8')) as Sidecar;
}

function writeSidecar(sidecar: Sidecar): void {
  const tmp = RETRY_RESULTS_PATH + '.tmp';
  writeFileSync(tmp, JSON.stringify(sidecar, null, 2));
  renameSync(tmp, RETRY_RESULTS_PATH);
}

// ---------------------------------------------------------------------------
// Fetch phase
// ---------------------------------------------------------------------------

function logSkippedAndUnmatched(skipped: SkipRecord[], unmatchedSkips: SkipEntry[]): void {
  if (skipped.length > 0) {
    console.log('');
    console.log(`[retry] skipped units (manual workflow):`);
    for (const s of skipped) {
      console.log(`  - ${s.item_id} ${s.locator} (${s.kind}) — ${s.reason}`);
    }
  }
  if (unmatchedSkips.length > 0) {
    console.warn('');
    console.warn(`[retry] WARNING: ${unmatchedSkips.length} SKIP_UNITS entries did not match any flagged_for_rewrite unit:`);
    for (const u of unmatchedSkips) {
      console.warn(`  - ${u.item_id} ${u.locator} (${u.kind}) — ${u.reason}`);
    }
    console.warn(`[retry] (these entries are stale or wrong — review SKIP_UNITS)`);
  }
}

async function fetchPhase(): Promise<void> {
  if (!existsSync(PROMPT_PATH)) {
    console.error(`retry system prompt not found at ${PROMPT_PATH}`);
    process.exit(2);
  }
  if (!existsSync(ANNOTATIONS_PATH)) {
    console.error(`annotations file not found at ${ANNOTATIONS_PATH}`);
    process.exit(2);
  }
  const systemPrompt = extractPrompt(PROMPT_PATH);
  const corpus: Corpus = JSON.parse(readFileSync(TOCQUEVILLE_PATH, 'utf8'));
  const ann: TocquevilleAnnotations = JSON.parse(readFileSync(ANNOTATIONS_PATH, 'utf8'));
  const { targets, skipped, unmatchedSkips } = findRetryTargets(corpus, ann);

  const total = targets.length + skipped.length;
  console.log(`[retry] system prompt: ${PROMPT_PATH} (${systemPrompt.length} chars)`);
  console.log(`[retry] model: ${MODEL}, max_tokens: ${SYNC_MAX_TOKENS}`);
  console.log(`[retry] flagged_for_rewrite units total: ${total}`);
  console.log(`[retry]   processing: ${targets.length}`);
  console.log(`[retry]   skipped:    ${skipped.length}`);

  logSkippedAndUnmatched(skipped, unmatchedSkips);

  if (isDryRun) {
    console.log('');
    console.log('[retry] --dry-run: target enumeration only, no API calls made.');
    console.log('[retry] targets that would be processed:');
    for (const t of targets) {
      const where = t.kind === 'paragraph' ? `¶${t.paragraph_index}` : t.marker;
      console.log(`  - ${t.item_id} ${where} (${t.kind}, ${t.target_french.length} src chars)`);
    }
    return;
  }

  loadEnv();
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('missing env: ANTHROPIC_API_KEY (expected in .env.local)');
    process.exit(2);
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const byId = new Map(corpus.items.map(it => [it.id, it]));

  const sidecar: Sidecar = {};
  console.log('');
  let n = 0;
  for (const t of targets) {
    n++;
    const item = byId.get(t.item_id)!;
    const where = t.kind === 'paragraph' ? `¶${t.paragraph_index}` : t.marker;
    console.log(`[${n}/${targets.length}] ${t.item_id} ${where} (${t.target_french.length} chars) …`);
    try {
      const userMessage = buildUserMessage(item, t);
      const response = await client.beta.messages.create({
        model: MODEL,
        max_tokens: SYNC_MAX_TOKENS,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
        betas: [BETA_HEADER],
      });
      const text = response.content
        .filter(b => b.type === 'text')
        .map(b => (b as { type: 'text'; text: string }).text)
        .join('');
      sidecar[t.custom_id] = { rendered_raw: text };

      const pp = postprocess(text, t.target_french);
      console.log(`           rendered ${pp.rendered.length} chars, ${pp.flags.length} flags, ${pp.warnings.length} warnings`);
      if (pp.warnings.length > 0) {
        for (const w of pp.warnings) console.log(`           ! ${w}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      sidecar[t.custom_id] = { error: msg };
      console.log(`           ERROR: ${msg}`);
    }
  }

  writeSidecar(sidecar);
  console.log('');
  console.log(`[retry] sidecar written: ${RETRY_RESULTS_PATH}`);
  console.log('[retry] To write renderings back to corpus + annotations, run:');
  console.log('[retry]   node --experimental-strip-types scripts/retry-tocqueville-flagged.ts --apply');
}

// ---------------------------------------------------------------------------
// Apply phase
// ---------------------------------------------------------------------------

function promptConfirm(message: string): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolveP => {
    rl.question(message, answer => {
      rl.close();
      resolveP(answer.trim().toLowerCase() === 'y');
    });
  });
}

async function applyPhase(): Promise<void> {
  const sidecar = readSidecar();
  if (!existsSync(ANNOTATIONS_PATH)) {
    console.error(`annotations file not found at ${ANNOTATIONS_PATH}`);
    process.exit(2);
  }
  const corpus: Corpus = JSON.parse(readFileSync(TOCQUEVILLE_PATH, 'utf8'));
  const ann: TocquevilleAnnotations = JSON.parse(readFileSync(ANNOTATIONS_PATH, 'utf8'));
  const { targets } = findRetryTargets(corpus, ann);

  // Pre-check: every target needs a successful sidecar entry.
  const failures: string[] = [];
  for (const t of targets) {
    const v = sidecar[t.custom_id];
    if (v === undefined) {
      failures.push(`${t.custom_id}: missing sidecar entry`);
    } else if ('error' in v) {
      failures.push(`${t.custom_id}: ${v.error}`);
    }
  }
  if (failures.length > 0) {
    console.error(`[apply] ABORTING: ${failures.length} sidecar entries missing or errored:`);
    for (const f of failures) console.error(`  - ${f}`);
    process.exit(1);
  }

  console.log(`[apply] ${targets.length} units to apply.`);
  console.log('[apply] writes will:');
  console.log(`[apply]   - replace translation / footnotes_translation entries in ${TOCQUEVILLE_PATH}`);
  console.log(`[apply]   - replace flags in ${ANNOTATIONS_PATH}`);
  console.log('[apply]   - reset editorial_status and editorial_note to null for retried units');
  console.log('');
  const ok = await promptConfirm('[apply] Proceed? (y/n) ');
  if (!ok) {
    console.log('[apply] aborted by user.');
    return;
  }

  const annByItem = new Map(ann.items.map(it => [it.item_id, it]));
  const corpusByItem = new Map(corpus.items.map(it => [it.id, it]));

  let postprocessWarnings = 0;
  for (const t of targets) {
    const v = sidecar[t.custom_id] as { rendered_raw: string };
    const pp = postprocess(v.rendered_raw, t.target_french);
    if (pp.warnings.length > 0) {
      postprocessWarnings += pp.warnings.length;
      for (const w of pp.warnings) console.warn(`[apply] ${t.custom_id}: ${w}`);
    }

    const item = corpusByItem.get(t.item_id)!;
    const itemAnn = annByItem.get(t.item_id)!;

    if (t.kind === 'paragraph') {
      if (item.tocqueville.translation === null) {
        throw new Error(`${t.item_id}: translation is null — cannot retry-update`);
      }
      item.tocqueville.translation[t.paragraph_index!] = pp.rendered;
      const para = itemAnn.paragraphs.find(p => p.paragraph_index === t.paragraph_index);
      if (!para) {
        throw new Error(`annotations missing paragraph ${t.item_id} ¶${t.paragraph_index}`);
      }
      para.flags = pp.flags;
      para.editorial_status = null;
      para.editorial_note = null;
    } else {
      if (!item.tocqueville.footnotes_translation) {
        throw new Error(`${t.item_id}: footnotes_translation is missing — cannot retry-update`);
      }
      const fnTrans = item.tocqueville.footnotes_translation.find(f => f.marker === t.marker);
      if (!fnTrans) {
        throw new Error(`${t.item_id}: footnote ${t.marker} not in footnotes_translation`);
      }
      const fnParas = pp.rendered.split(/\n{2,}/).map(s => s.trim()).filter(s => s.length > 0);
      fnTrans.paragraphs = fnParas.length > 0 ? fnParas : [pp.rendered];
      const fnAnn = itemAnn.footnotes.find(f => f.marker === t.marker);
      if (!fnAnn) {
        throw new Error(`annotations missing footnote ${t.item_id} ${t.marker}`);
      }
      fnAnn.flags = pp.flags;
      fnAnn.editorial_status = null;
      fnAnn.editorial_note = null;
    }
  }

  const corpusTmp = TOCQUEVILLE_PATH + '.tmp';
  writeFileSync(corpusTmp, JSON.stringify(corpus, null, 2) + '\n');
  renameSync(corpusTmp, TOCQUEVILLE_PATH);
  console.log(`[apply] corpus written: ${TOCQUEVILLE_PATH}`);

  const annTmp = ANNOTATIONS_PATH + '.tmp';
  writeFileSync(annTmp, JSON.stringify(ann, null, 2) + '\n');
  renameSync(annTmp, ANNOTATIONS_PATH);
  console.log(`[apply] annotations written: ${ANNOTATIONS_PATH}`);

  unlinkSync(RETRY_RESULTS_PATH);
  console.log(`[apply] sidecar cleared: ${RETRY_RESULTS_PATH}`);

  console.log('');
  console.log(`[apply] ${targets.length} units retried and applied.`);
  console.log(`[apply] postprocess warnings: ${postprocessWarnings}`);
  console.log(`[apply] editorial_status reset to null for all ${targets.length} — re-review via scripts/review-annotations.ts`);
}

// ---------------------------------------------------------------------------
// Main + direct-invocation guard
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  if (isApply) {
    await applyPhase();
    return;
  }
  await fetchPhase();
}

// Same guard pattern as generate-translation.ts — importing this module must
// NOT auto-run main(). See feedback_import_main_guard memory.
const isDirectInvocation =
  typeof process.argv[1] === 'string' &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectInvocation) {
  main().catch(err => {
    console.error('[fatal]', err);
    process.exit(1);
  });
}
