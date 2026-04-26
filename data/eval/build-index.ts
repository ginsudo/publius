// Build the Phase 1.1 retrieval index.
//
// Reads data/federalist/federalist.json, chunks it (paragraph-level body
// + one chunk per footnote), embeds each chunk via Voyage voyage-4-large,
// writes data/eval/index.sqlite (sqlite-vec virtual table + metadata table).
//
// Idempotent: drops and recreates tables on each run.
//
// Run: node --experimental-strip-types data/eval/build-index.ts

import {
  loadEnv,
  voyageEmbed,
  openDb,
  federalistChunks,
  EMBEDDING_DIM,
  EMBEDDING_MODEL,
} from './lib.ts';

const BATCH_SIZE = 128;

async function main() {
  loadEnv();
  const db = openDb();

  console.log('Building Phase 1.1 retrieval index');
  console.log(`Model: ${EMBEDDING_MODEL} (dim ${EMBEDDING_DIM})`);

  const chunks = federalistChunks();
  console.log(`Chunks: ${chunks.length} from data/federalist/federalist.json`);

  db.exec(`
    DROP TABLE IF EXISTS chunks;
    DROP TABLE IF EXISTS chunks_vec;
    CREATE TABLE chunks (
      rowid INTEGER PRIMARY KEY,
      id TEXT UNIQUE NOT NULL,
      item_id TEXT NOT NULL,
      corpus TEXT NOT NULL,
      kind TEXT NOT NULL,
      paragraph_index INTEGER,
      marker TEXT,
      text TEXT NOT NULL,
      paper_number INTEGER,
      title TEXT,
      authors_json TEXT,
      authorship_status TEXT,
      date TEXT
    );
    CREATE INDEX idx_chunks_item ON chunks(item_id);
    CREATE INDEX idx_chunks_corpus_kind ON chunks(corpus, kind);
  `);
  db.exec(`
    CREATE VIRTUAL TABLE chunks_vec USING vec0(
      embedding float[${EMBEDDING_DIM}] distance_metric=cosine
    );
  `);

  const insertChunk = db.prepare(`
    INSERT INTO chunks
      (rowid, id, item_id, corpus, kind, paragraph_index, marker, text,
       paper_number, title, authors_json, authorship_status, date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertVec = db.prepare(`
    INSERT INTO chunks_vec(rowid, embedding) VALUES (?, ?)
  `);

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
      const rowid = start + i + 1;
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
  console.log(`Done. ${chunks.length} chunks indexed in ${elapsed}s.`);
  console.log(`Total embedding tokens: ${totalTokens.toLocaleString()}`);
  const counts = db
    .prepare('SELECT kind, COUNT(*) as n FROM chunks GROUP BY kind')
    .all() as Array<{ kind: string; n: number }>;
  for (const r of counts) console.log(`  ${r.kind}: ${r.n}`);

  db.close();
}

main().catch((e) => {
  console.error('build-index failed:', e.message);
  process.exit(1);
});
