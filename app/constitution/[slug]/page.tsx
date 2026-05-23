import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Fragment } from 'react';

import constitutionData from '@/data/constitution/constitution.json';

type ConstitutionItem = {
  id: string;
  title: string;
  paragraphs: string[];
  date: string;
  constitution: {
    kind: 'preamble' | 'body_clause' | 'amendment_clause';
    article: number | null;
    section: number | null;
    clause: number | null;
    amendment: number | null;
  };
};

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
  'XXI',
  'XXII',
  'XXIII',
  'XXIV',
  'XXV',
  'XXVI',
  'XXVII',
];

const ARTICLE_SUBTITLES: Record<number, string> = {
  1: 'The Legislative Branch',
  2: 'The Executive Branch',
  3: 'The Judicial Branch',
  4: 'The States',
  5: 'The Amendment Process',
  6: 'Supremacy',
  7: 'Ratification',
};

const items = constitutionData.items as ConstitutionItem[];

type SlugInfo =
  | { kind: 'preamble' }
  | { kind: 'article'; n: number }
  | { kind: 'bill-of-rights' }
  | { kind: 'amendments-11-27' };

const VALID_SLUGS: string[] = [
  'preamble',
  'article-1',
  'article-2',
  'article-3',
  'article-4',
  'article-5',
  'article-6',
  'article-7',
  'bill-of-rights',
  'amendments-11-27',
];

function parseSlug(slug: string): SlugInfo | null {
  if (slug === 'preamble') return { kind: 'preamble' };
  if (slug === 'bill-of-rights') return { kind: 'bill-of-rights' };
  if (slug === 'amendments-11-27') return { kind: 'amendments-11-27' };
  const m = /^article-([1-7])$/.exec(slug);
  if (m) return { kind: 'article', n: parseInt(m[1], 10) };
  return null;
}

function anchorFor(itemId: string): string {
  return itemId.replace(/[:.]/g, '-');
}

function pageTitle(info: SlugInfo): string {
  switch (info.kind) {
    case 'preamble':
      return 'Preamble';
    case 'article':
      return `Article ${ROMAN[info.n]}`;
    case 'bill-of-rights':
      return 'The Bill of Rights';
    case 'amendments-11-27':
      return 'Amendments XI–XXVII';
  }
}

function metaLine(info: SlugInfo): string {
  switch (info.kind) {
    case 'preamble':
      return 'Ratified 1788';
    case 'article':
      return `${ARTICLE_SUBTITLES[info.n]} · Ratified 1788`;
    case 'bill-of-rights':
      return 'Amendments I–X · Ratified 1791';
    case 'amendments-11-27':
      return 'Ratified 1795–1992';
  }
}

export function generateStaticParams() {
  return VALID_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const info = parseSlug(slug);
  if (!info) return { title: 'Not found · Publius' };
  return { title: `${pageTitle(info)} · Constitution · Publius` };
}

export default async function ConstitutionPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const info = parseSlug(slug);
  if (!info) notFound();

  return (
    <main>
      <article>
        <header className="item-header">
          <p className="item-corpus-tag">
            <Link href="/browse/constitution">U.S. Constitution</Link>
          </p>
          <h1 className="item-title">{pageTitle(info)}</h1>
          <p className="item-meta">{metaLine(info)}</p>
        </header>
        <div className="item-body">{renderBody(info)}</div>
      </article>
    </main>
  );
}

function renderBody(info: SlugInfo) {
  switch (info.kind) {
    case 'preamble':
      return renderPreamble();
    case 'article':
      return renderArticle(info.n);
    case 'bill-of-rights':
      return renderAmendments(1, 10, false);
    case 'amendments-11-27':
      return renderAmendments(11, 27, true);
  }
}

function isMidSentenceFragment(item: ConstitutionItem): boolean {
  const text = item.paragraphs.join(' ').trimEnd();
  if (!text) return false;
  const last = text[text.length - 1];
  return last === ',' || last === ';';
}

function renderClauseGroup(group: ConstitutionItem[]): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  let pending: ConstitutionItem[] = [];

  const flush = () => {
    if (pending.length === 0) return;
    if (pending.length === 1) {
      const item = pending[0];
      const anchor = anchorFor(item.id);
      item.paragraphs.forEach((para, i) => {
        out.push(
          <p key={`${item.id}-${i}`} id={i === 0 ? anchor : undefined}>
            {para}
          </p>,
        );
      });
    } else {
      const children: React.ReactNode[] = [];
      pending.forEach((item, i) => {
        const text = item.paragraphs.join(' ');
        if (i === 0) {
          children.push(text);
        } else {
          children.push(' ');
          children.push(
            <span key={`anc-${item.id}`} id={anchorFor(item.id)} />,
          );
          children.push(text);
        }
      });
      out.push(
        <p key={pending[0].id} id={anchorFor(pending[0].id)}>
          {children}
        </p>,
      );
    }
    pending = [];
  };

  for (const item of group) {
    pending.push(item);
    if (!isMidSentenceFragment(item)) flush();
  }
  flush();

  return out;
}

function renderPreamble() {
  const item = items.find((it) => it.id === 'constitution:preamble');
  if (!item) {
    throw new Error(
      'renderPreamble: no item with id "constitution:preamble" in constitution.json',
    );
  }
  return renderClauseGroup([item]);
}

function renderArticle(n: number) {
  const articleItems = items.filter(
    (it) =>
      it.constitution.kind === 'body_clause' && it.constitution.article === n,
  );

  if (articleItems.length === 0) {
    throw new Error(
      `renderArticle: no body_clause items found for Article ${n} in constitution.json`,
    );
  }

  const sections = new Map<number, ConstitutionItem[]>();
  const unsectioned: ConstitutionItem[] = [];
  for (const it of articleItems) {
    const sec = it.constitution.section;
    if (sec == null) {
      unsectioned.push(it);
    } else {
      if (!sections.has(sec)) sections.set(sec, []);
      sections.get(sec)!.push(it);
    }
  }
  const sectionNums = [...sections.keys()].sort((a, b) => a - b);
  const showHeadings = sectionNums.length > 1;

  const out: React.ReactNode[] = [];

  if (unsectioned.length > 0) {
    out.push(
      <Fragment key="unsectioned">{renderClauseGroup(unsectioned)}</Fragment>,
    );
  }

  for (const sec of sectionNums) {
    const clauses = sections.get(sec)!;
    out.push(
      <Fragment key={sec}>
        {showHeadings && <h2 className="const-subheading">Section {sec}.</h2>}
        {renderClauseGroup(clauses)}
      </Fragment>,
    );
  }

  return out;
}

function formatRatificationDate(iso: string): string {
  const [y, m, d] = iso.split('-');
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
  return `Ratified ${MONTHS[parseInt(m, 10) - 1]} ${parseInt(d, 10)}, ${y}`;
}

function renderAmendments(start: number, end: number, showDate: boolean) {
  const out: React.ReactNode[] = [];
  let amendmentsRendered = 0;

  for (let n = start; n <= end; n++) {
    const amendItems = items.filter(
      (it) =>
        it.constitution.kind === 'amendment_clause' &&
        it.constitution.amendment === n,
    );
    if (amendItems.length === 0) continue;
    amendmentsRendered++;

    const hasSections = amendItems.some((it) => it.constitution.section != null);

    out.push(
      <h2 key={`h-${n}`} className="const-amendment-heading">
        Amendment {ROMAN[n]}
      </h2>,
    );

    if (showDate) {
      out.push(
        <p key={`d-${n}`} className="const-amendment-date">
          {formatRatificationDate(amendItems[0].date)}
        </p>,
      );
    }

    if (hasSections) {
      const sections = new Map<number, ConstitutionItem[]>();
      for (const it of amendItems) {
        const sec = it.constitution.section ?? 0;
        if (!sections.has(sec)) sections.set(sec, []);
        sections.get(sec)!.push(it);
      }
      const sectionNums = [...sections.keys()].sort((a, b) => a - b);
      for (const sec of sectionNums) {
        out.push(
          <h3 key={`s-${n}-${sec}`} className="const-subheading">
            Section {sec}.
          </h3>,
        );
        out.push(
          <Fragment key={`s-body-${n}-${sec}`}>
            {renderClauseGroup(sections.get(sec)!)}
          </Fragment>,
        );
      }
    } else {
      out.push(
        <Fragment key={`a-body-${n}`}>{renderClauseGroup(amendItems)}</Fragment>,
      );
    }
  }

  if (amendmentsRendered === 0) {
    throw new Error(
      `renderAmendments: no amendment_clause items found for amendments ${start}–${end} in constitution.json`,
    );
  }

  return out;
}
