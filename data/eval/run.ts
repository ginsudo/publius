// Run the Phase 1.1 retrieval probe set against the index.
//
// Reads data/eval/probes.json, skips phase_5_only probes, queries each
// active probe via the same code path as query.ts, writes a markdown
// report to data/eval/results.md for owner review.
//
// Pass criterion is qualitative: project owner reads results.md and signs
// off on the hits. The runner reports must_include hit/miss as a sanity
// signal but does not gate on it.
//
// Run: node --experimental-strip-types data/eval/run.ts [--k=10]

import { readFileSync, writeFileSync } from 'node:fs';
import {
  loadEnv,
  PROBES_PATH,
  RESULTS_PATH,
  EMBEDDING_MODEL,
} from './lib.ts';
import { queryIndex, type Hit } from './query.ts';

type MustInclude = {
  item_id: string;
  kind?: string;
  marker?: string;
  note?: string;
};

type Probe = {
  id: string;
  category: string;
  phase_5_only: boolean;
  question: string;
  must_include: MustInclude[];
  rationale: string;
};

function chunkMatches(h: Hit, mi: MustInclude): boolean {
  if (h.item_id !== mi.item_id) return false;
  if (mi.kind && h.kind !== mi.kind) return false;
  if (mi.marker && h.marker !== mi.marker) return false;
  return true;
}

function snippet(h: Hit, max: number = 320): string {
  // Drop the header (everything up to the first blank line) and trim the body.
  const body = h.text.split('\n\n').slice(1).join(' ').replace(/\s+/g, ' ');
  return body.length > max ? body.slice(0, max) + '…' : body;
}

function formatHit(h: Hit): string {
  const where = h.kind === 'footnote'
    ? `footnote ${h.marker}`
    : `paragraph ${h.paragraph_index}`;
  const auth = h.authors.join(', ');
  const status = h.authorship_status === 'undisputed' ? '' : ` _[${h.authorship_status}]_`;
  return [
    `${h.rank}. **score ${h.score.toFixed(3)}** — \`${h.item_id}\` ${where} — ${auth}${status}`,
    `   > ${snippet(h)}`,
  ].join('\n');
}

async function main() {
  loadEnv();

  const args = process.argv.slice(2);
  let k = 10;
  for (const a of args) {
    if (a.startsWith('--k=')) k = parseInt(a.slice(4), 10);
  }

  const probesFile = JSON.parse(readFileSync(PROBES_PATH, 'utf8'));
  const allProbes = probesFile.probes as Probe[];
  const active = allProbes.filter((p) => !p.phase_5_only);
  const skipped = allProbes.filter((p) => p.phase_5_only);

  console.log(`Probes: ${active.length} active, ${skipped.length} skipped (phase_5_only)`);
  console.log(`Top-K: ${k}`);
  console.log(`Model: ${EMBEDDING_MODEL}`);

  const lines: string[] = [];
  const date = new Date().toISOString().slice(0, 10);
  lines.push(`# Phase 1.1 retrieval test — results`);
  lines.push('');
  lines.push(`Generated ${date} against \`data/eval/index.sqlite\` using ${EMBEDDING_MODEL}, top-K=${k}.`);
  lines.push('');
  lines.push(`Pass criterion is **qualitative owner sign-off**, not an automated metric. The "must-include" check below is a sanity signal — a probe whose must-include items don't appear in top-K is a yellow flag, but a probe with all must-include items present can still fail if the surrounding hits are wrong, and a probe with missing must-include items can still pass if the actual top hits answer the question well. Read the hits, judge them, fill in the "Owner judgment" line.`);
  lines.push('');
  lines.push(`Skipped (\`phase_5_only: true\`, recorded for design intent): ${skipped.map((p) => p.id).join(', ')}.`);
  lines.push('');
  lines.push('---');
  lines.push('');

  let totalHits = 0;
  for (const probe of active) {
    const hits = await queryIndex(probe.question, k);
    totalHits += hits.length;

    const mustHits = probe.must_include.map((mi) => ({
      mi,
      hit: hits.find((h) => chunkMatches(h, mi)),
    }));

    lines.push(`## ${probe.id} — ${probe.category}`);
    lines.push('');
    lines.push(`**Question:** ${probe.question}`);
    lines.push('');
    if (probe.must_include.length === 0) {
      lines.push('**Must include:** _(none — qualitative probe)_');
    } else {
      lines.push('**Must include:**');
      lines.push('');
      for (const m of mustHits) {
        const target = [m.mi.item_id, m.mi.kind, m.mi.marker].filter(Boolean).join(' ');
        const status = m.hit ? `✓ rank ${m.hit.rank}, score ${m.hit.score.toFixed(3)}` : '✗ not in top-' + k;
        lines.push(`- ${target} — ${status}`);
      }
    }
    lines.push('');
    lines.push(`**Top ${k}:**`);
    lines.push('');
    for (const h of hits) lines.push(formatHit(h));
    lines.push('');
    lines.push(`**Rationale (probe design):** ${probe.rationale}`);
    lines.push('');
    lines.push(`**Owner judgment:** _pass / partial / fail_ — `);
    lines.push('');
    lines.push('**Notes:** ');
    lines.push('');
    lines.push('---');
    lines.push('');

    process.stdout.write(`  ${probe.id} (${probe.category}) — ${hits.length} hits\n`);
  }

  writeFileSync(RESULTS_PATH, lines.join('\n'));
  console.log('---');
  console.log(`Wrote ${RESULTS_PATH}`);
  console.log(`${active.length} probes × ${k} hits = ${totalHits} total result rows`);
  console.log('Review results.md and fill in the Owner judgment lines.');
}

main().catch((e) => {
  console.error('run failed:', e.message);
  process.exit(1);
});
