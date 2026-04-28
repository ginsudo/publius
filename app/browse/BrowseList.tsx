'use client';

import Link from 'next/link';
import { Fragment, useMemo, useState } from 'react';

export type PaperMeta = {
  number: number;
  title: string;
  authors: string[];
  date: string;
  authorshipStatus: 'undisputed' | 'disputed' | 'joint';
};

type AuthorFilter = 'all' | 'Hamilton' | 'Madison' | 'Jay' | 'disputed';
type SortOrder = 'number' | 'author';

const AUTHOR_FILTERS: { key: AuthorFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'Hamilton', label: 'Hamilton' },
  { key: 'Madison', label: 'Madison' },
  { key: 'Jay', label: 'Jay' },
  { key: 'disputed', label: 'Disputed' },
];

const SORTS: { key: SortOrder; label: string }[] = [
  { key: 'number', label: 'By number' },
  { key: 'author', label: 'By author' },
];

export function BrowseList({ papers }: { papers: PaperMeta[] }) {
  const [filter, setFilter] = useState<AuthorFilter>('all');
  const [sort, setSort] = useState<SortOrder>('number');

  const visible = useMemo(() => {
    const filtered = papers.filter((p) => {
      if (filter === 'all') return true;
      if (filter === 'disputed') return p.authorshipStatus === 'disputed';
      return p.authors.includes(filter);
    });
    const sorted = [...filtered];
    if (sort === 'author') {
      sorted.sort((a, b) => {
        const ax = a.authors[0] ?? '';
        const bx = b.authors[0] ?? '';
        if (ax !== bx) return ax.localeCompare(bx);
        return a.number - b.number;
      });
    } else {
      sorted.sort((a, b) => a.number - b.number);
    }
    return sorted;
  }, [papers, filter, sort]);

  return (
    <>
      <div className="browse-filters">
        <div className="browse-filter-group" role="group" aria-label="Author filter">
          {AUTHOR_FILTERS.map((f, i) => (
            <Fragment key={f.key}>
              {i > 0 && (
                <span className="browse-filter-sep" aria-hidden="true">
                  ·
                </span>
              )}
              <button
                type="button"
                aria-pressed={filter === f.key}
                onClick={() => setFilter(f.key)}
              >
                {f.label}
              </button>
            </Fragment>
          ))}
        </div>
        <div className="browse-filter-group" role="group" aria-label="Sort order">
          {SORTS.map((s, i) => (
            <Fragment key={s.key}>
              {i > 0 && (
                <span className="browse-filter-sep" aria-hidden="true">
                  ·
                </span>
              )}
              <button
                type="button"
                aria-pressed={sort === s.key}
                onClick={() => setSort(s.key)}
              >
                {s.label}
              </button>
            </Fragment>
          ))}
        </div>
      </div>

      <ol className="browse-list">
        {visible.map((p) => (
          <li key={p.number} className="browse-row">
            <span className="browse-row__num">{p.number}.</span>
            <Link href={`/paper/${p.number}`} className="browse-row__title">
              {p.title}
            </Link>
            <div className="browse-row__meta">
              <span className="browse-row__byline">{p.authors.join(' & ')}</span>
              {p.authorshipStatus === 'disputed' && (
                <>
                  <span className="browse-row__sep" aria-hidden="true">
                    ·
                  </span>
                  <span className="browse-row__disputed">Disputed</span>
                </>
              )}
              <span className="browse-row__sep" aria-hidden="true">
                ·
              </span>
              <span className="browse-row__date">{p.date}</span>
              <span className="browse-row__sep" aria-hidden="true">
                ·
              </span>
              <span className="browse-row__summary">—</span>
            </div>
          </li>
        ))}
      </ol>
    </>
  );
}
