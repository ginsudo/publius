// Phase 3.2 editorial review CLI. Supports federalist and tocqueville
// corpora via the CorpusAdapter abstraction; SCOTUS will add a third
// adapter when its annotations exist.
//
// Run:
//   node --experimental-strip-types scripts/review-annotations.ts
//   node --experimental-strip-types scripts/review-annotations.ts --corpus federalist
//   node --experimental-strip-types scripts/review-annotations.ts --corpus tocqueville
//
// Per-tier flows (requires triage_tier populated by scripts/triage-annotations.ts):
//   node --experimental-strip-types scripts/review-annotations.ts --corpus federalist --tier accept
//   node --experimental-strip-types scripts/review-annotations.ts --corpus federalist --tier rewrite
//   node --experimental-strip-types scripts/review-annotations.ts --corpus federalist --tier manual
//
// --tier accept   — show the full batch of accept-tier units (triage_tier
//                   "accept", editorial_status null), one confirm prompt,
//                   auto-apply (sets editorial_status to "accepted") on y.
// --tier rewrite  — per-unit review filtered to rewrite-tier units. The
//                   triage rationale is shown inline; rewrites are NEVER
//                   auto-applied (use `f` to confirm flag-for-rewrite, or
//                   override with `a`/`e`).
// --tier manual   — per-unit review filtered to manual-tier units. The
//                   triage rationale is shown inline as a first opinion;
//                   the owner uses the full command set as before.
//
// The script pages through a flat stream of reviewable units in document
// order. A reviewable unit is a paragraph (federalist) or a paragraph or
// footnote (tocqueville). Only units with flags appear in the stream;
// unflagged units are skipped, matching the original federalist behavior.
// Footnotes are interleaved into the tocqueville stream at the position of
// their first inline marker reference (in title or paragraphs).

import { readFileSync, writeFileSync, renameSync, mkdtempSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createInterface } from 'node:readline/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { REPO_ROOT, FEDERALIST_PATH } from '../data/eval/lib.ts';

// ---------------------------------------------------------------------------
// File-level types visible to all adapters and the main loop.
// ---------------------------------------------------------------------------

type EditorialStatus = null | 'accepted' | 'edited' | 'flagged_for_rewrite';

type NormalizedFlag = {
  kind: string;
  label: string | null;
  note: string;
};

type EditorialState = {
  editorial_status: EditorialStatus;
  editorial_note: string | null;
};

// Triage tier assigned by scripts/triage-annotations.ts. null when the
// unit has not been triaged (either pre-triage or rubric version mismatch).
type Tier = 'accept' | 'rewrite' | 'manual';

type TriageState = {
  triage_tier: Tier | null;
  triage_rationale: string | null;
  triage_generated_at: string | null;
};

type StreamUnit =
  | {
      kind: 'paragraph';
      itemIdx: number;
      itemAnnIdx: number;
      paragraphIndex: number;
      paragraphAnnIdx: number;
    }
  | {
      kind: 'footnote';
      itemIdx: number;
      itemAnnIdx: number;
      footnoteCorpusIdx: number;
      footnoteAnnIdx: number;
      marker: string;
    };

type EditTarget = { text: string };

type LocatorResolve =
  | { ok: true; predicate: (u: StreamUnit) => boolean; describe: string }
  | { ok: false; usage: string };

type ReviewSummary = {
  accepted: number;
  edited: number;
  flagged_for_rewrite: number;
  unreviewed: number;
};

interface CorpusAdapter {
  readonly slug: 'federalist' | 'tocqueville';
  buildStream(): StreamUnit[];
  renderUnit(
    unit: StreamUnit,
    position: number,
    total: number,
    reviewed: number,
  ): string;
  // Short single-line locator-style description for use in the launch
  // summary's "first unreviewed unit" line. Adapter-specific because the
  // human-readable identifier differs by corpus (paper number vs item_id).
  describeUnit(unit: StreamUnit): string;
  parseLocator(rest: string[]): LocatorResolve;
  getEditorialState(unit: StreamUnit): EditorialState;
  getTriageState(unit: StreamUnit): TriageState;
  getFlags(unit: StreamUnit): NormalizedFlag[];
  readEditTarget(unit: StreamUnit): EditTarget | null;
  // Mutators — each writes through to disk atomically.
  acceptUnit(unit: StreamUnit): void;
  flagUnit(unit: StreamUnit, note: string | null): void;
  setNote(unit: StreamUnit, note: string): void;
  unsetUnit(unit: StreamUnit): void;
  applyEdit(unit: StreamUnit, newText: string): void;
}

// ---------------------------------------------------------------------------
// Atomic JSON write — temp + rename. Trailing newline matches existing files.
// ---------------------------------------------------------------------------

function atomicWriteJson(path: string, obj: unknown): void {
  const tmp = path + '.tmp';
  writeFileSync(tmp, JSON.stringify(obj, null, 2) + '\n');
  renameSync(tmp, path);
}

// ---------------------------------------------------------------------------
// Federalist adapter.
// ---------------------------------------------------------------------------

type FedCorrection = {
  paragraph_index: number;
  original_text: string;
  corrected_text: string;
  source: string;
  rationale: string;
  corrected_at: string;
};

type FedItem = {
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
  corrections?: FedCorrection[];
};

type FedCorpus = {
  corpus: 'federalist';
  source: Record<string, unknown>;
  count: number;
  items: FedItem[];
};

type FedFlagKind = 'AMBIGUOUS' | 'WORD' | 'RHETORIC';

type FedFlagEntry = {
  kind: FedFlagKind;
  term: string | null;
  note: string;
};

type FedParagraphAnn = {
  paragraph_index: number;
  bypassed?: true;
  flags: FedFlagEntry[];
  editorial_status: EditorialStatus;
  editorial_note: string | null;
  triage_tier: Tier | null;
  triage_rationale: string | null;
  triage_generated_at: string | null;
};

type FedPaperAnn = {
  paper_number: number;
  paragraphs: FedParagraphAnn[];
};

type FedAnnotations = {
  corpus: 'federalist';
  generated_at: string;
  prompt_version: string;
  prompt_sha256: string;
  papers: FedPaperAnn[];
};

function createFederalistAdapter(): CorpusAdapter {
  const corpusPath = FEDERALIST_PATH;
  const annPath = resolve(REPO_ROOT, 'data', 'federalist', 'federalist-annotations.json');

  const corpus: FedCorpus = JSON.parse(readFileSync(corpusPath, 'utf8'));
  const ann: FedAnnotations = JSON.parse(readFileSync(annPath, 'utf8'));

  const itemIdxByNumber = new Map<number, number>();
  corpus.items.forEach((it, i) => itemIdxByNumber.set(it.federalist.number, i));

  function paraAnn(unit: StreamUnit): FedParagraphAnn {
    if (unit.kind !== 'paragraph') {
      throw new Error('federalist adapter received non-paragraph stream unit');
    }
    return ann.papers[unit.itemAnnIdx].paragraphs[unit.paragraphAnnIdx];
  }

  function item(unit: StreamUnit): FedItem {
    return corpus.items[unit.itemIdx];
  }

  return {
    slug: 'federalist',

    buildStream(): StreamUnit[] {
      const out: StreamUnit[] = [];
      ann.papers.forEach((paper, paperAnnIdx) => {
        const itemIdx = itemIdxByNumber.get(paper.paper_number);
        if (itemIdx === undefined) {
          throw new Error(
            `paper ${paper.paper_number} present in annotations but not in corpus`,
          );
        }
        paper.paragraphs.forEach((para, paraAnnIdx) => {
          if (para.flags.length > 0) {
            out.push({
              kind: 'paragraph',
              itemIdx,
              itemAnnIdx: paperAnnIdx,
              paragraphIndex: para.paragraph_index,
              paragraphAnnIdx: paraAnnIdx,
            });
          }
        });
      });
      return out;
    },

    renderUnit(unit, position, total, reviewed): string {
      if (unit.kind !== 'paragraph') {
        throw new Error('federalist adapter received non-paragraph stream unit');
      }
      const it = item(unit);
      const pa = paraAnn(unit);
      const original = it.paragraphs[unit.paragraphIndex];
      const plain =
        it.plain_english !== null
          ? it.plain_english[unit.paragraphIndex] ?? '(plain_english missing for this index)'
          : '(plain_english not populated)';

      const lines: string[] = [];
      lines.push('');
      lines.push('[Federalist]');
      lines.push(`--- Federalist No. ${it.federalist.number} — ${it.title}`);
      lines.push(
        `--- ${it.authors.join(', ')} | Paragraph ${unit.paragraphIndex} of ${it.paragraphs.length} | flagged ${position}/${total} | reviewed ${reviewed}/${total}`,
      );
      if (pa.triage_tier !== null) {
        lines.push('');
        lines.push(
          `TRIAGE: ${pa.triage_tier}${pa.triage_rationale !== null ? ' — ' + pa.triage_rationale : ''}`,
        );
      }
      lines.push('');
      lines.push('ORIGINAL:');
      lines.push(original);
      lines.push('');
      lines.push('PLAIN ENGLISH:');
      lines.push(plain);
      lines.push('');
      lines.push(`FLAGS (${pa.flags.length}):`);
      for (const f of pa.flags) {
        if (f.term !== null) {
          lines.push(`[${f.kind}] "${f.term}" — ${f.note}`);
        } else {
          lines.push(`[${f.kind}] ${f.note}`);
        }
      }
      lines.push('');
      lines.push(`STATUS: ${pa.editorial_status ?? '—'}`);
      if (pa.editorial_note !== null) lines.push(`NOTE: ${pa.editorial_note}`);
      lines.push('');
      return lines.join('\n');
    },

    parseLocator(rest): LocatorResolve {
      if (rest.length !== 2) {
        return { ok: false, usage: 'g <paper> <para>' };
      }
      const paperN = Number(rest[0]);
      const paraI = Number(rest[1]);
      if (!Number.isInteger(paperN) || !Number.isInteger(paraI)) {
        return {
          ok: false,
          usage: 'g <paper> <para> — both must be integers',
        };
      }
      const describe = `${paperN}:${paraI}`;
      const predicate = (u: StreamUnit): boolean => {
        if (u.kind !== 'paragraph') return false;
        const paper = ann.papers[u.itemAnnIdx];
        return paper.paper_number === paperN && u.paragraphIndex === paraI;
      };
      return { ok: true, predicate, describe };
    },

    describeUnit(unit): string {
      if (unit.kind !== 'paragraph') {
        throw new Error('federalist adapter received non-paragraph stream unit');
      }
      const paper = ann.papers[unit.itemAnnIdx];
      return `Federalist No. ${paper.paper_number}, paragraph ${unit.paragraphIndex}`;
    },

    getEditorialState(unit): EditorialState {
      const pa = paraAnn(unit);
      return {
        editorial_status: pa.editorial_status,
        editorial_note: pa.editorial_note,
      };
    },

    getTriageState(unit): TriageState {
      const pa = paraAnn(unit);
      return {
        triage_tier: pa.triage_tier,
        triage_rationale: pa.triage_rationale,
        triage_generated_at: pa.triage_generated_at,
      };
    },

    getFlags(unit): NormalizedFlag[] {
      return paraAnn(unit).flags.map(f => ({
        kind: f.kind,
        label: f.term,
        note: f.note,
      }));
    },

    readEditTarget(unit): EditTarget | null {
      if (unit.kind !== 'paragraph') return null;
      const it = item(unit);
      if (it.plain_english === null) return null;
      const text = it.plain_english[unit.paragraphIndex];
      if (typeof text !== 'string') return null;
      return { text };
    },

    acceptUnit(unit): void {
      const pa = paraAnn(unit);
      pa.editorial_status = 'accepted';
      atomicWriteJson(annPath, ann);
    },

    flagUnit(unit, note): void {
      const pa = paraAnn(unit);
      pa.editorial_status = 'flagged_for_rewrite';
      pa.editorial_note = note;
      atomicWriteJson(annPath, ann);
    },

    setNote(unit, note): void {
      const pa = paraAnn(unit);
      pa.editorial_note = note;
      atomicWriteJson(annPath, ann);
    },

    unsetUnit(unit): void {
      const pa = paraAnn(unit);
      pa.editorial_status = null;
      pa.editorial_note = null;
      atomicWriteJson(annPath, ann);
    },

    applyEdit(unit, newText): void {
      if (unit.kind !== 'paragraph') {
        throw new Error('federalist adapter received non-paragraph stream unit');
      }
      const it = item(unit);
      if (it.plain_english === null) {
        throw new Error('plain_english not populated; cannot apply edit');
      }
      it.plain_english[unit.paragraphIndex] = newText;
      const pa = paraAnn(unit);
      pa.editorial_status = 'edited';
      atomicWriteJson(corpusPath, corpus);
      atomicWriteJson(annPath, ann);
    },
  };
}

// ---------------------------------------------------------------------------
// Tocqueville adapter. Stream is paragraphs + footnotes interleaved: each
// footnote enters the stream at the position of its first inline marker
// reference (in title or paragraphs).
// ---------------------------------------------------------------------------

type TocItem = {
  id: string;
  corpus: 'tocqueville';
  title: string;
  authors: string[];
  date: string;
  language: string;
  paragraphs: string[];
  footnotes: { marker: string; paragraphs: string[] }[];
  plain_english: string[] | null;
  constitutional_section: string | null;
  topic_tags: string[];
  tocqueville: {
    volume: number;
    part: number | null;
    chapter: number | null;
    kind: string;
    chapter_summary: string | null;
    references_page: string | null;
    tome: number;
    end_notes_referenced: string[];
    translation: string[] | null;
    footnotes_translation: { marker: string; paragraphs: string[] }[] | null;
  };
};

type TocCorpus = {
  corpus: 'tocqueville';
  source: Record<string, unknown>;
  count: number;
  items: TocItem[];
};

type TocFlagKind = 'READING' | 'TEXTURE' | 'TERM';

type TocFlagEntry = {
  kind: TocFlagKind;
  french: string | null;
  note: string;
};

type TocParagraphAnn = {
  paragraph_index: number;
  flags: TocFlagEntry[];
  editorial_status: EditorialStatus;
  editorial_note: string | null;
  triage_tier: Tier | null;
  triage_rationale: string | null;
  triage_generated_at: string | null;
};

type TocFootnoteAnn = {
  marker: string;
  flags: TocFlagEntry[];
  editorial_status: EditorialStatus;
  editorial_note: string | null;
  triage_tier: Tier | null;
  triage_rationale: string | null;
  triage_generated_at: string | null;
};

type TocItemAnn = {
  item_id: string;
  paragraphs: TocParagraphAnn[];
  footnotes: TocFootnoteAnn[];
};

type TocAnnotations = {
  corpus: 'tocqueville';
  generated_at: string;
  prompt_version: string;
  prompt_sha256: string;
  volume: number;
  items: TocItemAnn[];
};

// Matches [63], [A], [TN-C]. Used for both title and paragraph scans.
const INLINE_MARKER_RE = /\[[A-Za-z0-9][A-Za-z0-9-]*\]/g;

function createTocquevilleAdapter(): CorpusAdapter {
  const corpusPath = resolve(REPO_ROOT, 'data', 'tocqueville', 'tocqueville.json');
  const annPath = resolve(REPO_ROOT, 'data', 'tocqueville', 'tocqueville-annotations.json');

  const corpus: TocCorpus = JSON.parse(readFileSync(corpusPath, 'utf8'));
  const ann: TocAnnotations = JSON.parse(readFileSync(annPath, 'utf8'));

  const itemIdxById = new Map<string, number>();
  corpus.items.forEach((it, i) => itemIdxById.set(it.id, i));

  function paraAnn(unit: StreamUnit): TocParagraphAnn {
    if (unit.kind !== 'paragraph') {
      throw new Error('tocqueville paraAnn called on non-paragraph unit');
    }
    return ann.items[unit.itemAnnIdx].paragraphs[unit.paragraphAnnIdx];
  }

  function footnoteAnn(unit: StreamUnit): TocFootnoteAnn {
    if (unit.kind !== 'footnote') {
      throw new Error('tocqueville footnoteAnn called on non-footnote unit');
    }
    return ann.items[unit.itemAnnIdx].footnotes[unit.footnoteAnnIdx];
  }

  function item(unit: StreamUnit): TocItem {
    return corpus.items[unit.itemIdx];
  }

  function writeAnnotations(): void {
    atomicWriteJson(annPath, ann);
  }

  function writeCorpus(): void {
    atomicWriteJson(corpusPath, corpus);
  }

  function getState(unit: StreamUnit): EditorialState {
    const a = unit.kind === 'paragraph' ? paraAnn(unit) : footnoteAnn(unit);
    return {
      editorial_status: a.editorial_status,
      editorial_note: a.editorial_note,
    };
  }

  function getTriage(unit: StreamUnit): TriageState {
    const a = unit.kind === 'paragraph' ? paraAnn(unit) : footnoteAnn(unit);
    return {
      triage_tier: a.triage_tier,
      triage_rationale: a.triage_rationale,
      triage_generated_at: a.triage_generated_at,
    };
  }

  function flagsOf(unit: StreamUnit): NormalizedFlag[] {
    const a = unit.kind === 'paragraph' ? paraAnn(unit) : footnoteAnn(unit);
    return a.flags.map(f => ({
      kind: f.kind,
      label: f.french,
      note: f.note,
    }));
  }

  return {
    slug: 'tocqueville',

    buildStream(): StreamUnit[] {
      const out: StreamUnit[] = [];

      ann.items.forEach((annItem, itemAnnIdx) => {
        const itemIdx = itemIdxById.get(annItem.item_id);
        if (itemIdx === undefined) {
          throw new Error(
            `item ${annItem.item_id} present in annotations but not in corpus`,
          );
        }
        const it = corpus.items[itemIdx];

        // Map marker → { corpus footnote index, ann footnote index, flagged }.
        const fnByMarker = new Map<
          string,
          { corpusIdx: number; annIdx: number; flagged: boolean }
        >();
        for (let i = 0; i < it.footnotes.length; i++) {
          const marker = it.footnotes[i].marker;
          const annIdx = annItem.footnotes.findIndex(f => f.marker === marker);
          if (annIdx < 0) {
            throw new Error(
              `corpus footnote ${annItem.item_id} ${marker} has no annotation entry`,
            );
          }
          fnByMarker.set(marker, {
            corpusIdx: i,
            annIdx,
            flagged: annItem.footnotes[annIdx].flags.length > 0,
          });
        }

        const emitted = new Set<string>();
        const emitFootnotesFromText = (text: string): void => {
          const matches = text.match(INLINE_MARKER_RE);
          if (!matches) return;
          for (const m of matches) {
            const meta = fnByMarker.get(m);
            if (!meta || !meta.flagged || emitted.has(m)) continue;
            out.push({
              kind: 'footnote',
              itemIdx,
              itemAnnIdx,
              footnoteCorpusIdx: meta.corpusIdx,
              footnoteAnnIdx: meta.annIdx,
              marker: m,
            });
            emitted.add(m);
          }
        };

        emitFootnotesFromText(it.title);

        annItem.paragraphs.forEach((paraEntry, paraAnnIdx) => {
          if (paraEntry.flags.length > 0) {
            out.push({
              kind: 'paragraph',
              itemIdx,
              itemAnnIdx,
              paragraphIndex: paraEntry.paragraph_index,
              paragraphAnnIdx: paraAnnIdx,
            });
          }
          const paraText = it.paragraphs[paraEntry.paragraph_index];
          if (typeof paraText === 'string') emitFootnotesFromText(paraText);
        });

        for (const [marker, meta] of fnByMarker) {
          if (meta.flagged && !emitted.has(marker)) {
            throw new Error(
              `flagged footnote ${annItem.item_id} ${marker} never referenced inline in title or paragraphs`,
            );
          }
        }
      });

      return out;
    },

    renderUnit(unit, position, total, reviewed): string {
      const it = item(unit);
      const lines: string[] = [];
      lines.push('');
      lines.push('[Tocqueville]');
      lines.push(`--- ${it.id} — ${it.title}`);

      if (unit.kind === 'paragraph') {
        const pa = paraAnn(unit);
        const original = it.paragraphs[unit.paragraphIndex];
        const translation =
          it.tocqueville.translation !== null
            ? it.tocqueville.translation[unit.paragraphIndex] ??
              '(translation missing for this index)'
            : '(translation not populated)';

        lines.push(
          `--- Paragraph ${unit.paragraphIndex} of ${it.paragraphs.length} | flagged ${position}/${total} | reviewed ${reviewed}/${total}`,
        );
        if (pa.triage_tier !== null) {
          lines.push('');
          lines.push(
            `TRIAGE: ${pa.triage_tier}${pa.triage_rationale !== null ? ' — ' + pa.triage_rationale : ''}`,
          );
        }
        lines.push('');
        lines.push('ORIGINAL (FR):');
        lines.push(original);
        lines.push('');
        lines.push('TRANSLATION:');
        lines.push(translation);
        lines.push('');
        lines.push(`FLAGS (${pa.flags.length}):`);
        for (const f of pa.flags) {
          if (f.french !== null) {
            lines.push(`[${f.kind}] "${f.french}" — ${f.note}`);
          } else {
            lines.push(`[${f.kind}] ${f.note}`);
          }
        }
        lines.push('');
        lines.push(`STATUS: ${pa.editorial_status ?? '—'}`);
        if (pa.editorial_note !== null) lines.push(`NOTE: ${pa.editorial_note}`);
        lines.push('');
        return lines.join('\n');
      }

      // footnote
      const fnAnn = footnoteAnn(unit);
      const fnCorpus = it.footnotes[unit.footnoteCorpusIdx];
      const fnTranslation =
        it.tocqueville.footnotes_translation !== null
          ? it.tocqueville.footnotes_translation[unit.footnoteCorpusIdx]
          : null;

      const originalBody = fnCorpus.paragraphs.join('\n\n');
      const translatedBody =
        fnTranslation !== null
          ? fnTranslation.paragraphs.join('\n\n')
          : '(footnotes_translation not populated)';

      lines.push(
        `--- Footnote ${unit.marker} | flagged ${position}/${total} | reviewed ${reviewed}/${total}`,
      );
      if (fnAnn.triage_tier !== null) {
        lines.push('');
        lines.push(
          `TRIAGE: ${fnAnn.triage_tier}${fnAnn.triage_rationale !== null ? ' — ' + fnAnn.triage_rationale : ''}`,
        );
      }
      lines.push('');
      lines.push('ORIGINAL (FR):');
      lines.push(originalBody);
      lines.push('');
      lines.push('TRANSLATION:');
      lines.push(translatedBody);
      lines.push('');
      lines.push(`FLAGS (${fnAnn.flags.length}):`);
      for (const f of fnAnn.flags) {
        if (f.french !== null) {
          lines.push(`[${f.kind}] "${f.french}" — ${f.note}`);
        } else {
          lines.push(`[${f.kind}] ${f.note}`);
        }
      }
      lines.push('');
      lines.push(`STATUS: ${fnAnn.editorial_status ?? '—'}`);
      if (fnAnn.editorial_note !== null) lines.push(`NOTE: ${fnAnn.editorial_note}`);
      lines.push('');
      return lines.join('\n');
    },

    parseLocator(rest): LocatorResolve {
      if (rest.length !== 2) {
        return {
          ok: false,
          usage: 'g <item_id> <paragraph_index>  or  g <item_id> <marker>',
        };
      }
      const itemId = rest[0];
      const second = rest[1];

      // Integer → paragraph. Bracketed or alpha-leading → footnote marker.
      if (/^\d+$/.test(second)) {
        const paraI = Number(second);
        return {
          ok: true,
          describe: `${itemId} ¶${paraI}`,
          predicate: (u: StreamUnit): boolean => {
            if (u.kind !== 'paragraph') return false;
            return (
              ann.items[u.itemAnnIdx].item_id === itemId &&
              u.paragraphIndex === paraI
            );
          },
        };
      }

      let marker: string;
      if (/^\[.+\]$/.test(second)) {
        marker = second;
      } else if (/^[A-Za-z][A-Za-z0-9-]*$/.test(second)) {
        marker = `[${second}]`;
      } else {
        return {
          ok: false,
          usage:
            'g <item_id> <paragraph_index>  or  g <item_id> <marker>  (marker like [63] or [TN-C])',
        };
      }

      return {
        ok: true,
        describe: `${itemId} ${marker}`,
        predicate: (u: StreamUnit): boolean => {
          if (u.kind !== 'footnote') return false;
          return (
            ann.items[u.itemAnnIdx].item_id === itemId && u.marker === marker
          );
        },
      };
    },

    describeUnit(unit): string {
      const itemId = ann.items[unit.itemAnnIdx].item_id;
      if (unit.kind === 'paragraph') {
        return `${itemId} ¶${unit.paragraphIndex}`;
      }
      return `${itemId} ${unit.marker}`;
    },

    getEditorialState: getState,
    getTriageState: getTriage,
    getFlags: flagsOf,

    readEditTarget(unit): EditTarget | null {
      const it = item(unit);
      if (unit.kind === 'paragraph') {
        const tr = it.tocqueville.translation;
        if (tr === null) return null;
        const text = tr[unit.paragraphIndex];
        if (typeof text !== 'string') return null;
        return { text };
      }
      const ftr = it.tocqueville.footnotes_translation;
      if (ftr === null) return null;
      const entry = ftr[unit.footnoteCorpusIdx];
      if (!entry) return null;
      return { text: entry.paragraphs.join('\n\n') };
    },

    acceptUnit(unit): void {
      const a = unit.kind === 'paragraph' ? paraAnn(unit) : footnoteAnn(unit);
      a.editorial_status = 'accepted';
      writeAnnotations();
    },

    flagUnit(unit, note): void {
      const a = unit.kind === 'paragraph' ? paraAnn(unit) : footnoteAnn(unit);
      a.editorial_status = 'flagged_for_rewrite';
      a.editorial_note = note;
      writeAnnotations();
    },

    setNote(unit, note): void {
      const a = unit.kind === 'paragraph' ? paraAnn(unit) : footnoteAnn(unit);
      a.editorial_note = note;
      writeAnnotations();
    },

    unsetUnit(unit): void {
      const a = unit.kind === 'paragraph' ? paraAnn(unit) : footnoteAnn(unit);
      a.editorial_status = null;
      a.editorial_note = null;
      writeAnnotations();
    },

    applyEdit(unit, newText): void {
      const it = item(unit);
      if (unit.kind === 'paragraph') {
        if (it.tocqueville.translation === null) {
          throw new Error('translation not populated; cannot apply edit');
        }
        it.tocqueville.translation[unit.paragraphIndex] = newText;
        const pa = paraAnn(unit);
        pa.editorial_status = 'edited';
        writeCorpus();
        writeAnnotations();
        return;
      }
      // footnote — split joined body back into paragraphs[].
      if (it.tocqueville.footnotes_translation === null) {
        throw new Error('footnotes_translation not populated; cannot apply edit');
      }
      const split = newText
        .split(/\n{2,}/)
        .map(p => p.trim())
        .filter(p => p.length > 0);
      if (split.length === 0) {
        throw new Error('edit produced empty footnote body; refusing to write');
      }
      it.tocqueville.footnotes_translation[unit.footnoteCorpusIdx].paragraphs = split;
      const fa = footnoteAnn(unit);
      fa.editorial_status = 'edited';
      writeCorpus();
      writeAnnotations();
    },
  };
}

// ---------------------------------------------------------------------------
// Editor flow — adapter-agnostic.
// ---------------------------------------------------------------------------

type EditOutcome = { changed: false } | { changed: true; newText: string };

function runEditor(currentText: string): EditOutcome {
  const dir = mkdtempSync(resolve(tmpdir(), 'publius-review-'));
  const filePath = resolve(dir, 'unit.txt');
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
// Help and summary.
// ---------------------------------------------------------------------------

const HELP = `
Commands:
  n / next         — advance to next flagged unit (skips reviewed if toggle on)
  p / prev         — back to previous flagged unit (skips reviewed if toggle on)
  g <locator>      — jump to a flagged unit
                     federalist:   g <paper> <para>
                     tocqueville:  g <item_id> <paragraph_index>
                                   g <item_id> <marker>     (e.g. g tocqueville:vol1.part2.ch6 [63])
  g next | g n     — jump to first unreviewed flagged unit in document order
  a / accept       — set editorial_status = "accepted"; advance
                     (prompts to overwrite if status is already set)
  e / edit         — open $EDITOR with current rendering; on save, write
                     back to corpus and set status = "edited"; advance
  f / flag         — set editorial_status = "flagged_for_rewrite"; prompts for
                     an optional note; advance
                     (prompts to overwrite if status is already set)
  F                — flag for rewrite without note prompt; preserves any
                     existing note; advance
                     (prompts to overwrite if status is already set)
  m <note>         — set editorial_note (status unchanged); stay
  u / unset        — clear status and note; stay
  s                — toggle skip-reviewed mode for n/p navigation
  q / quit         — print summary and exit
  ? / help         — show this help
`;

type SessionStats = {
  accepted: number;
  flagged_for_rewrite: number;
};

function summarize(
  adapter: CorpusAdapter,
  flagged: StreamUnit[],
): ReviewSummary {
  const counts: ReviewSummary = {
    accepted: 0,
    edited: 0,
    flagged_for_rewrite: 0,
    unreviewed: 0,
  };
  for (const u of flagged) {
    const st = adapter.getEditorialState(u).editorial_status;
    if (st === null) counts.unreviewed++;
    else counts[st]++;
  }
  return counts;
}

function findFirstUnreviewed(
  flagged: StreamUnit[],
  adapter: CorpusAdapter,
): number {
  for (let i = 0; i < flagged.length; i++) {
    if (adapter.getEditorialState(flagged[i]).editorial_status === null) return i;
  }
  return -1;
}

// Walks from `from` (exclusive) in `direction` (+1 forward, -1 backward) and
// returns the index of the next unreviewed flagged unit, or -1 if none. Used
// by n/p when skip-reviewed mode is on.
function findNextUnreviewedFrom(
  flagged: StreamUnit[],
  adapter: CorpusAdapter,
  from: number,
  direction: 1 | -1,
): number {
  for (let i = from + direction; i >= 0 && i < flagged.length; i += direction) {
    if (adapter.getEditorialState(flagged[i]).editorial_status === null) return i;
  }
  return -1;
}

const BAR_WIDTH = 40;

function renderProgressBar(reviewed: number, total: number): string {
  const filled = total === 0 ? 0 : Math.round((reviewed / total) * BAR_WIDTH);
  const bar = '█'.repeat(filled) + '░'.repeat(BAR_WIDTH - filled);
  return `[${bar}] ${reviewed}/${total}`;
}

function printLaunchSummary(
  adapter: CorpusAdapter,
  flagged: StreamUnit[],
  counts: ReviewSummary,
): void {
  const reviewed = flagged.length - counts.unreviewed;
  const firstIdx = findFirstUnreviewed(flagged, adapter);
  const firstDesc =
    firstIdx < 0 ? 'all reviewed' : adapter.describeUnit(flagged[firstIdx]);
  console.log('');
  console.log('=== STATUS ===');
  console.log(`Total flagged:         ${flagged.length}`);
  console.log(`Reviewed:              ${reviewed}`);
  console.log(`Unreviewed:            ${counts.unreviewed}`);
  console.log(`Accepted:              ${counts.accepted}`);
  console.log(`Flagged for rewrite:   ${counts.flagged_for_rewrite}`);
  console.log(`First unreviewed:      ${firstDesc}`);
  console.log('==============');
}

function printSummary(
  flagged: StreamUnit[],
  counts: ReviewSummary,
  session: SessionStats,
): void {
  console.log('');
  console.log('=== REVIEW SUMMARY ===');
  console.log(`Flagged units:         ${flagged.length}`);
  console.log(`  accepted:            ${counts.accepted}`);
  console.log(`  edited:              ${counts.edited}`);
  console.log(`  flagged_for_rewrite: ${counts.flagged_for_rewrite}`);
  console.log(`  unreviewed:          ${counts.unreviewed}`);
  console.log('--- this session ---');
  console.log(`  accepted:            ${session.accepted}`);
  console.log(`  flagged_for_rewrite: ${session.flagged_for_rewrite}`);
  console.log('=======================');
}

// ---------------------------------------------------------------------------
// Argument parsing.
// ---------------------------------------------------------------------------

const SUPPORTED_SLUGS = ['federalist', 'tocqueville'] as const;
type Slug = (typeof SUPPORTED_SLUGS)[number];

const SUPPORTED_TIERS = ['accept', 'rewrite', 'manual'] as const;
type TierFilter = (typeof SUPPORTED_TIERS)[number];

function parseArgs(argv: string[]): { slug: Slug; tier: TierFilter | null } {
  let slug: Slug = 'federalist';
  let tier: TierFilter | null = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--corpus') {
      const v = argv[i + 1];
      if (typeof v !== 'string' || !(SUPPORTED_SLUGS as readonly string[]).includes(v)) {
        throw new Error(
          `--corpus requires one of: ${SUPPORTED_SLUGS.join(', ')}`,
        );
      }
      slug = v as Slug;
      i++;
    } else if (argv[i] === '--tier') {
      const v = argv[i + 1];
      if (typeof v !== 'string' || !(SUPPORTED_TIERS as readonly string[]).includes(v)) {
        throw new Error(
          `--tier requires one of: ${SUPPORTED_TIERS.join(', ')}`,
        );
      }
      tier = v as TierFilter;
      i++;
    } else {
      throw new Error(`unknown argument: ${argv[i]}`);
    }
  }
  return { slug, tier };
}

function buildAdapter(slug: Slug): CorpusAdapter {
  switch (slug) {
    case 'federalist':
      return createFederalistAdapter();
    case 'tocqueville':
      return createTocquevilleAdapter();
  }
}

// ---------------------------------------------------------------------------
// Tier filter — when --tier is set, restrict the stream to units whose
// triage_tier matches AND whose editorial_status is null. Units the owner
// has already decided on are excluded from the per-tier flow (no action to
// take); the no-flag invocation still shows them.
// ---------------------------------------------------------------------------

function filterByTier(
  flagged: StreamUnit[],
  adapter: CorpusAdapter,
  tier: TierFilter,
): StreamUnit[] {
  return flagged.filter((u) => {
    const t = adapter.getTriageState(u);
    if (t.triage_tier !== tier) return false;
    const e = adapter.getEditorialState(u);
    return e.editorial_status === null;
  });
}

// ---------------------------------------------------------------------------
// Accept-tier batch flow — show every accept-tier unit (locator + rationale
// + flag summary) so the owner can scroll the full batch, then a single
// confirm. On y, walks the batch and calls acceptUnit on each (atomic write
// per record). BULK BUT NOT BLIND — the full list is shown before any write.
// ---------------------------------------------------------------------------

async function runAcceptBatch(
  adapter: CorpusAdapter,
  units: StreamUnit[],
  rl: ReturnType<typeof createInterface>,
): Promise<void> {
  console.log('');
  console.log(`=== ACCEPT-TIER BATCH (${adapter.slug}) ===`);
  console.log(`${units.length} units will be set to editorial_status = "accepted" on confirmation.`);
  console.log('');
  for (let i = 0; i < units.length; i++) {
    const u = units[i];
    const t = adapter.getTriageState(u);
    const flagSummary = adapter.getFlags(u).map((f) => f.kind).join(',');
    const rationale = t.triage_rationale ?? '(no rationale recorded)';
    console.log(`  ${String(i + 1).padStart(4)}. ${adapter.describeUnit(u)}  [${flagSummary}]`);
    console.log(`         ${rationale}`);
  }
  console.log('');
  console.log(`=== END BATCH (${units.length} units) ===`);
  const answer = (
    await rl.question(`Auto-accept all ${units.length} units? (y/N) `)
  ).trim().toLowerCase();
  if (answer !== 'y' && answer !== 'yes') {
    console.log('(no units accepted; exiting)');
    return;
  }
  let applied = 0;
  for (const u of units) {
    adapter.acceptUnit(u);
    applied++;
  }
  console.log(`Applied: ${applied} units now editorial_status = "accepted".`);
}

// ---------------------------------------------------------------------------
// Main loop — adapter-agnostic.
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const { slug, tier } = parseArgs(process.argv.slice(2));
  const adapter = buildAdapter(slug);

  const fullStream = adapter.buildStream();
  if (fullStream.length === 0) {
    console.log('No flagged units found in annotations file. Nothing to review.');
    return;
  }

  // When --tier is set, restrict the stream. The accept-tier flow is special:
  // batch-display + single confirm + auto-apply + exit, no per-unit loop.
  let flagged: StreamUnit[];
  if (tier !== null) {
    flagged = filterByTier(fullStream, adapter, tier);
    if (flagged.length === 0) {
      console.log(
        `No units with triage_tier === "${tier}" and editorial_status === null. Nothing to do for this tier.`,
      );
      return;
    }
  } else {
    flagged = fullStream;
  }

  if (tier === 'accept') {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    try {
      await runAcceptBatch(adapter, flagged, rl);
    } finally {
      rl.close();
    }
    return;
  }

  let cursor = 0;
  let running = true;
  let skipReviewed = false;
  const sessionStats: SessionStats = { accepted: 0, flagged_for_rewrite: 0 };

  const rl = createInterface({ input: process.stdin, output: process.stdout });

  if (tier !== null) {
    console.log('');
    console.log(`(filtered to triage_tier === "${tier}", editorial_status === null — ${flagged.length} units)`);
  }

  // Confirms overwrite of an existing non-null status. Returns true to proceed,
  // false to abort. Anything other than y/yes counts as no.
  async function confirmOverwrite(currentStatus: EditorialStatus): Promise<boolean> {
    const answer = (
      await rl.question(`This unit is already ${currentStatus} — overwrite? (y/n) `)
    ).trim().toLowerCase();
    return answer === 'y' || answer === 'yes';
  }

  // Launch summary — printed once before the first unit renders.
  printLaunchSummary(adapter, flagged, summarize(adapter, flagged));

  while (running) {
    const counts = summarize(adapter, flagged);
    const reviewed = flagged.length - counts.unreviewed;
    const bar = renderProgressBar(reviewed, flagged.length);
    const mode = skipReviewed ? '[skip-reviewed ON]' : '[skip-reviewed OFF]';
    console.log('');
    console.log(`${bar}  ${mode}`);
    process.stdout.write(
      adapter.renderUnit(flagged[cursor], cursor + 1, flagged.length, reviewed),
    );

    const raw = (await rl.question('> ')).trim();
    if (raw === '') continue;

    const parts = raw.split(/\s+/);
    const head = parts[0];
    const rest = parts.slice(1);
    const tail = raw.slice(head.length).trimStart();

    const unit = flagged[cursor];

    switch (head) {
      case 'n':
      case 'next': {
        if (tail.length > 0) {
          console.log('(use `m <note>` to set a note; `n` alone advances)');
          break;
        }
        if (skipReviewed) {
          const next = findNextUnreviewedFrom(flagged, adapter, cursor, 1);
          if (next < 0) console.log('(no further unreviewed units)');
          else cursor = next;
        } else {
          if (cursor < flagged.length - 1) cursor++;
          else console.log('(end of flagged stream)');
        }
        break;
      }
      case 'p':
      case 'prev': {
        if (skipReviewed) {
          const prev = findNextUnreviewedFrom(flagged, adapter, cursor, -1);
          if (prev < 0) console.log('(no earlier unreviewed units)');
          else cursor = prev;
        } else {
          if (cursor > 0) cursor--;
          else console.log('(start of flagged stream)');
        }
        break;
      }
      case 'g': {
        // `g next` / `g n` — jump to first unreviewed in document order.
        // Intercepted before the adapter locator parser since neither corpus's
        // locator accepts a single non-numeric token.
        if (rest.length === 1 && (rest[0] === 'next' || rest[0] === 'n')) {
          const idx = findFirstUnreviewed(flagged, adapter);
          if (idx < 0) console.log('(all flagged units have been reviewed)');
          else cursor = idx;
          break;
        }
        const loc = adapter.parseLocator(rest);
        if (!loc.ok) {
          console.log(`(usage: ${loc.usage})`);
          break;
        }
        const idx = flagged.findIndex(loc.predicate);
        if (idx < 0) {
          console.log(
            `(no flagged unit at ${loc.describe} — use n/p to navigate flagged units only)`,
          );
          break;
        }
        cursor = idx;
        break;
      }
      case 'a':
      case 'accept': {
        const oldStatus = adapter.getEditorialState(unit).editorial_status;
        if (oldStatus !== null) {
          const ok = await confirmOverwrite(oldStatus);
          if (!ok) break;
        }
        adapter.acceptUnit(unit);
        if (oldStatus !== 'accepted') sessionStats.accepted++;
        if (cursor < flagged.length - 1) cursor++;
        break;
      }
      case 'e':
      case 'edit': {
        const target = adapter.readEditTarget(unit);
        if (target === null) {
          console.log('(no editable rendering available for this unit)');
          break;
        }
        let outcome: EditOutcome;
        try {
          outcome = runEditor(target.text);
        } catch (err) {
          console.log(`(edit failed: ${(err as Error).message})`);
          break;
        }
        if (!outcome.changed) {
          console.log('(unchanged — no edit recorded)');
          break;
        }
        adapter.applyEdit(unit, outcome.newText);
        if (cursor < flagged.length - 1) cursor++;
        break;
      }
      case 'f':
      case 'flag': {
        const oldStatus = adapter.getEditorialState(unit).editorial_status;
        if (oldStatus !== null) {
          const ok = await confirmOverwrite(oldStatus);
          if (!ok) break;
        }
        const note = (await rl.question('Note (optional, blank to skip): ')).trim();
        adapter.flagUnit(unit, note.length > 0 ? note : null);
        if (oldStatus !== 'flagged_for_rewrite') sessionStats.flagged_for_rewrite++;
        if (cursor < flagged.length - 1) cursor++;
        break;
      }
      case 'F': {
        const state = adapter.getEditorialState(unit);
        const oldStatus = state.editorial_status;
        if (oldStatus !== null) {
          const ok = await confirmOverwrite(oldStatus);
          if (!ok) break;
        }
        // Preserve any existing note: F is a fast-pass flag, not a note clear.
        adapter.flagUnit(unit, state.editorial_note);
        if (oldStatus !== 'flagged_for_rewrite') sessionStats.flagged_for_rewrite++;
        if (cursor < flagged.length - 1) cursor++;
        break;
      }
      case 'm': {
        if (tail.length === 0) {
          console.log('(usage: m <note>)');
          break;
        }
        adapter.setNote(unit, tail);
        break;
      }
      case 'u':
      case 'unset': {
        adapter.unsetUnit(unit);
        break;
      }
      case 's': {
        skipReviewed = !skipReviewed;
        console.log(`(skip-reviewed mode: ${skipReviewed ? 'ON' : 'OFF'})`);
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
  printSummary(flagged, summarize(adapter, flagged), sessionStats);
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
