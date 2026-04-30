// Phase 3.2 editorial review CLI for federalist-annotations.json.
//
// Pages through every paragraph with flags.length > 0 in document order.
// Each editorial action mutates the on-disk annotations file atomically;
// edits also rewrite federalist.json. Held-in-memory; no per-keystroke disk
// reads.
//
// Run:
//   node --experimental-strip-types scripts/review-annotations.ts

import { readFileSync, writeFileSync, renameSync, mkdtempSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createInterface } from 'node:readline/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { REPO_ROOT, FEDERALIST_PATH } from '../data/eval/lib.ts';

const ANNOTATIONS_PATH = resolve(REPO_ROOT, 'data', 'federalist', 'federalist-annotations.json');

// ---------------------------------------------------------------------------
// Local type definitions (duplicated from generate-plain-english.ts; kept
// local per session decision rather than extracting a shared types module).
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

type FlagKind = 'AMBIGUOUS' | 'WORD' | 'RHETORIC';

type FlagEntry = {
  kind: FlagKind;
  term: string | null;
  note: string;
};

type EditorialStatus = null | 'accepted' | 'edited' | 'flagged_for_rewrite';

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

// ---------------------------------------------------------------------------
// Atomic JSON write — temp + rename, trailing newline matches the existing
// files written by generate-plain-english.ts.
// ---------------------------------------------------------------------------

function atomicWriteJson(path: string, obj: unknown): void {
  const tmp = path + '.tmp';
  writeFileSync(tmp, JSON.stringify(obj, null, 2) + '\n');
  renameSync(tmp, path);
}

// ---------------------------------------------------------------------------
// Flagged-paragraph index. Built once at startup; the cursor walks this list
// in document order. Each entry caches the indices into corpus.items and
// ann.papers[].paragraphs[] so mutations land in O(1).
// ---------------------------------------------------------------------------

type FlaggedRef = {
  paperNumber: number;
  paragraphIndex: number;
  itemIdx: number;
  paperAnnIdx: number;
  paraAnnIdx: number;
};

function buildFlaggedIndex(corpus: Corpus, ann: FederalistAnnotations): FlaggedRef[] {
  const itemByNumber = new Map<number, number>();
  corpus.items.forEach((it, i) => itemByNumber.set(it.federalist.number, i));
  const out: FlaggedRef[] = [];
  ann.papers.forEach((paper, paperAnnIdx) => {
    const itemIdx = itemByNumber.get(paper.paper_number);
    if (itemIdx === undefined) {
      throw new Error(`paper ${paper.paper_number} present in annotations but not in corpus`);
    }
    paper.paragraphs.forEach((para, paraAnnIdx) => {
      if (para.flags.length > 0) {
        out.push({
          paperNumber: paper.paper_number,
          paragraphIndex: para.paragraph_index,
          itemIdx,
          paperAnnIdx,
          paraAnnIdx,
        });
      }
    });
  });
  return out;
}

function countReviewed(flagged: FlaggedRef[], ann: FederalistAnnotations): number {
  let n = 0;
  for (const ref of flagged) {
    const para = ann.papers[ref.paperAnnIdx].paragraphs[ref.paraAnnIdx];
    if (para.editorial_status !== null) n++;
  }
  return n;
}

// ---------------------------------------------------------------------------
// Display
// ---------------------------------------------------------------------------

const RULE = '='.repeat(78);

function renderView(
  corpus: Corpus,
  ann: FederalistAnnotations,
  flagged: FlaggedRef[],
  cursor: number,
): string {
  const ref = flagged[cursor];
  const item = corpus.items[ref.itemIdx];
  const para = ann.papers[ref.paperAnnIdx].paragraphs[ref.paraAnnIdx];
  const original = item.paragraphs[ref.paragraphIndex];
  const plainEnglish =
    item.plain_english !== null
      ? item.plain_english[ref.paragraphIndex] ?? '(plain_english missing for this index)'
      : '(plain_english not populated)';

  const reviewed = countReviewed(flagged, ann);
  const total = flagged.length;

  const lines: string[] = [];
  lines.push('');
  lines.push(RULE);
  lines.push(`Federalist ${item.federalist.number} — "${item.title}" — ${item.authors.join(', ')}`);
  lines.push(
    `Paragraph index ${ref.paragraphIndex}  ·  Position ${cursor + 1} / ${total}  ·  Reviewed ${reviewed} / ${total}`,
  );
  lines.push(RULE);
  lines.push('');
  lines.push('--- ORIGINAL ---');
  lines.push(original);
  lines.push('');
  lines.push('--- PLAIN ENGLISH ---');
  lines.push(plainEnglish);
  lines.push('');
  lines.push(`--- FLAGS (${para.flags.length}) ---`);
  for (const f of para.flags) {
    if (f.term !== null) {
      lines.push(`[${f.kind}] "${f.term}" — ${f.note}`);
    } else {
      lines.push(`[${f.kind}] ${f.note}`);
    }
  }
  lines.push('');
  lines.push('--- EDITORIAL ---');
  lines.push(`status: ${para.editorial_status ?? '(none)'}`);
  lines.push(`note:   ${para.editorial_note ?? '(none)'}`);
  lines.push('');
  return lines.join('\n');
}

const HELP = `
Commands:
  n / next         — advance to next flagged paragraph
  p / prev         — back to previous flagged paragraph
  g <paper> <para> — jump to (paper, paragraph_index); errors if not flagged
  a / accept       — set editorial_status = "accepted"; advance
  e / edit         — open $EDITOR with current plain_english; on save, write
                     back to federalist.json and set status = "edited"; advance
  f / flag         — set editorial_status = "flagged_for_rewrite"; prompts for
                     an optional note; advance
  m <note>         — set editorial_note (status unchanged); stay
  u / unset        — clear status and note; stay
  q / quit         — print summary and exit
  ? / help         — show this help
`;

// ---------------------------------------------------------------------------
// Editor flow. Spawns $EDITOR (or vi) on a temp file containing the current
// plain_english text. trimEnd() comparison treats a trailing-newline-only
// edit as a cancellation, since most editors append a final newline on save.
// ---------------------------------------------------------------------------

type EditOutcome = { changed: false } | { changed: true; newText: string };

function runEditor(currentText: string): EditOutcome {
  const dir = mkdtempSync(resolve(tmpdir(), 'publius-review-'));
  const filePath = resolve(dir, 'paragraph.txt');
  try {
    writeFileSync(filePath, currentText);
    const editor = process.env.EDITOR ?? 'vi';
    const result = spawnSync(editor, [filePath], { stdio: 'inherit' });
    if (result.error) {
      throw new Error(`failed to spawn ${editor}: ${result.error.message}`);
    }
    if (result.signal !== null || (typeof result.status === 'number' && result.status !== 0)) {
      return { changed: false };
    }
    const newText = readFileSync(filePath, 'utf8');
    if (newText.trimEnd() === currentText.trimEnd()) {
      return { changed: false };
    }
    return { changed: true, newText: newText.trimEnd() };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------
// Quit summary
// ---------------------------------------------------------------------------

function printSummary(flagged: FlaggedRef[], ann: FederalistAnnotations): void {
  const counts = { accepted: 0, edited: 0, flagged_for_rewrite: 0, unreviewed: 0 };
  for (const ref of flagged) {
    const para = ann.papers[ref.paperAnnIdx].paragraphs[ref.paraAnnIdx];
    if (para.editorial_status === null) counts.unreviewed++;
    else counts[para.editorial_status]++;
  }
  console.log('');
  console.log('=== REVIEW SUMMARY ===');
  console.log(`Flagged paragraphs:    ${flagged.length}`);
  console.log(`  accepted:            ${counts.accepted}`);
  console.log(`  edited:              ${counts.edited}`);
  console.log(`  flagged_for_rewrite: ${counts.flagged_for_rewrite}`);
  console.log(`  unreviewed:          ${counts.unreviewed}`);
  console.log('=======================');
}

// ---------------------------------------------------------------------------
// Main loop
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const corpus: Corpus = JSON.parse(readFileSync(FEDERALIST_PATH, 'utf8'));
  const ann: FederalistAnnotations = JSON.parse(readFileSync(ANNOTATIONS_PATH, 'utf8'));

  const flagged = buildFlaggedIndex(corpus, ann);
  if (flagged.length === 0) {
    console.log('No flagged paragraphs found in annotations file. Nothing to review.');
    return;
  }

  let cursor = 0;
  let running = true;

  const rl = createInterface({ input: process.stdin, output: process.stdout });

  while (running) {
    process.stdout.write(renderView(corpus, ann, flagged, cursor));
    const raw = (await rl.question('> ')).trim();
    if (raw === '') continue;

    const parts = raw.split(/\s+/);
    const head = parts[0];
    const rest = parts.slice(1);
    const tail = raw.slice(head.length).trimStart();

    const ref = flagged[cursor];
    const para = ann.papers[ref.paperAnnIdx].paragraphs[ref.paraAnnIdx];
    const item = corpus.items[ref.itemIdx];

    switch (head) {
      case 'n':
      case 'next': {
        if (tail.length > 0) {
          console.log('(use `m <note>` to set a note; `n` alone advances)');
          break;
        }
        if (cursor < flagged.length - 1) cursor++;
        else console.log('(end of flagged stream)');
        break;
      }
      case 'p':
      case 'prev': {
        if (cursor > 0) cursor--;
        else console.log('(start of flagged stream)');
        break;
      }
      case 'g': {
        if (rest.length !== 2) {
          console.log('(usage: g <paper> <para>)');
          break;
        }
        const paperN = Number(rest[0]);
        const paraI = Number(rest[1]);
        if (!Number.isInteger(paperN) || !Number.isInteger(paraI)) {
          console.log('(usage: g <paper> <para> — both must be integers)');
          break;
        }
        const idx = flagged.findIndex(
          r => r.paperNumber === paperN && r.paragraphIndex === paraI,
        );
        if (idx < 0) {
          console.log(
            `(no flagged paragraph at ${paperN}:${paraI} — use n/p to navigate flagged paragraphs only)`,
          );
          break;
        }
        cursor = idx;
        break;
      }
      case 'a':
      case 'accept': {
        para.editorial_status = 'accepted';
        atomicWriteJson(ANNOTATIONS_PATH, ann);
        if (cursor < flagged.length - 1) cursor++;
        break;
      }
      case 'e':
      case 'edit': {
        const plainEnglish = item.plain_english;
        if (plainEnglish === null) {
          console.log('(plain_english not populated for this paper; nothing to edit)');
          break;
        }
        const currentPlain = plainEnglish[ref.paragraphIndex];
        if (typeof currentPlain !== 'string') {
          console.log('(plain_english missing at this index; nothing to edit)');
          break;
        }
        let outcome: EditOutcome;
        try {
          outcome = runEditor(currentPlain);
        } catch (err) {
          console.log(`(edit failed: ${(err as Error).message})`);
          break;
        }
        if (!outcome.changed) {
          console.log('(unchanged — no edit recorded)');
          break;
        }
        plainEnglish[ref.paragraphIndex] = outcome.newText;
        para.editorial_status = 'edited';
        atomicWriteJson(FEDERALIST_PATH, corpus);
        atomicWriteJson(ANNOTATIONS_PATH, ann);
        if (cursor < flagged.length - 1) cursor++;
        break;
      }
      case 'f':
      case 'flag': {
        para.editorial_status = 'flagged_for_rewrite';
        const note = (await rl.question('Note (optional, blank to skip): ')).trim();
        para.editorial_note = note.length > 0 ? note : null;
        atomicWriteJson(ANNOTATIONS_PATH, ann);
        if (cursor < flagged.length - 1) cursor++;
        break;
      }
      case 'm': {
        if (tail.length === 0) {
          console.log('(usage: m <note>)');
          break;
        }
        para.editorial_note = tail;
        atomicWriteJson(ANNOTATIONS_PATH, ann);
        break;
      }
      case 'u':
      case 'unset': {
        para.editorial_status = null;
        para.editorial_note = null;
        atomicWriteJson(ANNOTATIONS_PATH, ann);
        break;
      }
      case 'q':
      case 'quit': {
        running = false;
        break;
      }
      case '?':
      case 'help': {
        console.log(HELP);
        break;
      }
      default: {
        console.log(`(unknown command: ${head} — type ? for help)`);
        break;
      }
    }
  }

  rl.close();
  printSummary(flagged, ann);
}

// Direct-invocation guard: only run main() when executed directly. Prevents
// an `await import(...)` smoke test from kicking off an interactive session.
const isDirectInvocation =
  typeof process.argv[1] === 'string' &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectInvocation) {
  main().catch(err => {
    console.error('[fatal]', err);
    process.exit(1);
  });
}
