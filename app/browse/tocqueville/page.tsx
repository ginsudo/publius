import Link from 'next/link';

import tocquevilleData from '@/data/tocqueville/tocqueville.json';

import { TocquevilleBrowseList, type TocquevilleRow } from './TocquevilleBrowseList';

type TocquevilleItem = {
  id: string;
  title: string;
  tocqueville: {
    volume: number;
    part: number | null;
    chapter: number | null;
    kind: 'avertissement' | 'introduction' | 'chapter' | 'end_note' | 'appendix';
    translation: string[] | null;
  };
};

const KIND_LABEL: Record<TocquevilleItem['tocqueville']['kind'], string> = {
  avertissement: 'Avertissement',
  introduction: 'Introduction',
  chapter: 'Chapter',
  end_note: 'End-note',
  appendix: 'Appendix',
};

function locator(it: TocquevilleItem): string {
  const { part, chapter, kind } = it.tocqueville;
  if (kind === 'chapter') {
    if (part != null && chapter != null) return `Pt. ${part} · Ch. ${chapter}`;
    if (chapter != null) return `Ch. ${chapter}`;
    if (part != null) return `Pt. ${part}`;
    return KIND_LABEL.chapter;
  }
  return KIND_LABEL[kind];
}

const VOLUME_DATE: Record<number, string> = {
  1: '1835',
  2: '1840',
};

export default function TocquevilleBrowsePage() {
  const items = tocquevilleData.items as TocquevilleItem[];

  const rows: TocquevilleRow[] = items.map((it) => ({
    id: it.id,
    volume: it.tocqueville.volume,
    locator: locator(it),
    frenchTitle: it.title,
    meta: `Tocqueville · ${VOLUME_DATE[it.tocqueville.volume] ?? ''}`.trim(),
    hasTranslation: it.tocqueville.translation != null,
  }));

  return (
    <main>
      <nav className="browse-breadcrumb" aria-label="Breadcrumb">
        <Link href="/browse">Browse</Link>
        <span className="browse-breadcrumb__sep" aria-hidden="true">›</span>
        <span aria-current="page">Democracy in America</span>
      </nav>
      <h1 className="browse-heading">Democracy in America</h1>
      <p className="browse-subtitle">
        Observation · Tocqueville · 1835 / 1840 · 124 chapters
      </p>
      <TocquevilleBrowseList rows={rows} />
    </main>
  );
}
