import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const RAW_DIR = join(here, 'raw');
const OUT_PATH = join(here, 'tocqueville.json');
const ISSUES_PATH = join(here, 'data_quality_issues.md');

// =========================================================================
// Types
// =========================================================================

type Footnote = { marker: string; paragraphs: string[] };
type Kind = 'avertissement' | 'introduction' | 'chapter' | 'end_note' | 'appendix';
type Volume = 1 | 2;
type Part = 1 | 2 | 3 | 4;
type TomeNum = 1 | 2 | 3 | 4;

type TocquevilleExt = {
  volume: Volume;
  part: Part | null;
  chapter: number | null;
  kind: Kind;
  chapter_summary: string | null;
  references_page: number | null;
  tome: TomeNum;
  end_notes_referenced: string[];
  translation: string[] | null;
};

type Item = {
  id: string;
  corpus: 'tocqueville';
  title: string;
  authors: string[];
  date: string;
  language: 'fr';
  paragraphs: string[];
  footnotes: Footnote[];
  plain_english: null;
  constitutional_section: null;
  topic_tags: string[];
  tocqueville: TocquevilleExt;
};

type TomeConfig = {
  tome: TomeNum;
  file: string;
  pgId: string;
  volume: Volume;
  // Implicit part for chapters in this tome (vol I tomes have no PARTIE markers).
  // null for tomes that carry explicit PREMIÈRE PARTIE / DEUXIÈME PARTIE markers.
  implicitPart: Part | null;
  date: string;
  // tome 1 has bullet-summary blocks between each chapter title and body; other tomes don't.
  chaptersHaveSummary: boolean;
};

const TOMES: TomeConfig[] = [
  { tome: 1, file: 'tome1.txt', pgId: '30513', volume: 1, implicitPart: 1, date: '1835-01-01', chaptersHaveSummary: true },
  { tome: 2, file: 'tome2.txt', pgId: '30514', volume: 1, implicitPart: 2, date: '1835-01-01', chaptersHaveSummary: false },
  { tome: 3, file: 'tome3.txt', pgId: '30515', volume: 2, implicitPart: null, date: '1840-01-01', chaptersHaveSummary: false },
  { tome: 4, file: 'tome4.txt', pgId: '30516', volume: 2, implicitPart: null, date: '1840-01-01', chaptersHaveSummary: false },
];

// Pagnerre 1848 augmentations carry their composition date, not the original-volume date.
const VOL1_AVERTISSEMENT_DATE = '1848-01-01';
const APPENDIX_DATE = '1848-01-01';

// =========================================================================
// Boilerplate trim
// =========================================================================

const PG_START_RE = /^\*\*\* ?START OF (?:THE|THIS) PROJECT GUTENBERG EBOOK[^\n]*\*\*\*$/m;
const PG_END_RE = /^\*\*\* ?END OF (?:THE|THIS) PROJECT GUTENBERG EBOOK[^\n]*\*\*\*$/m;

// =========================================================================
// Section markers — each must be the entire trimmed line content
// =========================================================================

const RE_AVERTISSEMENT = /^AVERTISSEMENT\.?$/;
const RE_INTRODUCTION = /^INTRODUCTION\.?$/;
const RE_PARTIE = /^(PREMIÈRE|DEUXIÈME|TROISIÈME|QUATRIÈME) PARTIE\.?$/;
const RE_CHAPITRE = /^CHAPITRE ([IVXLCDM]+)\.?$/;
const RE_NOTES_HEADER = /^NOTES?\.?$/;
const RE_APPENDICE = /^APPENDICE\.?$/;
const RE_TABLE = /^TABLE\.?$/;

// End-note markers: lettered (vol I tomes 1-2) and TN-prefixed (vol II tome 4).
const RE_LETTERED_NOTE = /^\(_([A-Z]+)_\) PAGE (\d+)\.?$/;
const RE_TN_NOTE = /^NOTE PAGE (\d+)\.\[TN-([A-Z]+)\]$/;

// Inline footnote body block (chapter footnote): `         [Note N: text...`
const RE_FOOTNOTE_BODY_START = /^\s+\[Note (\d+):\s*(.*)$/;

const PARTIE_MAP: Record<string, Part> = {
  'PREMIÈRE': 1, 'DEUXIÈME': 2, 'TROISIÈME': 3, 'QUATRIÈME': 4,
};

function romanToInt(s: string): number {
  const map: Record<string, number> = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
  let result = 0;
  for (let i = 0; i < s.length; i++) {
    const cur = map[s[i]];
    const next = map[s[i + 1]];
    if (next && cur < next) result -= cur; else result += cur;
  }
  return result;
}

// =========================================================================
// Marker scan
// =========================================================================

type Marker =
  | { kind: 'avertissement'; line: number }
  | { kind: 'introduction'; line: number }
  | { kind: 'partie'; line: number; part: Part }
  | { kind: 'chapter'; line: number; chapter: number }
  | { kind: 'notes_header'; line: number }
  | { kind: 'appendice'; line: number }
  | { kind: 'table'; line: number }
  | { kind: 'lettered_note'; line: number; letter: string; page: number }
  | { kind: 'tn_note'; line: number; letter: string; page: number };

function scanMarkers(lines: string[]): Marker[] {
  const markers: Marker[] = [];
  for (let i = 0; i < lines.length; i++) {
    const ln = lines[i].trim();
    let m: RegExpMatchArray | null;
    if (RE_AVERTISSEMENT.test(ln)) markers.push({ kind: 'avertissement', line: i });
    else if (RE_INTRODUCTION.test(ln)) markers.push({ kind: 'introduction', line: i });
    else if ((m = ln.match(RE_PARTIE))) markers.push({ kind: 'partie', line: i, part: PARTIE_MAP[m[1]] });
    else if ((m = ln.match(RE_CHAPITRE))) markers.push({ kind: 'chapter', line: i, chapter: romanToInt(m[1]) });
    else if (RE_NOTES_HEADER.test(ln)) markers.push({ kind: 'notes_header', line: i });
    else if (RE_APPENDICE.test(ln)) markers.push({ kind: 'appendice', line: i });
    else if (RE_TABLE.test(ln)) markers.push({ kind: 'table', line: i });
    else if ((m = ln.match(RE_LETTERED_NOTE))) markers.push({ kind: 'lettered_note', line: i, letter: m[1], page: parseInt(m[2], 10) });
    else if ((m = ln.match(RE_TN_NOTE))) markers.push({ kind: 'tn_note', line: i, letter: m[2], page: parseInt(m[1], 10) });
  }
  return markers;
}

// =========================================================================
// Body extraction (paragraphs + inline footnotes)
// =========================================================================

function extractBody(lines: string[], start: number, end: number): {
  paragraphs: string[];
  footnotes: Footnote[];
} {
  const paragraphs: string[] = [];
  const footnotes: Footnote[] = [];
  let paraLines: string[] = [];

  const flushPara = () => {
    if (paraLines.length === 0) return;
    const text = paraLines.join(' ').replace(/\s+/g, ' ').trim();
    if (text) paragraphs.push(text);
    paraLines = [];
  };

  let i = start;
  while (i < end) {
    const line = lines[i];

    const fnMatch = line.match(RE_FOOTNOTE_BODY_START);
    if (fnMatch) {
      flushPara();
      const marker = `[${fnMatch[1]}]`;
      const pieces: string[] = [fnMatch[2]];
      // Multi-line footnote: keep collecting until a line ends with `]`
      if (!lines[i].trimEnd().endsWith(']')) {
        i++;
        while (i < end) {
          pieces.push(lines[i].trim());
          if (lines[i].trimEnd().endsWith(']')) break;
          i++;
        }
      }
      const body = pieces.join(' ').replace(/\]\s*$/, '').replace(/\s+/g, ' ').trim();
      footnotes.push({ marker, paragraphs: [body] });
      i++;
      continue;
    }

    if (line.trim() === '') {
      flushPara();
      i++;
      continue;
    }

    paraLines.push(line.trim());
    i++;
  }
  flushPara();

  return { paragraphs, footnotes };
}

// =========================================================================
// Item builders
// =========================================================================

function consumeHeading(lines: string[], from: number, end: number): { text: string; nextLine: number } {
  // Skip blanks, then read non-blank lines until next blank, joined with space.
  let i = from;
  while (i < end && lines[i].trim() === '') i++;
  const out: string[] = [];
  while (i < end && lines[i].trim() !== '') {
    out.push(lines[i].trim());
    i++;
  }
  // Strip trailing period and normalize whitespace.
  const text = out.join(' ').replace(/\.\s*$/, '').replace(/\s+/g, ' ').trim();
  return { text, nextLine: i };
}

function buildChapter(lines: string[], start: number, end: number, config: TomeConfig, part: Part, chapNum: number): Item {
  // start is the CHAPITRE N. line. Title follows after blanks.
  const { text: title, nextLine: afterTitle } = consumeHeading(lines, start + 1, end);

  // Optional summary block (only tome 1 chapters carry these).
  let summary: string | null = null;
  let bodyStart = afterTitle;
  if (config.chaptersHaveSummary) {
    // Skip blanks
    let j = afterTitle;
    while (j < end && lines[j].trim() === '') j++;
    // Summary block: indented (5 spaces typical), continues until blank line, contains `--` separators.
    // Distinguish from a footnote body by the leading-bracket check.
    if (j < end && /^ {3,}/.test(lines[j]) && !RE_FOOTNOTE_BODY_START.test(lines[j])) {
      const sumLines: string[] = [];
      while (j < end && lines[j].trim() !== '') {
        sumLines.push(lines[j].trim());
        j++;
      }
      summary = sumLines.join(' ').replace(/\s+/g, ' ').trim();
      bodyStart = j;
    }
  }

  const { paragraphs, footnotes } = extractBody(lines, bodyStart, end);

  return {
    id: `tocqueville:vol${config.volume}.part${part}.ch${chapNum}`,
    corpus: 'tocqueville',
    title,
    authors: ['Tocqueville'],
    date: config.date,
    language: 'fr',
    paragraphs,
    footnotes,
    plain_english: null,
    constitutional_section: null,
    topic_tags: [],
    tocqueville: {
      volume: config.volume,
      part,
      chapter: chapNum,
      kind: 'chapter',
      chapter_summary: summary,
      references_page: null,
      tome: config.tome,
      end_notes_referenced: [],
      translation: null,
    },
  };
}

function buildAvertissement(lines: string[], start: number, end: number, config: TomeConfig): Item {
  const isVol1 = config.volume === 1;
  const title = isVol1 ? 'Avertissement de la dixième édition' : 'Avertissement';
  const date = isVol1 ? VOL1_AVERTISSEMENT_DATE : config.date;

  // Skip the AVERTISSEMENT line itself.
  let bodyStart = start + 1;
  while (bodyStart < end && lines[bodyStart].trim() === '') bodyStart++;
  // Tome 1 has a subtitle line "DE LA DIXIÈME ÉDITION." — skip it.
  if (isVol1 && bodyStart < end && /^DE LA [A-ZÉÈÊÀÂÎÔÛÇ]+ ÉDITION\.?$/.test(lines[bodyStart].trim())) {
    bodyStart++;
    while (bodyStart < end && lines[bodyStart].trim() === '') bodyStart++;
  }

  const { paragraphs, footnotes } = extractBody(lines, bodyStart, end);

  return {
    id: `tocqueville:vol${config.volume}.avertissement`,
    corpus: 'tocqueville',
    title,
    authors: ['Tocqueville'],
    date,
    language: 'fr',
    paragraphs,
    footnotes,
    plain_english: null,
    constitutional_section: null,
    topic_tags: [],
    tocqueville: {
      volume: config.volume,
      part: null,
      chapter: null,
      kind: 'avertissement',
      chapter_summary: null,
      references_page: null,
      tome: config.tome,
      end_notes_referenced: [],
      translation: null,
    },
  };
}

function buildIntroduction(lines: string[], start: number, end: number, config: TomeConfig): Item {
  let bodyStart = start + 1;
  while (bodyStart < end && lines[bodyStart].trim() === '') bodyStart++;
  const { paragraphs, footnotes } = extractBody(lines, bodyStart, end);

  return {
    id: `tocqueville:vol${config.volume}.introduction`,
    corpus: 'tocqueville',
    title: 'Introduction',
    authors: ['Tocqueville'],
    date: config.date,
    language: 'fr',
    paragraphs,
    footnotes,
    plain_english: null,
    constitutional_section: null,
    topic_tags: [],
    tocqueville: {
      volume: config.volume,
      part: null,
      chapter: null,
      kind: 'introduction',
      chapter_summary: null,
      references_page: null,
      tome: config.tome,
      end_notes_referenced: [],
      translation: null,
    },
  };
}

function buildAppendix(lines: string[], start: number, end: number, config: TomeConfig): Item {
  let bodyStart = start + 1;
  while (bodyStart < end && lines[bodyStart].trim() === '') bodyStart++;
  const { paragraphs, footnotes } = extractBody(lines, bodyStart, end);

  return {
    id: `tocqueville:vol${config.volume}.appendix`,
    corpus: 'tocqueville',
    title: 'Examen comparatif de la Démocratie aux États-Unis et en Suisse',
    authors: ['Tocqueville'],
    date: APPENDIX_DATE,
    language: 'fr',
    paragraphs,
    footnotes,
    plain_english: null,
    constitutional_section: null,
    topic_tags: [],
    tocqueville: {
      volume: config.volume,
      part: null,
      chapter: null,
      kind: 'appendix',
      chapter_summary: null,
      references_page: null,
      tome: config.tome,
      end_notes_referenced: [],
      translation: null,
    },
  };
}

function buildEndNote(lines: string[], start: number, end: number, config: TomeConfig, letter: string, page: number, isTN: boolean): Item {
  let bodyStart = start + 1;
  while (bodyStart < end && lines[bodyStart].trim() === '') bodyStart++;
  const { paragraphs, footnotes } = extractBody(lines, bodyStart, end);

  const idLetter = isTN ? `TN-${letter}` : letter;
  const titlePrefix = isTN ? `Note ${letter}` : `Note ${letter}`;
  const title = `${titlePrefix} (page ${page})`;

  return {
    id: `tocqueville:vol${config.volume}.t${config.tome}.notes.${idLetter}`,
    corpus: 'tocqueville',
    title,
    authors: ['Tocqueville'],
    date: config.date,
    language: 'fr',
    paragraphs,
    footnotes,
    plain_english: null,
    constitutional_section: null,
    topic_tags: [],
    tocqueville: {
      volume: config.volume,
      part: null,
      chapter: null,
      kind: 'end_note',
      chapter_summary: null,
      references_page: page,
      tome: config.tome,
      end_notes_referenced: [],
      translation: null,
    },
  };
}

function buildTome2Preamble(lines: string[], end: number, config: TomeConfig): Item | null {
  // Find the inner heading "EN AMÉRIQUE." (the second occurrence; the first is at the printer-block heading).
  let headerEndIdx = -1;
  for (let i = 0; i < end; i++) {
    if (lines[i].trim() === 'EN AMÉRIQUE.') headerEndIdx = i;
  }
  if (headerEndIdx === -1) return null;

  let bodyStart = headerEndIdx + 1;
  while (bodyStart < end && lines[bodyStart].trim() === '') bodyStart++;
  const { paragraphs, footnotes } = extractBody(lines, bodyStart, end);
  if (paragraphs.length === 0) return null;

  return {
    id: 'tocqueville:vol1.preamble.part2',
    corpus: 'tocqueville',
    title: 'Avant-propos à la deuxième partie',
    authors: ['Tocqueville'],
    date: config.date,
    language: 'fr',
    paragraphs,
    footnotes,
    plain_english: null,
    constitutional_section: null,
    topic_tags: [],
    tocqueville: {
      volume: 1,
      part: 2,
      chapter: null,
      kind: 'introduction',
      chapter_summary: null,
      references_page: null,
      tome: 2,
      end_notes_referenced: [],
      translation: null,
    },
  };
}

// =========================================================================
// Per-tome parse
// =========================================================================

type TomeParseResult = {
  items: Item[];
  sha: string;
  bytes: number;
};

function parseTome(config: TomeConfig): TomeParseResult {
  const filePath = join(RAW_DIR, config.file);
  const rawBytes = readFileSync(filePath);
  const sha = createHash('sha256').update(rawBytes).digest('hex');
  let text = rawBytes.toString('utf-8').replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  const startMatch = text.match(PG_START_RE);
  const endMatch = text.match(PG_END_RE);
  if (!startMatch || !endMatch) {
    throw new Error(`PG START/END boilerplate markers not found in ${config.file}`);
  }
  text = text.slice(startMatch.index! + startMatch[0].length, endMatch.index!);

  const lines = text.split('\n');
  const markers = scanMarkers(lines);

  // Find content boundaries.
  // - First marker → end of front matter.
  // - TABLE marker → end of content (followed by table-of-contents listings).
  // For tome 2: no AVERTISSEMENT/INTRODUCTION marker, but there's a preamble before CHAPITRE I.
  const tableMarkerIdx = markers.findIndex(m => m.kind === 'table');
  const lastContentMarkerIdx = tableMarkerIdx >= 0 ? tableMarkerIdx : markers.length;

  const items: Item[] = [];
  let currentPart: Part | null = config.implicitPart;

  for (let mi = 0; mi < lastContentMarkerIdx; mi++) {
    const marker = markers[mi];
    // The slice for this item runs from the marker line to the next marker (or to TABLE).
    const nextMarkerLine = mi + 1 < markers.length ? markers[mi + 1].line : lines.length;

    switch (marker.kind) {
      case 'partie':
        currentPart = marker.part;
        break;
      case 'notes_header':
        // No item; subsequent markers will be lettered_note / tn_note.
        break;
      case 'avertissement':
        items.push(buildAvertissement(lines, marker.line, nextMarkerLine, config));
        break;
      case 'introduction':
        items.push(buildIntroduction(lines, marker.line, nextMarkerLine, config));
        break;
      case 'chapter':
        if (currentPart === null) {
          throw new Error(`${config.file}: chapter ${marker.chapter} encountered with no current part (line ${marker.line})`);
        }
        items.push(buildChapter(lines, marker.line, nextMarkerLine, config, currentPart, marker.chapter));
        break;
      case 'appendice':
        items.push(buildAppendix(lines, marker.line, nextMarkerLine, config));
        break;
      case 'lettered_note':
        items.push(buildEndNote(lines, marker.line, nextMarkerLine, config, marker.letter, marker.page, false));
        break;
      case 'tn_note':
        items.push(buildEndNote(lines, marker.line, nextMarkerLine, config, marker.letter, marker.page, true));
        break;
      case 'table':
        // Unreachable due to lastContentMarkerIdx slicing.
        break;
    }
  }

  // Tome 2 preamble: lives between the inner header and the first chapter, with no marker.
  if (config.tome === 2) {
    const firstChapterIdx = markers.findIndex(m => m.kind === 'chapter');
    if (firstChapterIdx >= 0) {
      const preamble = buildTome2Preamble(lines, markers[firstChapterIdx].line, config);
      if (preamble) {
        // Insert preamble before the first chapter item.
        const firstChapterItemIdx = items.findIndex(it => it.tocqueville.kind === 'chapter');
        items.splice(firstChapterItemIdx, 0, preamble);
      }
    }
  }

  return { items, sha, bytes: rawBytes.length };
}

// =========================================================================
// Run
// =========================================================================

const tomeResults = TOMES.map(parseTome);
const allItems: Item[] = tomeResults.flatMap(r => r.items);

// =========================================================================
// Invariant checks
// =========================================================================

const issues: string[] = [];

// Item ID uniqueness.
const seenIds = new Set<string>();
for (const it of allItems) {
  if (seenIds.has(it.id)) issues.push(`Duplicate item id: ${it.id}`);
  seenIds.add(it.id);
}

// Per-item footnote marker uniqueness.
for (const it of allItems) {
  const seen = new Set<string>();
  for (const fn of it.footnotes) {
    if (seen.has(fn.marker)) issues.push(`Duplicate footnote marker ${fn.marker} in item ${it.id}`);
    seen.add(fn.marker);
  }
}

// Chapter count per (volume, part) — verify against canonical.
const chapterCounts: Record<string, number> = {};
for (const it of allItems) {
  if (it.tocqueville.kind === 'chapter') {
    const key = `vol${it.tocqueville.volume}.part${it.tocqueville.part}`;
    chapterCounts[key] = (chapterCounts[key] ?? 0) + 1;
  }
}
const EXPECTED_CHAPTERS: Record<string, number> = {
  'vol1.part1': 8, 'vol1.part2': 10,
  'vol2.part1': 21, 'vol2.part2': 20, 'vol2.part3': 26, 'vol2.part4': 8,
};
for (const [key, expected] of Object.entries(EXPECTED_CHAPTERS)) {
  const actual = chapterCounts[key] ?? 0;
  if (actual !== expected) issues.push(`Chapter count mismatch ${key}: expected ${expected}, got ${actual}`);
}

// Cross-reference: every inline [N] marker (in title or body) must resolve
// to a footnote on the same item; every footnote must have at least one
// inline reference.
const RE_INLINE_NUM = /\[(\d+)\]/g;
for (const it of allItems) {
  const inlineMarkers = new Set<string>();
  for (const text of [it.title, ...it.paragraphs]) {
    let m: RegExpExecArray | null;
    const re = new RegExp(RE_INLINE_NUM.source, 'g');
    while ((m = re.exec(text)) !== null) inlineMarkers.add(`[${m[1]}]`);
  }
  const fnMarkers = new Set(it.footnotes.map(f => f.marker));
  for (const inline of inlineMarkers) {
    if (!fnMarkers.has(inline)) issues.push(`Inline marker ${inline} in ${it.id} has no matching footnote`);
  }
  for (const fn of fnMarkers) {
    if (!inlineMarkers.has(fn)) issues.push(`Footnote ${fn} in ${it.id} has no inline reference`);
  }
}

// Cross-reference: every TN marker in a tome-4 chapter must resolve to a
// standalone end-note item.
const noteIds = new Set(allItems.filter(i => i.tocqueville.kind === 'end_note').map(i => i.id));
const RE_TN = /\[TN-([A-Z]+)\]/g;
for (const it of allItems) {
  if (it.tocqueville.kind !== 'chapter' || it.tocqueville.tome !== 4) continue;
  for (const text of [it.title, ...it.paragraphs]) {
    let m: RegExpExecArray | null;
    const re = new RegExp(RE_TN.source, 'g');
    while ((m = re.exec(text)) !== null) {
      const id = `tocqueville:vol2.t4.notes.TN-${m[1]}`;
      if (!noteIds.has(id)) issues.push(`TN marker ${m[0]} in ${it.id} has no matching end-note item`);
    }
  }
}

// =========================================================================
// Output
// =========================================================================

const sources = TOMES.map((t, i) => ({
  tome: t.tome,
  volume: t.volume,
  pg_id: t.pgId,
  file: `raw/${t.file}`,
  sha256: tomeResults[i].sha,
  bytes: tomeResults[i].bytes,
}));

const json = {
  corpus: 'tocqueville',
  source: {
    edition: 'Pagnerre 1848 (12th ed. for Vol I, 5th ed. for Vol II)',
    publisher: 'Project Gutenberg',
    url: 'https://www.gutenberg.org/',
    transcribed_from: 'Bibliothèque nationale de France (BnF/Gallica)',
    note: 'Volume I (1835) = tomes 1+2; Volume II (1840) = tomes 3+4. The Pagnerre 1848 edition adds the "Avertissement de la dixième édition" (Vol I) and the "Examen comparatif de la Démocratie aux États-Unis et en Suisse" (Appendix). Edition fidelity verification deferred to Phase 4.',
    tomes: sources,
  },
  count: allItems.length,
  items: allItems,
};

writeFileSync(OUT_PATH, JSON.stringify(json, null, 2) + '\n', 'utf-8');

// =========================================================================
// data_quality_issues.md (regenerated each run)
// =========================================================================

let report = '# Tocqueville corpus — data quality\n\n';
report += 'This file is regenerated by `parse.ts` on every run.\n\n';
report += 'The editorial standard is: do not silently overwrite the source. Any deviation between `tocqueville.json` and the PG French tomes (#30513–#30516) must either (a) be applied as a logged correction or fixup with cited external sources, or (b) be left as-is and surfaced as an open issue for editorial review.\n\n';

report += '## Source-text fixups applied\n\n';
report += '_None._\n\n';

report += '## Field corrections applied\n\n';
report += '_None._\n\n';

report += '## Acknowledged quirks (no action)\n\n';
report += '_None._\n\n';

report += '## Open issues\n\n';
if (issues.length === 0) {
  report += '_No open issues._\n';
} else {
  for (const issue of issues) report += `- ${issue}\n`;
}

writeFileSync(ISSUES_PATH, report, 'utf-8');

// =========================================================================
// Summary to stdout
// =========================================================================

console.log(`Wrote ${allItems.length} items to ${OUT_PATH}`);
console.log('Per-tome SHA256:');
for (const s of sources) console.log(`  tome ${s.tome} (PG #${s.pg_id}): ${s.sha256}`);
const kindCounts: Record<string, number> = {};
for (const it of allItems) {
  kindCounts[it.tocqueville.kind] = (kindCounts[it.tocqueville.kind] ?? 0) + 1;
}
console.log(`Item kinds: ${JSON.stringify(kindCounts)}`);
console.log(`Chapter counts: ${JSON.stringify(chapterCounts)}`);
const totalFootnotes = allItems.reduce((s, it) => s + it.footnotes.length, 0);
const itemsWithFootnotes = allItems.filter(it => it.footnotes.length > 0).length;
console.log(`Inline footnotes: ${itemsWithFootnotes} items carry ${totalFootnotes} footnotes`);
console.log(`Open issues: ${issues.length}`);
