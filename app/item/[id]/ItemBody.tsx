'use client';

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';

type Footnote = { marker: string; paragraphs: string[] };
type Mode = 'translation' | 'french';

const MODE_STORAGE_KEY = 'publius:tocq-reading-mode';
const FADE_MS = 150;

const RE_ESCAPE = /[.*+?^${}()|[\]\\]/g;

function buildMarkerRegex(markers: string[]): RegExp {
  if (markers.length === 0) return /(?!)/;
  const escaped = markers
    .slice()
    .sort((a, b) => b.length - a.length)
    .map((m) => m.replace(RE_ESCAPE, '\\$&'));
  return new RegExp(`(${escaped.join('|')})`, 'g');
}

function markerToAnchor(marker: string): string {
  return marker.replace(/[[\]()]/g, '');
}

function readModeFromUrl(params: URLSearchParams): Mode | null {
  const v = params.get('mode');
  if (v === 'french') return 'french';
  if (v === 'translation') return 'translation';
  return null;
}

function readModeFromStorage(): Mode | null {
  try {
    const v = window.localStorage.getItem(MODE_STORAGE_KEY);
    if (v === 'french' || v === 'translation') return v;
  } catch {
    // localStorage may be unavailable (private mode, quota, etc.) — fall through
  }
  return null;
}

function writeModeToStorage(mode: Mode) {
  try {
    window.localStorage.setItem(MODE_STORAGE_KEY, mode);
  } catch {
    // ignore — persistence is best-effort
  }
}

function captureTopAnchor(): { id: string; offset: number } | null {
  const els = document.querySelectorAll<HTMLElement>('[id^="p-"]');
  let best: { id: string; offset: number } | null = null;
  for (const el of els) {
    const top = el.getBoundingClientRect().top;
    if (top >= 0) {
      if (best === null || top < best.offset) best = { id: el.id, offset: top };
    } else if (best === null) {
      best = { id: el.id, offset: top };
    }
  }
  return best;
}

function restoreTopAnchor(anchor: { id: string; offset: number }) {
  const el = document.getElementById(anchor.id);
  if (!el) return;
  const current = el.getBoundingClientRect().top;
  window.scrollBy({ top: current - anchor.offset, behavior: 'instant' as ScrollBehavior });
}

export function ItemBody({
  translation,
  french,
  footnotes,
  footnotesTranslation,
  chapterSummary,
  frenchTitle,
  translatedTitle,
  corpusLabel,
  corpusBrowseHref,
  corpusTagRest,
  metaText,
}: {
  translation: string[];
  french: string[];
  footnotes: Footnote[];
  footnotesTranslation: Footnote[];
  chapterSummary: string | null;
  frenchTitle: string;
  translatedTitle: string;
  corpusLabel: string;
  corpusBrowseHref: string;
  corpusTagRest: string;
  metaText: string;
}) {
  // Marker set is identical across footnotes and footnotes_translation (verified
  // at build time across all 39 Vol I items); one regex covers both modes.
  const markers = useMemo(() => footnotes.map((f) => f.marker), [footnotes]);
  const re = useMemo(() => buildMarkerRegex(markers), [markers]);
  const frenchLookup = useMemo(() => {
    const m = new Map<string, Footnote>();
    for (const fn of footnotes) m.set(fn.marker, fn);
    return m;
  }, [footnotes]);
  const englishLookup = useMemo(() => {
    const m = new Map<string, Footnote>();
    for (const fn of footnotesTranslation) m.set(fn.marker, fn);
    return m;
  }, [footnotesTranslation]);
  const [open, setOpen] = useState<Set<string>>(() => new Set());

  const [mode, setMode] = useState<Mode>('translation');
  const [fading, setFading] = useState(false);
  const fadeTimer = useRef<number | null>(null);
  const targetMode = useRef<Mode>('translation');

  useEffect(() => {
    const fromUrl = readModeFromUrl(new URLSearchParams(window.location.search));
    if (fromUrl) {
      setMode(fromUrl);
      targetMode.current = fromUrl;
      writeModeToStorage(fromUrl);
      return;
    }
    const fromStorage = readModeFromStorage();
    if (fromStorage) {
      setMode(fromStorage);
      targetMode.current = fromStorage;
    }
  }, []);

  useEffect(() => {
    function handlePopState() {
      const fromUrl = readModeFromUrl(
        new URLSearchParams(window.location.search),
      );
      const next: Mode = fromUrl ?? 'translation';
      targetMode.current = next;
      setMode((current) => (current === next ? current : next));
    }
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    function handleHash() {
      const hash = window.location.hash.slice(1);
      if (!hash) return;
      if (hash.startsWith('fn-')) {
        const anchor = hash.slice(3);
        const marker = markers.find((m) => markerToAnchor(m) === anchor);
        if (marker) {
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
  }, [markers]);

  const switchMode = useCallback((next: Mode) => {
    if (next === targetMode.current) return;
    targetMode.current = next;
    const anchor = captureTopAnchor();

    if (fadeTimer.current !== null) {
      window.clearTimeout(fadeTimer.current);
      fadeTimer.current = null;
    }

    setFading(true);
    fadeTimer.current = window.setTimeout(() => {
      setMode(next);
      writeModeToStorage(next);

      const params = new URLSearchParams(window.location.search);
      if (next === 'translation') params.delete('mode');
      else params.set('mode', 'french');
      const qs = params.toString();
      const hash = window.location.hash;
      const url = `${window.location.pathname}${qs ? `?${qs}` : ''}${hash}`;
      window.history.replaceState(window.history.state, '', url);

      requestAnimationFrame(() => {
        if (anchor) restoreTopAnchor(anchor);
        setFading(false);
        fadeTimer.current = null;
      });
    }, FADE_MS);
  }, []);

  useEffect(() => {
    return () => {
      if (fadeTimer.current !== null) window.clearTimeout(fadeTimer.current);
    };
  }, []);

  function toggle(marker: string) {
    setOpen((s) => {
      const next = new Set(s);
      if (next.has(marker)) next.delete(marker);
      else next.add(marker);
      return next;
    });
  }

  const source = mode === 'french' ? french : translation;
  const fnLookup = mode === 'french' ? frenchLookup : englishLookup;

  return (
    <>
      <header className="item-header">
        <p className="item-corpus-tag">
          <Link href={corpusBrowseHref}>{corpusLabel}</Link>
          {corpusTagRest}
        </p>
        <h1 className="item-title">
          {mode === 'french' ? frenchTitle : translatedTitle}
        </h1>
        <p className="item-meta">{metaText}</p>
      </header>
      <div className="item-mode-toggle" role="group" aria-label="Reading mode">
        <button
          type="button"
          className={`item-mode-toggle__label${
            mode === 'translation' ? ' item-mode-toggle__label--active' : ''
          }`}
          aria-pressed={mode === 'translation'}
          onClick={() => switchMode('translation')}
        >
          Translation
        </button>
        <span className="item-mode-toggle__sep" aria-hidden="true">
          ·
        </span>
        <button
          type="button"
          className={`item-mode-toggle__label${
            mode === 'french' ? ' item-mode-toggle__label--active' : ''
          }`}
          aria-pressed={mode === 'french'}
          onClick={() => switchMode('french')}
        >
          French
        </button>
      </div>
      <div className={`item-body${fading ? ' item-body--fading' : ''}`}>
        {mode === 'french' && chapterSummary && (
          <p className="item-chapter-summary">{chapterSummary}</p>
        )}
        {source.map((para, i) => {
          const parts = markers.length > 0 ? para.split(re) : [para];
          const markersInPara = markers.filter((m) => para.includes(m));
          return (
            <Fragment key={i}>
              <p id={`p-${i + 1}`}>
                {parts.map((part, idx) => {
                  if (fnLookup.has(part)) {
                    const isOpen = open.has(part);
                    const anchor = markerToAnchor(part);
                    return (
                      <button
                        key={idx}
                        type="button"
                        className="item-fnref"
                        aria-expanded={isOpen}
                        aria-controls={`fn-${anchor}`}
                        aria-label={`Footnote ${anchor}`}
                        onClick={() => toggle(part)}
                      >
                        {anchor}
                      </button>
                    );
                  }
                  return <Fragment key={idx}>{part}</Fragment>;
                })}
              </p>
              {markersInPara.map((marker) => {
                const fn = fnLookup.get(marker);
                if (!fn) return null;
                const isOpen = open.has(marker);
                const anchor = markerToAnchor(marker);
                return (
                  <aside
                    key={marker}
                    id={`fn-${anchor}`}
                    className="item-footnote"
                    hidden={!isOpen}
                  >
                    <span className="item-footnote__marker" aria-hidden="true">
                      {anchor}
                    </span>
                    <div className="item-footnote__body">
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
    </>
  );
}
