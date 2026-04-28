import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import federalistData from '@/data/federalist/federalist.json';

import { PaperBody } from './PaperBody';

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

function formatLongDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${MONTHS[parseInt(m, 10) - 1]} ${parseInt(d, 10)}, ${y}`;
}

type Footnote = { marker: string; paragraphs: string[] };

type FederalistItem = {
  id: string;
  title: string;
  authors: string[];
  date: string;
  paragraphs: string[];
  footnotes: Footnote[];
  federalist: {
    number: number;
    authorship_status: 'undisputed' | 'disputed' | 'joint';
    authorship_note: string | null;
    publication: { venue: string; raw_dateline: string };
  };
};

const items = federalistData.items as FederalistItem[];

function findItem(numberParam: string): FederalistItem | null {
  if (!/^\d+$/.test(numberParam)) return null;
  const n = parseInt(numberParam, 10);
  if (n < 1 || n > 85) return null;
  return items.find((it) => it.federalist.number === n) ?? null;
}

export function generateStaticParams() {
  return items.map((it) => ({ number: String(it.federalist.number) }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ number: string }>;
}): Promise<Metadata> {
  const { number } = await params;
  const item = findItem(number);
  if (!item) return { title: 'Not found · Publius' };
  return {
    title: `Federalist No. ${item.federalist.number} — ${item.title} · Publius`,
  };
}

export default async function PaperPage({
  params,
}: {
  params: Promise<{ number: string }>;
}) {
  const { number } = await params;
  const item = findItem(number);
  if (!item) notFound();

  const status = item.federalist.authorship_status;
  const authorshipNote = item.federalist.authorship_note;
  const byline = item.authors.join(' & ');
  const publication = `${item.federalist.publication.venue} · ${formatLongDate(item.date)}`;

  return (
    <main>
      <article>
        <header className="paper-header">
          <p className="paper-corpus-tag">
            Federalist · No. {item.federalist.number}
          </p>
          <h1 className="paper-title">{item.title}</h1>
          <p className="paper-byline">
            {byline}
            {status === 'disputed' && (
              <>
                {' '}
                <span className="paper-byline__sep" aria-hidden="true">
                  ·
                </span>{' '}
                <span className="paper-byline__disputed">Disputed</span>
              </>
            )}
          </p>
          <p className="paper-publication">{publication}</p>
          {status === 'disputed' && authorshipNote && (
            <p className="paper-authorship-note">{authorshipNote}</p>
          )}
        </header>
        <PaperBody paragraphs={item.paragraphs} footnotes={item.footnotes} />
      </article>
    </main>
  );
}
