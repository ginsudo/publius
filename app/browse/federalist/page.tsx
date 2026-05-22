import Link from 'next/link';

import federalist from '@/data/federalist/federalist.json';

import { BrowseList, type PaperMeta } from './BrowseList';

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${MONTHS[parseInt(m, 10) - 1]} ${parseInt(d, 10)}, ${y}`;
}

type FederalistItem = {
  title: string;
  authors: string[];
  date: string;
  federalist: {
    number: number;
    authorship_status: 'undisputed' | 'disputed' | 'joint';
  };
};

export default function FederalistBrowsePage() {
  const papers: PaperMeta[] = (federalist.items as FederalistItem[]).map((it) => ({
    number: it.federalist.number,
    title: it.title,
    authors: it.authors,
    date: formatDate(it.date),
    authorshipStatus: it.federalist.authorship_status,
  }));

  return (
    <main>
      <nav className="browse-breadcrumb" aria-label="Breadcrumb">
        <Link href="/browse">Browse</Link>
        <span className="browse-breadcrumb__sep" aria-hidden="true">›</span>
        <span aria-current="page">Federalist Papers</span>
      </nav>
      <h1 className="browse-heading">Federalist Papers</h1>
      <p className="browse-subtitle">
        Argument · Hamilton, Madison &amp; Jay · 1787–88 · 85 papers
      </p>
      <BrowseList papers={papers} />
    </main>
  );
}
