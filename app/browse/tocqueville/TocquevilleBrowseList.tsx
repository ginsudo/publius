'use client';

import Link from 'next/link';
import { Fragment, useMemo, useState } from 'react';

export type TocquevilleRow = {
  id: string;
  volume: number;
  locator: string;
  frenchTitle: string;
  meta: string;
  hasTranslation: boolean;
};

type VolumeFilter = 'all' | 'vol1' | 'vol2';

const FILTERS: { key: VolumeFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'vol1', label: 'Vol. I' },
  { key: 'vol2', label: 'Vol. II' },
];

export function TocquevilleBrowseList({ rows }: { rows: TocquevilleRow[] }) {
  const [filter, setFilter] = useState<VolumeFilter>('all');

  const { showVol1, showVol2, vol1Rows, vol2Rows } = useMemo(() => {
    return {
      showVol1: filter !== 'vol2',
      showVol2: filter !== 'vol1',
      vol1Rows: rows.filter((r) => r.volume === 1),
      vol2Rows: rows.filter((r) => r.volume === 2),
    };
  }, [rows, filter]);

  return (
    <>
      <div className="browse-filters">
        <div className="browse-filter-group" role="group" aria-label="Volume filter">
          {FILTERS.map((f, i) => (
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
      </div>

      {showVol1 && (
        <>
          <div className="browse-volume-divider">Vol. I · in translation</div>
          <ol className="browse-list browse-list--toc">
            {vol1Rows.map((r) => {
              const inner = (
                <>
                  <span className="browse-row-toc__locator">{r.locator}</span>
                  <span className="browse-row-toc__title">{r.frenchTitle}</span>
                  <span className="browse-row-toc__meta">{r.meta}</span>
                </>
              );
              return (
                <li key={r.id} className="browse-row-toc">
                  {r.hasTranslation ? (
                    <Link
                      href={`/item/${encodeURIComponent(r.id)}`}
                      className="browse-row-toc__link"
                    >
                      {inner}
                    </Link>
                  ) : (
                    <div className="browse-row-toc__link browse-row-toc__link--inert">
                      {inner}
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        </>
      )}

      {showVol2 && (
        <>
          <div className="browse-volume-divider">Vol. II · forthcoming</div>
          <ol className="browse-list browse-list--toc browse-list--forthcoming">
            {vol2Rows.map((r) => (
              <li key={r.id} className="browse-row-toc">
                <div className="browse-row-toc__link browse-row-toc__link--inert">
                  <span className="browse-row-toc__locator">{r.locator}</span>
                  <span className="browse-row-toc__title">{r.frenchTitle}</span>
                  <span className="browse-row-toc__meta browse-row-toc__forthcoming">
                    Forthcoming
                  </span>
                </div>
              </li>
            ))}
          </ol>
        </>
      )}
    </>
  );
}
