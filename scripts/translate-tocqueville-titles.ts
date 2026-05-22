// Phase 4/5 Tocqueville title-translation workflow.
//
// Three modes:
//
//   --sample
//       Generate the first 3 candidate English titles synchronously,
//       print them, exit. No sidecar, no JSON writes. This is the
//       verification step before committing to the full 39-item run.
//
//   --generate
//       Generate candidate English titles for every Vol I item with
//       tocqueville.translation !== null (39 items as of writing).
//       Writes to a sidecar at data/tocqueville/.title-candidates.json.
//       Idempotent: re-running overwrites the sidecar.
//
//   --review
//       Reads the sidecar, walks each candidate one at a time in the
//       terminal with three choices — (a)ccept / (w)rite-rewrite /
//       (s)kip — and writes accepted titles back to tocqueville.json
//       as tocqueville.translated_title. Initializes
//       tocqueville.translated_title to null on every item that did
//       not get an accepted/rewritten title, including all Vol II
//       items and any Vol I items that were skipped.
//
// Sidecar shape:
//   {
//     "<item_id>": { "french_title": "...", "candidate": "..." } | { "error": "..." },
//     ...
//   }
//
// Ctrl+C in --review writes whatever has been accepted/rewritten so far
// to tocqueville.json before exiting, so a partial review session never
// loses approved titles. Items not yet visited in the partial session
// still get translated_title initialized to null.
//
// Run:
//   node --experimental-strip-types scripts/translate-tocqueville-titles.ts --sample
//   node --experimental-strip-types scripts/translate-tocqueville-titles.ts --generate
//   node --experimental-strip-types scripts/translate-tocqueville-titles.ts --review

import { readFileSync, writeFileSync, existsSync, renameSync } from 'node:fs';
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
const PROMPT_PATH = resolve(REPO_ROOT, 'prompts', 'tocqueville-title-v1.md');
const SIDECAR_PATH = resolve(REPO_ROOT, 'data', 'tocqueville', '.title-candidates.json');

const MODEL = 'claude-opus-4-7';
const MAX_TOKENS = 500;
const SAMPLE_COUNT = 3;
const TARGET_VOLUME = 1;

// ---------------------------------------------------------------------------
// Types (minimal — preserve unknown fields)
// ---------------------------------------------------------------------------

type TocquevilleExtension = {
  volume: 1 | 2;
  translation: string[] | null;
  translated_title?: string | null;
  [k: string]: unknown;
};

type TocquevilleItem = {
  id: string;
  title: string;
  tocqueville: TocquevilleExtension;
  [k: string]: unknown;
};

type Corpus = {
  corpus: 'tocqueville';
  source: Record<string, unknown>;
  count: number;
  items: TocquevilleItem[];
};

type SidecarEntry =
  | { french_title: string; candidate: string }
  | { french_title: string; error: string };

type Sidecar = Record<string, SidecarEntry>;

// ---------------------------------------------------------------------------
// Target selection
// ---------------------------------------------------------------------------

function selectTargets(corpus: Corpus): TocquevilleItem[] {
  return corpus.items.filter(
    it => it.tocqueville.volume === TARGET_VOLUME && it.tocqueville.translation !== null,
  );
}

// ---------------------------------------------------------------------------
// API call
// ---------------------------------------------------------------------------

async function generateTitle(
  client: Anthropic,
  systemPrompt: string,
  frenchTitle: string,
): Promise<string> {
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: systemPrompt,
    messages: [{ role: 'user', content: frenchTitle }],
  });
  const text = response.content
    .filter(b => b.type === 'text')
    .map(b => (b as { type: 'text'; text: string }).text)
    .join('')
    .trim();
  if (text.length === 0) {
    throw new Error('empty response from model');
  }
  return text;
}

// ---------------------------------------------------------------------------
// Sidecar I/O
// ---------------------------------------------------------------------------

function writeSidecar(sidecar: Sidecar): void {
  const tmp = SIDECAR_PATH + '.tmp';
  writeFileSync(tmp, JSON.stringify(sidecar, null, 2) + '\n');
  renameSync(tmp, SIDECAR_PATH);
}

function readSidecar(): Sidecar {
  if (!existsSync(SIDECAR_PATH)) {
    throw new Error(`sidecar not found at ${SIDECAR_PATH} — run --generate first.`);
  }
  return JSON.parse(readFileSync(SIDECAR_PATH, 'utf8')) as Sidecar;
}

// ---------------------------------------------------------------------------
// Corpus I/O
// ---------------------------------------------------------------------------

function readCorpus(): Corpus {
  return JSON.parse(readFileSync(TOCQUEVILLE_PATH, 'utf8')) as Corpus;
}

// Write translated_title on every item: accepted/rewritten get their value,
// every other item (Vol II, skipped, never-reviewed) gets null. Preserves
// any pre-existing non-null translated_title on items not in the accepted
// map — important for re-running --review where Vol II might already be
// populated by a future workflow.
function writeCorpusWithTitles(corpus: Corpus, accepted: Map<string, string>): void {
  for (const item of corpus.items) {
    const ext = item.tocqueville;
    if (accepted.has(item.id)) {
      ext.translated_title = accepted.get(item.id)!;
    } else if (ext.translated_title === undefined) {
      ext.translated_title = null;
    }
  }
  const tmp = TOCQUEVILLE_PATH + '.tmp';
  writeFileSync(tmp, JSON.stringify(corpus, null, 2) + '\n');
  renameSync(tmp, TOCQUEVILLE_PATH);
}

// ---------------------------------------------------------------------------
// Anthropic client setup
// ---------------------------------------------------------------------------

function buildClient(): Anthropic {
  loadEnv();
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('missing env: ANTHROPIC_API_KEY (expected in .env.local)');
    process.exit(2);
  }
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

function loadSystemPrompt(): string {
  if (!existsSync(PROMPT_PATH)) {
    console.error(`system prompt not found at ${PROMPT_PATH}`);
    process.exit(2);
  }
  return extractPrompt(PROMPT_PATH);
}

// ---------------------------------------------------------------------------
// --sample mode
// ---------------------------------------------------------------------------

async function samplePhase(): Promise<void> {
  const systemPrompt = loadSystemPrompt();
  const corpus = readCorpus();
  const targets = selectTargets(corpus).slice(0, SAMPLE_COUNT);

  console.log(`[sample] system prompt: ${PROMPT_PATH} (${systemPrompt.length} chars)`);
  console.log(`[sample] model: ${MODEL}, max_tokens: ${MAX_TOKENS}`);
  console.log(`[sample] generating ${targets.length} candidate title(s)`);
  console.log('');

  const client = buildClient();
  for (let i = 0; i < targets.length; i++) {
    const t = targets[i];
    console.log(`[${i + 1}/${targets.length}] ${t.id}`);
    console.log(`  French:  ${t.title}`);
    try {
      const candidate = await generateTitle(client, systemPrompt, t.title);
      console.log(`  English: ${candidate}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`  ERROR:   ${msg}`);
    }
    console.log('');
  }

  console.log('[sample] done. Inspect above; re-run with --generate to draft all 39.');
}

// ---------------------------------------------------------------------------
// --generate mode
// ---------------------------------------------------------------------------

async function generatePhase(): Promise<void> {
  const systemPrompt = loadSystemPrompt();
  const corpus = readCorpus();
  const targets = selectTargets(corpus);

  console.log(`[generate] system prompt: ${PROMPT_PATH} (${systemPrompt.length} chars)`);
  console.log(`[generate] model: ${MODEL}, max_tokens: ${MAX_TOKENS}`);
  console.log(`[generate] targets: ${targets.length} Vol ${TARGET_VOLUME} items with non-null translation`);
  console.log('');

  const client = buildClient();
  const sidecar: Sidecar = {};

  for (let i = 0; i < targets.length; i++) {
    const t = targets[i];
    const prefix = `[${i + 1}/${targets.length}] ${t.id}`;
    try {
      const candidate = await generateTitle(client, systemPrompt, t.title);
      sidecar[t.id] = { french_title: t.title, candidate };
      console.log(`${prefix}  ${candidate}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      sidecar[t.id] = { french_title: t.title, error: msg };
      console.log(`${prefix}  ERROR: ${msg}`);
    }
  }

  writeSidecar(sidecar);
  console.log('');
  console.log(`[generate] sidecar written: ${SIDECAR_PATH}`);
  const errs = Object.values(sidecar).filter(v => 'error' in v).length;
  if (errs > 0) {
    console.log(`[generate] ${errs} item(s) errored — re-run --generate to retry, or proceed to --review (errored items will show as "(API error)" and can be rewritten or skipped).`);
  }
  console.log('[generate] Next: node --experimental-strip-types scripts/translate-tocqueville-titles.ts --review');
}

// ---------------------------------------------------------------------------
// --review mode
// ---------------------------------------------------------------------------

type ReviewChoice = 'accept' | 'rewrite' | 'skip';

function makePrompter(): {
  ask: (question: string) => Promise<string>;
  close: () => void;
} {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const ask = (question: string) =>
    new Promise<string>(resolveP => {
      rl.question(question, answer => resolveP(answer));
    });
  return { ask, close: () => rl.close() };
}

async function reviewChoice(ask: (q: string) => Promise<string>): Promise<ReviewChoice | null> {
  while (true) {
    const answer = (await ask('(a) Accept  (w) Rewrite  (s) Skip\n> ')).trim().toLowerCase();
    if (answer === 'a') return 'accept';
    if (answer === 'w') return 'rewrite';
    if (answer === 's') return 'skip';
    console.log('  (unrecognized — type a, w, or s)');
  }
}

async function reviewPhase(): Promise<void> {
  const sidecar = readSidecar();
  const corpus = readCorpus();
  const targets = selectTargets(corpus);

  // Order the review loop by the corpus order, so the user walks the
  // titles in the same sequence they appear in tocqueville.json.
  const orderedTargets = targets.filter(t => sidecar[t.id] !== undefined);
  const missing = targets.filter(t => sidecar[t.id] === undefined);
  if (missing.length > 0) {
    console.warn(`[review] WARNING: ${missing.length} target item(s) have no sidecar entry — they will not be reviewed in this session:`);
    for (const m of missing) console.warn(`  - ${m.id}`);
  }

  console.log(`[review] ${orderedTargets.length} item(s) to review.`);
  console.log('[review] (a) Accept  (w) Rewrite  (s) Skip   Ctrl+C saves progress and exits.');
  console.log('');

  const accepted = new Map<string, string>();
  let interrupted = false;

  // Install SIGINT handler that flushes accepted titles to disk before
  // process exit. The handler must not throw or it will be lost.
  const onSigint = () => {
    interrupted = true;
    console.log('\n[review] Ctrl+C received — flushing accepted titles to tocqueville.json …');
    try {
      writeCorpusWithTitles(corpus, accepted);
      console.log(`[review] saved ${accepted.size} accepted title(s) to ${TOCQUEVILLE_PATH}`);
    } catch (err) {
      console.error('[review] FAILED to save on interrupt:', err);
    }
    process.exit(130);
  };
  process.on('SIGINT', onSigint);

  const { ask, close } = makePrompter();

  try {
    for (let i = 0; i < orderedTargets.length; i++) {
      const t = orderedTargets[i];
      const entry = sidecar[t.id];
      const candidate = 'candidate' in entry ? entry.candidate : `(API error: ${entry.error})`;

      console.log(`[${i + 1}/${orderedTargets.length}]  ${t.id}`);
      console.log(`French:  ${t.title}`);
      console.log(`English: ${candidate}`);
      console.log('');

      const choice = await reviewChoice(ask);

      if (choice === 'accept') {
        if ('error' in entry) {
          console.log('  (cannot accept an API error — choose Rewrite or Skip)');
          i--; // re-run this item
          console.log('');
          continue;
        }
        accepted.set(t.id, candidate);
      } else if (choice === 'rewrite') {
        const rewrite = (await ask('Your title: ')).trim();
        if (rewrite.length === 0) {
          console.log('  (empty — treating as Skip)');
        } else {
          accepted.set(t.id, rewrite);
        }
      } // skip: leave unset
      console.log('');
    }
  } finally {
    close();
    process.off('SIGINT', onSigint);
  }

  if (interrupted) return; // SIGINT handler already wrote

  writeCorpusWithTitles(corpus, accepted);

  // Sanity check: count translated_title !== null on Vol I items and
  // confirm it matches the number of accepted/rewritten entries.
  const fresh = readCorpus();
  const populatedVol1 = fresh.items.filter(
    it => it.tocqueville.volume === TARGET_VOLUME && it.tocqueville.translated_title !== null,
  ).length;

  console.log('[review] write complete.');
  console.log(`[review]   accepted/rewritten this session: ${accepted.size}`);
  console.log(`[review]   Vol ${TARGET_VOLUME} items with translated_title != null: ${populatedVol1}`);
  if (populatedVol1 !== accepted.size) {
    console.warn(`[review]   WARNING: counts differ. Some Vol ${TARGET_VOLUME} items may have had a translated_title set in a prior session.`);
  }
  console.log('[review] Sidecar at ' + SIDECAR_PATH + ' left in place — delete manually after verifying the diff.');
}

// ---------------------------------------------------------------------------
// CLI + main
// ---------------------------------------------------------------------------

const argv = process.argv.slice(2);
const FLAGS = new Set(argv);

function printUsage(): void {
  console.log('Usage:');
  console.log('  node --experimental-strip-types scripts/translate-tocqueville-titles.ts --sample');
  console.log('  node --experimental-strip-types scripts/translate-tocqueville-titles.ts --generate');
  console.log('  node --experimental-strip-types scripts/translate-tocqueville-titles.ts --review');
}

async function main(): Promise<void> {
  const modes = ['--sample', '--generate', '--review'].filter(m => FLAGS.has(m));
  if (modes.length !== 1) {
    printUsage();
    process.exit(modes.length === 0 ? 0 : 2);
  }
  switch (modes[0]) {
    case '--sample':
      await samplePhase();
      return;
    case '--generate':
      await generatePhase();
      return;
    case '--review':
      await reviewPhase();
      return;
  }
}

// Direct-invocation guard (see feedback_import_main_guard memory and the
// matching pattern in scripts/retry-tocqueville-flagged.ts).
const isDirectInvocation =
  typeof process.argv[1] === 'string' &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectInvocation) {
  main().catch(err => {
    console.error('[fatal]', err);
    process.exit(1);
  });
}
