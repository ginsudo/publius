import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import tocquevilleData from '@/data/tocqueville/tocqueville.json';

import { ItemBody } from './ItemBody';

type Footnote = { marker: string; paragraphs: string[] };

type TocquevilleItem = {
  id: string;
  title: string;
  authors: string[];
  date: string;
  paragraphs: string[];
  footnotes: Footnote[];
  tocqueville: {
    volume: number;
    part: number | null;
    chapter: number | null;
    kind: 'avertissement' | 'introduction' | 'chapter' | 'end_note' | 'appendix';
    chapter_summary: string | null;
    references_page: number | null;
    tome: number;
    end_notes_referenced: string[];
    translation: string[] | null;
    footnotes_translation: Footnote[] | null;
    translated_title: string | null;
  };
};

const items = tocquevilleData.items as TocquevilleItem[];

function findItem(id: string): TocquevilleItem | null {
  // Next.js delivers URL params with reserved characters percent-encoded —
  // a colon in the URL pathname arrives as %3A. Decode before matching IDs
  // that contain colons (e.g. "tocqueville:vol1.part1.ch1").
  let decoded: string;
  try {
    decoded = decodeURIComponent(id);
  } catch {
    return null;
  }
  const item = items.find((it) => it.id === decoded);
  if (!item) return null;
  if (item.tocqueville.translation == null) return null;
  return item;
}

const ROMAN = [
  '',
  'I',
  'II',
  'III',
  'IV',
  'V',
  'VI',
  'VII',
  'VIII',
  'IX',
  'X',
  'XI',
  'XII',
  'XIII',
  'XIV',
  'XV',
  'XVI',
  'XVII',
  'XVIII',
  'XIX',
  'XX',
];

function toRoman(n: number): string {
  return ROMAN[n] ?? String(n);
}

function corpusTagRest(item: TocquevilleItem): string {
  const vol = toRoman(item.tocqueville.volume);
  const k = item.tocqueville.kind;
  if (k === 'chapter') {
    const part = item.tocqueville.part != null ? toRoman(item.tocqueville.part) : null;
    const chap =
      item.tocqueville.chapter != null ? toRoman(item.tocqueville.chapter) : null;
    return ` · Vol ${vol} · Part ${part} · Chapter ${chap}`;
  }
  if (k === 'end_note') {
    const m = item.id.match(/notes\.([A-Za-z][A-Za-z0-9-]*)$/);
    const letter = m ? m[1] : '';
    return ` · Vol ${vol} · Note ${letter}`;
  }
  return ` · Vol ${vol}`;
}

function metaLine(item: TocquevilleItem): string {
  const year = item.date.slice(0, 4);
  return `De la démocratie en Amérique · ${year}`;
}

export function generateStaticParams() {
  return items
    .filter((it) => it.tocqueville.translation != null)
    .map((it) => ({ id: it.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const item = findItem(id);
  if (!item) return { title: 'Not found · Publius' };
  const title = item.tocqueville.translated_title ?? item.title;
  return { title: `${title} · Tocqueville · Publius` };
}

export default async function ItemPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const item = findItem(id);
  if (!item) notFound();

  // findItem guarantees translation is non-null
  const translation = item.tocqueville.translation as string[];
  const footnotesTranslation = item.tocqueville.footnotes_translation ?? [];
  const chapterSummary = item.tocqueville.chapter_summary;

  return (
    <main>
      <article>
        <ItemBody
          translation={translation}
          french={item.paragraphs}
          footnotes={item.footnotes}
          footnotesTranslation={footnotesTranslation}
          chapterSummary={chapterSummary}
          frenchTitle={item.title}
          translatedTitle={item.tocqueville.translated_title ?? item.title}
          corpusLabel="Tocqueville"
          corpusBrowseHref="/browse/tocqueville"
          corpusTagRest={corpusTagRest(item)}
          metaText={metaLine(item)}
        />
      </article>
    </main>
  );
}
