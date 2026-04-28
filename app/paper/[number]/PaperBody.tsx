'use client';

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';

type Footnote = { marker: string; paragraphs: string[] };
type Mode = 'original' | 'modern';

const MODE_STORAGE_KEY = 'publius:reading-mode';
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

function strip(marker: string): string {
  return marker.replace(/[()]/g, '');
}

function readModeFromUrl(params: URLSearchParams): Mode | null {
  const v = params.get('mode');
  if (v === 'modern') return 'modern';
  if (v === 'original') return 'original';
  return null;
}

function readModeFromStorage(): Mode | null {
  try {
    const v = window.localStorage.getItem(MODE_STORAGE_KEY);
    if (v === 'modern' || v === 'original') return v;
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

export function PaperBody({
  paragraphs,
  plainEnglish,
  footnotes,
}: {
  paragraphs: string[];
  plainEnglish: string[];
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

  const [mode, setMode] = useState<Mode>('original');
  const [fading, setFading] = useState(false);
  const fadeTimer = useRef<number | null>(null);
  // Tracks the mode the user last *asked for* — may differ from `mode` while a
  // fade is in flight. Used for the early-return check in switchMode so a
  // rapid opposite-button click doesn't strand opacity at 0.
  const targetMode = useRef<Mode>('original');

  // Hydrate mode from URL > localStorage on mount; URL wins and resyncs storage.
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

  // Sync React state on browser back/forward — mode in URL may change
  // without remount.
  useEffect(() => {
    function handlePopState() {
      const fromUrl = readModeFromUrl(
        new URLSearchParams(window.location.search),
      );
      const next: Mode = fromUrl ?? 'original';
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

  const switchMode = useCallback(
    (next: Mode) => {
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

        // Update URL via history API directly. router.replace would round-trip
        // through Next's navigation pipeline and reset scroll despite
        // { scroll: false }; replaceState is a pure URL-bar update.
        const params = new URLSearchParams(window.location.search);
        if (next === 'original') params.delete('mode');
        else params.set('mode', 'modern');
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
    },
    [],
  );

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

  const source = mode === 'modern' ? plainEnglish : paragraphs;

  return (
    <>
      <div className="paper-mode-toggle" role="group" aria-label="Reading mode">
        <button
          type="button"
          className={`paper-mode-toggle__label${
            mode === 'original' ? ' paper-mode-toggle__label--active' : ''
          }`}
          aria-pressed={mode === 'original'}
          onClick={() => switchMode('original')}
        >
          Original
        </button>
        <span className="paper-mode-toggle__sep" aria-hidden="true">
          ·
        </span>
        <button
          type="button"
          className={`paper-mode-toggle__label${
            mode === 'modern' ? ' paper-mode-toggle__label--active' : ''
          }`}
          aria-pressed={mode === 'modern'}
          onClick={() => switchMode('modern')}
        >
          Modern English
        </button>
      </div>
      <div className={`paper-body${fading ? ' paper-body--fading' : ''}`}>
        {source.map((para, i) => {
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
    </>
  );
}
