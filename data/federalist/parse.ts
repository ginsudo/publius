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
const rawText = rawBytes.toString('utf8').replace(/\r\n/g, '\n').replace(/\r/g, '\n');

// Trim PG #1404 license boilerplate. The body of the work sits between the
// `*** START …` and `*** END …` markers; outside is PG metadata and the
// Project Gutenberg license. Trimming at load time keeps boilerplate out of
// every downstream consideration (heading scan, paper 85 trailing material,
// etc.) without touching the raw file.
const PG_START_RE = /^\*\*\* ?START OF (?:THE|THIS) PROJECT GUTENBERG EBOOK[^\n]*\*\*\*$/m;
const PG_END_RE = /^\*\*\* ?END OF (?:THE|THIS) PROJECT GUTENBERG EBOOK[^\n]*\*\*\*$/m;
const startMatch = rawText.match(PG_START_RE);
const endMatch = rawText.match(PG_END_RE);
if (!startMatch || !endMatch) {
  throw new Error('PG #1404 START/END boilerplate markers not found — file may have been replaced upstream.');
}
const text = rawText.slice(startMatch.index! + startMatch[0].length, endMatch.index!);

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

type Footnote = {
  marker: string;
  paragraphs: string[];
};

type Item = {
  id: string;
  corpus: 'federalist';
  title: string;
  authors: string[];
  date: string | null;
  language: 'en';
  paragraphs: string[];
  footnotes: Footnote[];
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

  // Split body into blocks; locate the PUBLIUS signature; everything before it
  // is body paragraphs, everything after is footnote material formatted as
  // `N. Footnote text` blocks (PG #1404 convention).
  const allBlocks = bodyRaw.split(/\n\s*\n/);
  const collapse = (b: string) => b.split('\n').map((l) => l.trim()).filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();

  // Locate PUBLIUS. PG #1404 normally puts it on its own line.
  //   - Paper 11 has a transcription quirk where the signature is mashed
  //     onto the same line as a trailing footnote citation.
  //   - Paper 37 has no closing PUBLIUS at all in PG #1404.
  // Detect each case; surface the anomaly for editorial review rather than
  // guessing how to split or fabricate.
  let publiusIdx = -1;
  for (let j = 0; j < allBlocks.length; j++) {
    const stripped = collapse(allBlocks[j]);
    if (stripped === 'PUBLIUS') {
      publiusIdx = j;
      break;
    }
    const malformed = stripped.match(/^PUBLIUS\s+(.+)$/);
    if (malformed) {
      publiusIdx = j;
      issues.push(`- Paper ${h.num}: PG #1404 malformed PUBLIUS block — signature is followed inline by trailing text \`${malformed[1].slice(0, 80)}\`. Likely a footnote citation that should follow the signature on its own line. Trailing text was NOT parsed into \`footnotes\` because the corresponding citation requires owner verification before encoding as an editorial correction. The inline marker will surface as an orphan in the next check.`);
      break;
    }
  }
  if (publiusIdx === -1) {
    // No PUBLIUS at all (paper 37). Treat the whole body as paragraphs;
    // no footnote section to extract. Surface the missing signature so the
    // discrepancy with PG #1404 isn't silent.
    issues.push(`- Paper ${h.num}: closing \`PUBLIUS\` signature is missing in PG #1404 (no separator block matches). Body parsed in full; \`footnotes\` left empty. Flag for editorial review.`);
    publiusIdx = allBlocks.length;
  }

  const paragraphs: string[] = [];
  for (const b of allBlocks.slice(0, publiusIdx)) {
    const para = collapse(b);
    if (para) paragraphs.push(para);
  }
  if (paragraphs.length === 0) {
    throw new Error(`Paper ${h.num}: zero paragraphs parsed`);
  }

  // Footnotes: each trailing block starts with a marker token. PG #1404 uses
  // two marker styles:
  //   - authorial footnotes: `N.` (e.g. `1.`) — Hamilton/Madison/Jay's notes
  //   - editorial annotations: `EN.` (e.g. `E1.`) — PG transcriber notes on
  //     variant readings between editions
  // Both flow into `footnotes` keyed by their inline-reference form (`(N)`
  // or `(E1)`). PG #1404 occasionally drops the period after the marker
  // (paper 24); the optional-period variant is accepted and logged.
  const FOOTNOTE_HEAD_RE = /^([A-Za-z]*\d+)(\.?)\s+([\s\S]+)$/;
  const footnotes: Footnote[] = [];
  for (const b of allBlocks.slice(publiusIdx + 1)) {
    const para = collapse(b);
    if (!para) continue;
    const m = para.match(FOOTNOTE_HEAD_RE);
    if (!m) {
      throw new Error(`Paper ${h.num}: trailing material after PUBLIUS does not match footnote pattern: "${para.slice(0, 80)}"`);
    }
    if (m[2] === '') {
      issues.push(`- Paper ${h.num}: footnote ${m[1]} in PG #1404 is missing the period after the marker (rendered as \`${m[1]} \` rather than the canonical \`${m[1]}. \`). Footnote stored as parsed; flag for editorial review.`);
    }
    footnotes.push({ marker: `(${m[1]})`, paragraphs: [m[3]] });
  }

  // Marker uniqueness within an item is the schema invariant that makes
  // inline-marker lookup reliable. Note: PG #1404 interleaves authorial and
  // editorial marker classes (1, E1, 2, E2…), so a strict monotonic check
  // across the combined sequence would be wrong. Uniqueness is the load-
  // bearing invariant; sequence ordering is corpus-source dependent.
  const seenMarkers = new Set<string>();
  for (const fn of footnotes) {
    if (seenMarkers.has(fn.marker)) {
      throw new Error(`Paper ${h.num}: duplicate footnote marker "${fn.marker}"`);
    }
    seenMarkers.add(fn.marker);
  }

  // Soft cross-checks: surface (don't throw) when footnote markers don't
  // appear inline, or when an inline `(X)` has no matching footnote. Either
  // suggests a transcription quirk worth editorial review.
  const bodyJoined = paragraphs.join(' ');
  for (const fn of footnotes) {
    if (!bodyJoined.includes(fn.marker)) {
      issues.push(`- Paper ${h.num}: footnote ${fn.marker} has no matching inline reference in body. Footnote stored as parsed; flag for editorial review.`);
    }
  }
  const INLINE_MARKER_RE = /\(([A-Za-z]*\d+)\)/g;
  const inlineMarkers = new Set<string>();
  for (const m of bodyJoined.matchAll(INLINE_MARKER_RE)) inlineMarkers.add(m[1]);
  const footnoteKeys = new Set(footnotes.map((fn) => fn.marker.slice(1, -1)));
  for (const k of inlineMarkers) {
    if (!footnoteKeys.has(k)) {
      // False positives: parenthesized digits in body that aren't footnote
      // refs (e.g., enumerations like "(1)" used as a list bullet inline).
      // Only flag when the paper has at least one real footnote — otherwise
      // this is almost certainly enumeration, not a missing footnote.
      if (footnotes.length > 0) {
        issues.push(`- Paper ${h.num}: inline reference (${k}) has no matching footnote. May be enumeration rather than footnote ref; flag for editorial review.`);
      }
    }
  }

  items.push({
    id: `federalist:${h.num}`,
    corpus: 'federalist',
    title,
    authors,
    date,
    language: 'en',
    paragraphs,
    footnotes,
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
    notes: 'Single-source, single-edition. CRLF line endings normalized to LF before parsing. Closing PUBLIUS signature lines stripped. Footnotes that PG #1404 prints after the signature (formatted as `N. Footnote text…` blocks) are extracted into the universal `footnotes` field per data/SCHEMA.md; inline reference form `(N)` is preserved verbatim in `paragraphs`.',
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
const papersWithFootnotes = items.filter((it) => it.footnotes.length > 0);
const totalFootnotes = items.reduce((acc, it) => acc + it.footnotes.length, 0);
console.log(`Papers with footnotes: ${papersWithFootnotes.length} (${totalFootnotes} footnotes total)`);
