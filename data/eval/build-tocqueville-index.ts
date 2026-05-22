// Append Tocqueville Volume I chunks to the Phase 1.1 retrieval index.
//
// Reads data/tocqueville/tocqueville.json (Vol I items only, where
// translation is populated), chunks the English translation (paragraph-level
// body + one chunk per footnote_translation entry), embeds each via Voyage
// voyage-4-large, and INSERTs into the existing data/eval/index.sqlite
// alongside the Federalist rows.
//
// Federalist rows are not touched. The script refuses to run if Tocqueville
// rows already exist unless --force is passed.
//
// Run:
//   node --experimental-strip-types data/eval/build-tocqueville-index.ts
//   node --experimental-strip-types data/eval/build-tocqueville-index.ts --force

import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import {
  loadEnv,
  voyageEmbed,
  openDb,
  tocquevilleChunks,
  EMBEDDING_DIM,
  EMBEDDING_MODEL,
} from './lib.ts';

const BATCH_SIZE = 128;

function assertSchema(db: ReturnType<typeof openDb>): void {
  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type IN ('table','view') AND name IN ('chunks','chunks_vec')")
    .all() as Array<{ name: string }>;
  const names = new Set(tables.map((t) => t.name));
  if (!names.has('chunks') || !names.has('chunks_vec')) {
    throw new Error(
      'Expected chunks and chunks_vec tables to exist. Run data/eval/build-index.ts first to create the Federalist baseline.',
    );
  }
  const cols = db.prepare('PRAGMA table_info(chunks)').all() as Array<{ name: string }>;
  const colNames = new Set(cols.map((c) => c.name));
  const required = [
    'rowid', 'id', 'item_id', 'corpus', 'kind', 'paragraph_index',
    'marker', 'text', 'paper_number', 'title', 'authors_json',
    'authorship_status', 'date',
  ];
  for (const r of required) {
    if (!colNames.has(r)) {
      throw new Error(`chunks table missing column "${r}". Schema drift; aborting.`);
    }
  }
}

async function main() {
  loadEnv();

  const force = process.argv.includes('--force');

  const db = openDb();

  assertSchema(db);

  console.log('Appending Tocqueville Vol I to retrieval index');
  console.log(`Model: ${EMBEDDING_MODEL} (dim ${EMBEDDING_DIM})`);

  const existing = db
    .prepare("SELECT COUNT(*) as n FROM chunks WHERE corpus = 'tocqueville'")
    .get() as { n: number };

  if (existing.n > 0 && !force) {
    throw new Error(
      `${existing.n} Tocqueville rows already present in chunks. Pass --force to delete and re-embed.`,
    );
  }

  if (existing.n > 0 && force) {
    console.log(`--force: deleting ${existing.n} existing Tocqueville rows...`);
    const existingRowids = db
      .prepare("SELECT rowid FROM chunks WHERE corpus = 'tocqueville'")
      .all() as Array<{ rowid: number }>;
    db.exec('BEGIN');
    const delChunk = db.prepare("DELETE FROM chunks WHERE corpus = 'tocqueville'");
    const delVec = db.prepare('DELETE FROM chunks_vec WHERE rowid = ?');
    delChunk.run();
    for (const r of existingRowids) delVec.run(BigInt(r.rowid));
    db.exec('COMMIT');
    console.log('  deleted.');
  }

  const fedCount = (db
    .prepare("SELECT COUNT(*) as n FROM chunks WHERE corpus = 'federalist'")
    .get() as { n: number }).n;
  console.log(`Federalist rows present (untouched): ${fedCount}`);

  const chunks = tocquevilleChunks();
  console.log(`Tocqueville chunks to embed: ${chunks.length}`);

  const maxRow = (db.prepare('SELECT COALESCE(MAX(rowid), 0) as m FROM chunks').get() as { m: number }).m;
  console.log(`Starting at rowid ${maxRow + 1}`);

  const insertChunk = db.prepare(`
    INSERT INTO chunks
      (rowid, id, item_id, corpus, kind, paragraph_index, marker, text,
       paper_number, title, authors_json, authorship_status, date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertVec = db.prepare('INSERT INTO chunks_vec(rowid, embedding) VALUES (?, ?)');

  let totalTokens = 0;
  const t0 = Date.now();

  for (let start = 0; start < chunks.length; start += BATCH_SIZE) {
    const batch = chunks.slice(start, start + BATCH_SIZE);
    const { embeddings, tokens } = await voyageEmbed(
      batch.map((c) => c.text),
      'document',
    );
    totalTokens += tokens;

    db.exec('BEGIN');
    for (let i = 0; i < batch.length; i++) {
      const c = batch[i];
      const rowid = maxRow + start + i + 1;
      insertChunk.run(
        rowid, c.id, c.item_id, c.corpus, c.kind,
        c.paragraph_index, c.marker, c.text,
        c.paper_number, c.title, c.authors_json,
        c.authorship_status, c.date,
      );
      insertVec.run(BigInt(rowid), new Uint8Array(new Float32Array(embeddings[i]).buffer));
    }
    db.exec('COMMIT');

    process.stdout.write(
      `  batched ${Math.min(start + BATCH_SIZE, chunks.length)}/${chunks.length} chunks (${tokens} tokens this batch)\n`,
    );
  }

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log('---');
  console.log(`Done. ${chunks.length} Tocqueville chunks indexed in ${elapsed}s.`);
  console.log(`Total embedding tokens: ${totalTokens.toLocaleString()}`);

  const counts = db
    .prepare("SELECT corpus, kind, COUNT(*) as n FROM chunks GROUP BY corpus, kind ORDER BY corpus, kind")
    .all() as Array<{ corpus: string; kind: string; n: number }>;
  console.log('Index now contains:');
  for (const r of counts) console.log(`  ${r.corpus} / ${r.kind}: ${r.n}`);

  db.close();
}

if (resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error('build-tocqueville-index failed:', e.message);
    process.exit(1);
  });
}
