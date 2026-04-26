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
      process.env[m[1]] = m[2];
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

import { existsSync, readdirSync } from 'node:fs';

function findVecExtension(): string {
  // Prefer macOS arm64 .dylib; fall back to any .dylib / .so in vendor/.
  if (!existsSync(VENDOR_DIR)) {
    throw new Error(
      `Vendor directory missing: ${VENDOR_DIR}\n` +
        'Fetch the sqlite-vec extension binary per data/eval/README.md.',
    );
  }
  const entries = readdirSync(VENDOR_DIR);
  const ext = entries.find((f) => /^vec0?\.(dylib|so)$/.test(f))
    ?? entries.find((f) => /\.(dylib|so)$/.test(f));
  if (!ext) {
    throw new Error(
      `No sqlite-vec extension binary found in ${VENDOR_DIR}.\n` +
        'Expected a file like vec0.dylib or vec0.so. See data/eval/README.md.',
    );
  }
  return resolve(VENDOR_DIR, ext);
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
