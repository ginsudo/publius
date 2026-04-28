'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';

type Footnote = { marker: string; paragraphs: string[] };

const RE_ESCAPE = /[.*+?^${}()|[\]\\]/g;

function buildMarkerRegex(markers: string[]): RegExp {
  if (markers.length === 0) return /(?!)/;
  const escaped = markers
    .slice()
    .sort((a, b) => b.length - a.length)
    .map((m) => m.replace(RE_ESCAPE, '\\$&'));
  return new RegExp(`(${escaped.join('|')})`, 'g');
}

function strip(marker: string): string {
  return marker.replace(/[()]/g, '');
}

export function PaperBody({
  paragraphs,
  footnotes,
}: {
  paragraphs: string[];
  footnotes: Footnote[];
}) {
  const markers = useMemo(() => footnotes.map((f) => f.marker), [footnotes]);
  const lookup = useMemo(() => {
    const m = new Map<string, Footnote>();
    for (const fn of footnotes) m.set(fn.marker, fn);
    return m;
  }, [footnotes]);
  const re = useMemo(() => buildMarkerRegex(markers), [markers]);
  const [open, setOpen] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    function handleHash() {
      const hash = window.location.hash.slice(1);
      if (!hash) return;
      if (hash.startsWith('fn-')) {
        const marker = `(${hash.slice(3)})`;
        if (lookup.has(marker)) {
          setOpen((s) => {
            if (s.has(marker)) return s;
            const next = new Set(s);
            next.add(marker);
            return next;
          });
        }
      }
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const el = document.getElementById(hash);
          el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      });
    }
    handleHash();
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, [lookup]);

  function toggle(marker: string) {
    setOpen((s) => {
      const next = new Set(s);
      if (next.has(marker)) next.delete(marker);
      else next.add(marker);
      return next;
    });
  }

  return (
    <div className="paper-body">
      {paragraphs.map((para, i) => {
        const parts = markers.length > 0 ? para.split(re) : [para];
        const markersInPara = markers.filter((m) => para.includes(m));
        return (
          <Fragment key={i}>
            <p id={`p-${i + 1}`}>
              {parts.map((part, idx) => {
                if (lookup.has(part)) {
                  const isOpen = open.has(part);
                  const num = strip(part);
                  return (
                    <button
                      key={idx}
                      type="button"
                      className="paper-fnref"
                      aria-expanded={isOpen}
                      aria-controls={`fn-${num}`}
                      aria-label={`Footnote ${num}`}
                      onClick={() => toggle(part)}
                    >
                      {num}
                    </button>
                  );
                }
                return <Fragment key={idx}>{part}</Fragment>;
              })}
            </p>
            {markersInPara.map((marker) => {
              const fn = lookup.get(marker);
              if (!fn) return null;
              const isOpen = open.has(marker);
              const num = strip(marker);
              return (
                <aside
                  key={marker}
                  id={`fn-${num}`}
                  className="paper-footnote"
                  hidden={!isOpen}
                >
                  <span className="paper-footnote__marker" aria-hidden="true">
                    {num}
                  </span>
                  <div className="paper-footnote__body">
                    {fn.paragraphs.map((fpara, fi) => (
                      <p key={fi}>{fpara}</p>
                    ))}
                  </div>
                </aside>
              );
            })}
          </Fragment>
        );
      })}
    </div>
  );
}
