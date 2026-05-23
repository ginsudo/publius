// Shared helpers for data/eval/* scripts.
// Dependency-free; uses node:sqlite + node:fs + global fetch.
// Run scripts with: node --experimental-strip-types <script>.ts

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

// =====================================================================
// Paths
// =====================================================================

const HERE = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = resolve(HERE, '..', '..');
export const DB_PATH = resolve(HERE, 'index.sqlite');
export const VENDOR_DIR = resolve(HERE, 'vendor');
export const PROBES_PATH = resolve(HERE, 'probes.json');
export const RESULTS_PATH = resolve(HERE, 'results.md');
export const FEDERALIST_PATH = resolve(REPO_ROOT, 'data', 'federalist', 'federalist.json');
export const TOCQUEVILLE_PATH = resolve(REPO_ROOT, 'data', 'tocqueville', 'tocqueville.json');

// =====================================================================
// Env loading from .env.local — minimal KEY=VALUE parser
// =====================================================================

export function loadEnv(): void {
  const path = resolve(REPO_ROOT, '.env.local');
  let raw: string;
  try {
    raw = readFileSync(path, 'utf8');
  } catch {
    throw new Error(`.env.local not found at ${path}. See data/eval/README.md.`);
  }
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const m = trimmed.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && process.env[m[1]] === undefined) {
      // Strip optional matching surrounding single/double quotes (dotenv convention)
      process.env[m[1]] = m[2].replace(/^(["'])(.*)\1$/, '$2');
    }
  }
}

// =====================================================================
// Voyage embeddings client (HTTP, no SDK)
// =====================================================================

export const EMBEDDING_MODEL = 'voyage-4-large';
export const EMBEDDING_DIM = 1024;

export type EmbedResult = {
  embeddings: number[][];
  tokens: number;
};

export async function voyageEmbed(
  texts: string[],
  inputType: 'document' | 'query',
): Promise<EmbedResult> {
  const apiKey = process.env.VOYAGE_API_KEY;
  if (!apiKey) {
    throw new Error('VOYAGE_API_KEY not set in .env.local. See data/eval/README.md.');
  }
  if (texts.length === 0) {
    return { embeddings: [], tokens: 0 };
  }
  if (texts.length > 128) {
    throw new Error(`Voyage batch limit is 128; got ${texts.length}. Caller must batch.`);
  }

  const res = await fetch('https://api.voyageai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      input: texts,
      model: EMBEDDING_MODEL,
      input_type: inputType,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Voyage API ${res.status} ${res.statusText}: ${body.slice(0, 800)}`);
  }
  const json = (await res.json()) as {
    data: Array<{ embedding: number[]; index: number }>;
    usage: { total_tokens: number };
  };
  // Voyage may return out of input order; sort by index to realign.
  const sorted = json.data.slice().sort((a, b) => a.index - b.index);
  return {
    embeddings: sorted.map((d) => d.embedding),
    tokens: json.usage.total_tokens,
  };
}

// =====================================================================
// SQLite + sqlite-vec
// =====================================================================

import { existsSync } from 'node:fs';

function findVecExtension(): string {
  // Platform-explicit: darwin → vec0.dylib, linux → vec0.so. Both binaries are
  // committed at the same sqlite-vec version so retrieval behaviour is identical
  // across the dev (macOS arm64) and Vercel (Linux x86_64) environments.
  if (!existsSync(VENDOR_DIR)) {
    throw new Error(
      `Vendor directory missing: ${VENDOR_DIR}\n` +
        'See data/eval/README.md.',
    );
  }
  let filename: string;
  if (process.platform === 'darwin') filename = 'vec0.dylib';
  else if (process.platform === 'linux') filename = 'vec0.so';
  else {
    throw new Error(
      `Unsupported platform for sqlite-vec: ${process.platform}.\n` +
        'Only darwin and linux are vendored. See data/eval/README.md.',
    );
  }
  const path = resolve(VENDOR_DIR, filename);
  if (!existsSync(path)) {
    throw new Error(
      `sqlite-vec extension binary missing: ${path}\n` +
        'Expected to be committed to the repo. See data/eval/README.md.',
    );
  }
  return path;
}

export function openDb(): DatabaseSync {
  const db = new DatabaseSync(DB_PATH, { allowExtension: true });
  db.loadExtension(findVecExtension());
  return db;
}

// =====================================================================
// Chunk shape
// =====================================================================

export type Chunk = {
  id: string;            // unique chunk id, e.g. "federalist:10:body:5"
  item_id: string;       // "federalist:10"
  corpus: string;        // "federalist"
  kind: 'body' | 'footnote';
  paragraph_index: number | null;  // body-only; null for footnotes
  marker: string | null;           // footnote-only; null for body
  text: string;          // text as embedded (with header context)
  paper_number: number;
  title: string;
  authors_json: string;
  authorship_status: string;
  date: string;
};

// =====================================================================
// Federalist → chunks
// =====================================================================

export function federalistChunks(): Chunk[] {
  const corpus = JSON.parse(readFileSync(FEDERALIST_PATH, 'utf8'));
  const chunks: Chunk[] = [];

  for (const item of corpus.items) {
    const number = item.federalist.number as number;
    const title = item.title as string;
    const authors = (item.authors as string[]).join(', ');
    const header = `Federalist No. ${number} — ${title}\nAuthor: ${authors}`;

    // Body paragraphs
    for (let i = 0; i < item.paragraphs.length; i++) {
      const para = item.paragraphs[i] as string;
      chunks.push({
        id: `${item.id}:body:${i}`,
        item_id: item.id,
        corpus: 'federalist',
        kind: 'body',
        paragraph_index: i,
        marker: null,
        text: `${header}\n\n${para}`,
        paper_number: number,
        title,
        authors_json: JSON.stringify(item.authors),
        authorship_status: item.federalist.authorship_status,
        date: item.date,
      });
    }

    // Footnotes — each footnote is one chunk regardless of paragraph count
    for (const fn of item.footnotes ?? []) {
      const fnText = (fn.paragraphs as string[]).join('\n');
      chunks.push({
        id: `${item.id}:footnote:${fn.marker}`,
        item_id: item.id,
        corpus: 'federalist',
        kind: 'footnote',
        paragraph_index: null,
        marker: fn.marker,
        text: `Federalist No. ${number} — ${title}\nFootnote ${fn.marker} — ${authors}\n\n${fnText}`,
        paper_number: number,
        title,
        authors_json: JSON.stringify(item.authors),
        authorship_status: item.federalist.authorship_status,
        date: item.date,
      });
    }
  }

  return chunks;
}

// =====================================================================
// Tocqueville → chunks (Vol I only; items with translation populated)
// =====================================================================

function tocquevilleItemLocator(item: any): string {
  const t = item.tocqueville;
  const volRoman = t.volume === 1 ? 'I' : 'II';
  switch (t.kind) {
    case 'chapter': {
      const chapTitle = t.translated_title ?? item.title;
      return `Volume ${volRoman}, Part ${t.part}, Chapter ${t.chapter}: ${chapTitle}`;
    }
    case 'end_note': {
      // ID form: tocqueville:vol1.t1.notes.A → letter = "A"; preserves TN- prefix in Vol II.
      const m = item.id.match(/\.notes\.([A-Za-z0-9-]+)$/);
      const letter = m ? m[1] : '?';
      const page = t.references_page;
      const pageTail = page == null ? '' : ` (page ${page})`;
      return `Volume ${volRoman}, End-Note ${letter}${pageTail}`;
    }
    case 'introduction':
      // Two introduction items: vol1.introduction (the Vol I introduction proper)
      // and vol1.preamble.part2 (the unmarked Part II preamble in tome 2).
      if (item.id.endsWith('.preamble.part2')) {
        return `Volume ${volRoman}, Part II Preamble`;
      }
      return `Volume ${volRoman}, Introduction`;
    case 'avertissement':
      return `Volume ${volRoman}, Avertissement (Tenth Edition)`;
    case 'appendix':
      return `Volume ${volRoman}, Appendix`;
    default:
      throw new Error(`Unknown tocqueville kind "${t.kind}" on ${item.id}`);
  }
}

export function tocquevilleChunks(): Chunk[] {
  const corpus = JSON.parse(readFileSync(TOCQUEVILLE_PATH, 'utf8'));
  const chunks: Chunk[] = [];

  for (const item of corpus.items) {
    const t = item.tocqueville;
    if (t.volume !== 1) continue;
    if (t.translation == null) continue;

    const translation = t.translation as string[];
    const footnotesTranslation = (t.footnotes_translation ?? []) as Array<{
      marker: string;
      paragraphs: string[];
    }>;

    if (translation.length !== item.paragraphs.length) {
      throw new Error(
        `Translation length mismatch on ${item.id}: ` +
          `paragraphs=${item.paragraphs.length}, translation=${translation.length}`,
      );
    }

    const locator = tocquevilleItemLocator(item);
    const itemHeader = `Tocqueville, Democracy in America — ${locator}\nAuthor: Tocqueville`;
    const authorsJson = JSON.stringify(item.authors);

    // Body paragraphs (English translation)
    for (let i = 0; i < translation.length; i++) {
      const para = translation[i];
      chunks.push({
        id: `${item.id}:body:${i}`,
        item_id: item.id,
        corpus: 'tocqueville',
        kind: 'body',
        paragraph_index: i,
        marker: null,
        text: `${itemHeader}\n\n${para}`,
        paper_number: null as unknown as number, // null in DB; Federalist-only field
        title: t.translated_title ?? item.title,
        authors_json: authorsJson,
        authorship_status: 'undisputed',
        date: item.date,
      });
    }

    // Footnotes — each footnote_translation entry is one chunk.
    // Marker is byte-identical between footnotes[] and footnotes_translation[]
    // per the Phase 4 parser invariant.
    for (const fn of footnotesTranslation) {
      const fnText = fn.paragraphs.join('\n');
      // Chapter-level locator (volume/part/chapter) in the footnote header lets
      // the embedding see the host item's structural location alongside the
      // marker. For non-chapter items the locator already names the kind.
      const fnHeaderItem =
        t.kind === 'chapter'
          ? `Tocqueville, Democracy in America — Volume ${t.volume === 1 ? 'I' : 'II'}, Part ${t.part}, Chapter ${t.chapter}`
          : `Tocqueville, Democracy in America — ${locator}`;
      chunks.push({
        id: `${item.id}:footnote:${fn.marker}`,
        item_id: item.id,
        corpus: 'tocqueville',
        kind: 'footnote',
        paragraph_index: null,
        marker: fn.marker,
        text: `${fnHeaderItem}\nFootnote ${fn.marker}\nAuthor: Tocqueville\n\n${fnText}`,
        paper_number: null as unknown as number,
        title: t.translated_title ?? item.title,
        authors_json: authorsJson,
        authorship_status: 'undisputed',
        date: item.date,
      });
    }
  }

  return chunks;
}
