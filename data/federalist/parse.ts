import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const RAW_PATH = join(here, 'raw', 'pg1404.txt');
const OUT_PATH = join(here, 'federalist.json');
const ISSUES_PATH = join(here, 'data_quality_issues.md');

const rawBytes = readFileSync(RAW_PATH);
const sha256 = createHash('sha256').update(rawBytes).digest('hex');
const text = rawBytes.toString('utf8').replace(/\r\n/g, '\n').replace(/\r/g, '\n');

const HEADING_RE = /^FEDERALIST No\. (\d{1,2})$/gm;
const headings: { num: number; index: number; lineEnd: number }[] = [];
for (const m of text.matchAll(HEADING_RE)) {
  headings.push({
    num: parseInt(m[1], 10),
    index: m.index!,
    lineEnd: m.index! + m[0].length,
  });
}
if (headings.length !== 85) {
  throw new Error(`Expected 85 paper headings, found ${headings.length}`);
}

const DATE_RE = /\b(For|From)\s+(?:[Tt]he\s+)?(.+?)\s+(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(\d{4})\.?/;
const BYLINE_RE = /^(HAMILTON|MADISON|JAY|MADISON, with HAMILTON|HAMILTON, with MADISON|HAMILTON AND MADISON|MADISON AND HAMILTON|HAMILTON OR MADISON|MADISON OR HAMILTON)$/m;

const MONTHS: Record<string, string> = {
  January: '01', February: '02', March: '03', April: '04',
  May: '05', June: '06', July: '07', August: '08',
  September: '09', October: '10', November: '11', December: '12',
};

const DISPUTED = new Set([49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 62, 63]);
const JOINT = new Set([18, 19, 20]);

const DISPUTED_NOTE =
  'One of the disputed twelve (Federalist 49–58, 62, 63). Hamilton claimed authorship in his pre-duel memorandum (1804); Madison claimed it in his later annotations. Modern scholarly consensus, following Mosteller and Wallace (1964), assigns the paper to Madison. Source byline in Project Gutenberg #1404 reads "MADISON".';
const JOINT_NOTE =
  'Jointly authored. The Project Gutenberg #1404 byline reads "MADISON, with HAMILTON", reflecting Madison as principal author with Hamilton contributing.';

// Editorial corrections to PG #1404 transcription errors. Each correction names
// the field, the parsed value, the corrected value, the reason, and the external
// sources verified by the project owner. Applied after extraction so the raw
// file remains untouched and the override is auditable in one place.
//
// Field codes follow the universal schema: bare names address universal fields
// (`date`, `title`); dotted names address extension fields (`federalist.publication.venue`).
type Correction = {
  field: 'date' | 'title' | 'federalist.publication.venue';
  from: string;
  to: string;
  reason: string;
  sources: string[];
};
const CORRECTIONS: Record<number, Correction[]> = {
  26: [
    {
      field: 'date',
      from: '1788-12-22',
      to: '1787-12-22',
      reason: 'PG #1404 dateline reads "Saturday, December 22, 1788" — a year transcription typo. Federalist 26 was published December 22, 1787.',
      sources: [
        'Founders Online (National Archives): https://founders.archives.gov/documents/Hamilton/01-04-02-0183',
        'Teaching American History — Federalist Papers timeline',
        'Ballotpedia — Federalist No. 26',
        'Wikipedia — Federalist No. 26',
      ],
    },
  ],
};

type Item = {
  id: string;
  corpus: 'federalist';
  title: string;
  authors: string[];
  date: string | null;
  language: 'en';
  paragraphs: string[];
  plain_english: null;
  constitutional_section: null;
  topic_tags: never[];
  federalist: {
    number: number;
    authorship_status: 'undisputed' | 'disputed' | 'joint';
    authorship_note: string | null;
    publication: {
      venue: string | null;
      raw_dateline: string;
    };
  };
};

const issues: string[] = [];
const items: Item[] = [];

for (let i = 0; i < headings.length; i++) {
  const h = headings[i];
  const blockEnd = i + 1 < headings.length ? headings[i + 1].index : text.length;
  const block = text.slice(h.lineEnd, blockEnd);

  const dateMatch = block.match(DATE_RE);
  if (!dateMatch) {
    throw new Error(`Paper ${h.num}: dateline not found`);
  }
  const dateStart = block.indexOf(dateMatch[0]);
  const dateEnd = dateStart + dateMatch[0].length;

  const titleRaw = block.slice(0, dateStart);
  const title = titleRaw
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .join(' ')
    .trim();

  const venue = dateMatch[2].replace(/\.$/, '').trim();
  const month = MONTHS[dateMatch[4]];
  const day = dateMatch[5].padStart(2, '0');
  const year = dateMatch[6];
  const date = `${year}-${month}-${day}`;
  const rawDateline = dateMatch[0].replace(/\s+/g, ' ').trim();

  const afterDate = block.slice(dateEnd);
  const bylineMatch = afterDate.match(BYLINE_RE);
  if (!bylineMatch) {
    throw new Error(`Paper ${h.num}: byline not found`);
  }
  const bylineStart = afterDate.indexOf(bylineMatch[0]);
  const bylineEnd = bylineStart + bylineMatch[0].length;
  const bodyRaw = afterDate.slice(bylineEnd);

  const sourceByline = bylineMatch[0];
  let authors: string[];
  let authorship_status: Item['federalist']['authorship_status'];
  let authorship_note: string | null;
  if (DISPUTED.has(h.num)) {
    authors = ['Madison'];
    authorship_status = 'disputed';
    authorship_note = DISPUTED_NOTE;
  } else if (JOINT.has(h.num)) {
    // PG byline order "MADISON, with HAMILTON" preserved in array order.
    authors = ['Madison', 'Hamilton'];
    authorship_status = 'joint';
    authorship_note = JOINT_NOTE;
  } else {
    if (sourceByline === 'HAMILTON') authors = ['Hamilton'];
    else if (sourceByline === 'MADISON') authors = ['Madison'];
    else if (sourceByline === 'JAY') authors = ['Jay'];
    else authors = [sourceByline];
    authorship_status = 'undisputed';
    authorship_note = null;
  }

  const paragraphs: string[] = [];
  for (const block of bodyRaw.split(/\n\s*\n/)) {
    const para = block.split('\n').map((l) => l.trim()).filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
    if (!para) continue;
    if (para === 'PUBLIUS') continue;
    paragraphs.push(para);
  }

  if (paragraphs.length === 0) {
    throw new Error(`Paper ${h.num}: zero paragraphs parsed`);
  }

  items.push({
    id: `federalist:${h.num}`,
    corpus: 'federalist',
    title,
    authors,
    date,
    language: 'en',
    paragraphs,
    plain_english: null,
    constitutional_section: null,
    topic_tags: [],
    federalist: {
      number: h.num,
      authorship_status,
      authorship_note,
      publication: { venue, raw_dateline: rawDateline },
    },
  });
}

items.sort((a, b) => a.federalist.number - b.federalist.number);
for (let i = 0; i < 85; i++) {
  if (items[i].federalist.number !== i + 1) {
    throw new Error(`Missing or duplicate paper at position ${i}: got ${items[i].federalist.number}`);
  }
}

// Apply editorial corrections. Each correction must match its declared `from`
// value before being applied — if PG #1404 ever updates and the typo is fixed
// upstream, the parser will fail loudly rather than re-corrupt the data.
const correctionsApplied: Array<{ number: number } & Correction> = [];
for (const [numStr, list] of Object.entries(CORRECTIONS)) {
  const num = parseInt(numStr, 10);
  const item = items[num - 1];
  for (const c of list) {
    let actual: string;
    if (c.field === 'date') actual = item.date ?? '';
    else if (c.field === 'title') actual = item.title;
    else if (c.field === 'federalist.publication.venue') actual = item.federalist.publication.venue ?? '';
    else throw new Error(`Unknown correction field: ${c.field}`);
    if (actual !== c.from) {
      throw new Error(`Correction precondition failed for paper ${num}.${c.field}: expected "${c.from}", got "${actual}". Source may have been updated upstream — review before re-applying.`);
    }
    if (c.field === 'date') item.date = c.to;
    else if (c.field === 'title') item.title = c.to;
    else if (c.field === 'federalist.publication.venue') item.federalist.publication.venue = c.to;
    correctionsApplied.push({ number: num, ...c });
  }
}

// Most papers were published in roughly chronological order, but the McLean's
// bound edition reordered some papers relative to their original newspaper
// publication dates. Federalist 29 ("Concerning the Militia," Jan 9 1788) was
// originally numbered 35 and inserted at position 29 by McLean — so the date
// labels for 29 and 30 are genuinely out of monotonic order, not typos.
// Flag papers whose dateline year disagrees with both immediate neighbors,
// excluding documented historical reorderings.
const KNOWN_REORDERED = new Set([29, 30]);
for (let i = 1; i < items.length - 1; i++) {
  if (KNOWN_REORDERED.has(items[i].federalist.number)) continue;
  const prev = items[i - 1].date?.slice(0, 4);
  const cur = items[i].date?.slice(0, 4);
  const next = items[i + 1].date?.slice(0, 4);
  if (cur && prev && next && cur !== prev && cur !== next) {
    issues.push(`- Paper ${items[i].federalist.number}: dateline year ${cur} disagrees with both neighbors (paper ${items[i - 1].federalist.number}: ${prev}, paper ${items[i + 1].federalist.number}: ${next}). Likely PG #1404 transcription typo. Date stored as parsed; flag for editorial review.`);
  }
}

const corpus = {
  corpus: 'federalist' as const,
  source: {
    edition: 'Project Gutenberg eBook #1404 — The Federalist Papers',
    url: 'https://www.gutenberg.org/ebooks/1404',
    sha256,
    fetched: new Date().toISOString().slice(0, 10),
    notes: 'Single-source, single-edition. CRLF line endings normalized to LF before parsing. Closing PUBLIUS signature lines stripped. Paragraphs preserve order including any footnote material that appears after the signature in the source.',
  },
  count: items.length,
  items,
};

writeFileSync(OUT_PATH, JSON.stringify(corpus, null, 2) + '\n');

const correctionsSection = correctionsApplied.length === 0
  ? '_No corrections applied._\n'
  : correctionsApplied.map((c) => {
      const sourceLines = c.sources.map((s) => `    - ${s}`).join('\n');
      return `- **Paper ${c.number}, \`${c.field}\`**: corrected from \`${c.from}\` to \`${c.to}\`.\n  - Reason: ${c.reason}\n  - Sources verified by project owner:\n${sourceLines}`;
    }).join('\n\n') + '\n';

const issuesSection = issues.length === 0
  ? '_No open issues._\n'
  : issues.join('\n') + '\n';

const issuesDoc = `# Federalist corpus — data quality

This file is regenerated by \`parse.ts\` on every run.

The editorial standard is: do not silently overwrite the source. Any deviation between \`federalist.json\` and Project Gutenberg #1404 must either (a) be applied as a logged correction with cited external sources verifying the correct value, or (b) be left as-is and surfaced as an open issue for editorial review.

## Corrections applied

These are values where \`federalist.json\` differs from PG #1404. The \`from\` value is what PG #1404 contains; the \`to\` value is what the JSON now stores. The parser refuses to apply a correction unless the \`from\` value matches what it actually parsed — so if PG #1404 is ever updated upstream and the typo is fixed there, this script will fail loudly rather than re-corrupt the data.

${correctionsSection}
## Open issues

Anomalies parsed faithfully from PG #1404 and surfaced here for editorial review. These have NOT been corrected; they remain as the source has them.

${issuesSection}`;
writeFileSync(ISSUES_PATH, issuesDoc);

console.log(`Wrote ${items.length} items to ${OUT_PATH}`);
console.log(`Source SHA256: ${sha256}`);
console.log(`Disputed: ${[...DISPUTED].sort((a, b) => a - b).join(', ')}`);
console.log(`Joint: ${[...JOINT].sort((a, b) => a - b).join(', ')}`);
console.log(`Corrections applied: ${correctionsApplied.length}`);
console.log(`Open issues: ${issues.length}`);
