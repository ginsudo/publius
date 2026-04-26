// Phase 1.1 retrieval query CLI.
//
// Embeds a question via Voyage and returns the top-K nearest chunks from
// data/eval/index.sqlite, with full metadata.
//
// Run: node --experimental-strip-types data/eval/query.ts "your question" [--k=10] [--json]

import { loadEnv, openDb, voyageEmbed } from './lib.ts';

export type Hit = {
  rank: number;
  score: number;          // 1 - distance; higher = more similar
  distance: number;       // raw cosine distance from sqlite-vec
  id: string;
  item_id: string;
  corpus: string;
  kind: string;
  paragraph_index: number | null;
  marker: string | null;
  paper_number: number;
  title: string;
  authors: string[];
  authorship_status: string;
  date: string;
  text: string;           // the chunk text as embedded
};

export async function queryIndex(question: string, k: number = 10): Promise<Hit[]> {
  const db = openDb();
  try {
    const { embeddings } = await voyageEmbed([question], 'query');
    const queryEmbedding = new Float32Array(embeddings[0]).buffer;

    const rows = db
      .prepare(
        `SELECT
            c.id, c.item_id, c.corpus, c.kind, c.paragraph_index, c.marker,
            c.paper_number, c.title, c.authors_json, c.authorship_status,
            c.date, c.text, v.distance
         FROM chunks_vec v
         JOIN chunks c ON c.rowid = v.rowid
         WHERE v.embedding MATCH ? AND k = ?
         ORDER BY v.distance`,
      )
      .all(queryEmbedding, k) as any[];

    return rows.map((r, i) => ({
      rank: i + 1,
      score: 1 - r.distance,
      distance: r.distance,
      id: r.id,
      item_id: r.item_id,
      corpus: r.corpus,
      kind: r.kind,
      paragraph_index: r.paragraph_index,
      marker: r.marker,
      paper_number: r.paper_number,
      title: r.title,
      authors: JSON.parse(r.authors_json),
      authorship_status: r.authorship_status,
      date: r.date,
      text: r.text,
    }));
  } finally {
    db.close();
  }
}

function formatHit(h: Hit): string {
  const head = `${h.rank}. score=${h.score.toFixed(3)} (d=${h.distance.toFixed(3)})  ${h.item_id} ${h.kind}`;
  const where = h.kind === 'footnote'
    ? `footnote ${h.marker}`
    : `paragraph ${h.paragraph_index}`;
  const auth = h.authors.join(', ');
  const status = h.authorship_status === 'undisputed' ? '' : ` [${h.authorship_status}]`;
  const snippet = h.text.split('\n\n').slice(-1)[0].slice(0, 280).replace(/\s+/g, ' ');
  return `${head} ${where} — ${auth}${status}\n   "${snippet}${snippet.length >= 280 ? '…' : ''}"`;
}

async function main() {
  loadEnv();
  const args = process.argv.slice(2);
  let k = 10;
  let asJson = false;
  const positional: string[] = [];
  for (const a of args) {
    if (a === '--json') asJson = true;
    else if (a.startsWith('--k=')) k = parseInt(a.slice(4), 10);
    else positional.push(a);
  }
  const question = positional.join(' ').trim();
  if (!question) {
    console.error('usage: query.ts "<question>" [--k=10] [--json]');
    process.exit(2);
  }

  const hits = await queryIndex(question, k);

  if (asJson) {
    console.log(JSON.stringify({ question, k, hits }, null, 2));
    return;
  }
  console.log(`Q: ${question}`);
  console.log(`Top ${hits.length}:\n`);
  for (const h of hits) console.log(formatHit(h) + '\n');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    console.error('query failed:', e.message);
    process.exit(1);
  });
}
