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

export default function BrowsePage() {
  const papers: PaperMeta[] = (federalist.items as FederalistItem[]).map((it) => ({
    number: it.federalist.number,
    title: it.title,
    authors: it.authors,
    date: formatDate(it.date),
    authorshipStatus: it.federalist.authorship_status,
  }));

  return (
    <main>
      <h1 className="browse-heading">The Federalist Papers</h1>
      <BrowseList papers={papers} />
    </main>
  );
}
