'use client';

import { useEffect, useRef, useState } from 'react';
import type { FormEvent, KeyboardEvent } from 'react';
import sampleQuestions from '@/data/sample-questions.json';

type Citation = {
  item_id: string;
  corpus: string;
  kind: string;
  paragraph_index: number | null;
  marker: string | null;
  paper_number: number | null;
  title: string;
  authors: string[];
  authorship_status: string;
  date: string;
};

type Block =
  | { kind: 'paragraph'; text: string }
  | { kind: 'header'; text: string };

type DeltaEvent = { type: 'delta'; text: string };
type DoneEvent = {
  type: 'done';
  citations: Citation[];
  usage: { inputTokens: number; outputTokens: number; stopReason: string };
  promptSha256: string;
};
type ErrorEvent = { type: 'error'; message: string };
type StreamEvent = DeltaEvent | DoneEvent | ErrorEvent;

const LOADING_PHRASES = [
  'The inquiry is before us…',
  'Let us trace this further…',
  'The matter deserves a candid inquiry…',
  'Consulting the extended republic…',
  'The inquiry admits of some delay…',
  'Passion subsiding. Reason ascending…',
  'The parchment is being examined…',
  'Ambition is being made to counteract ambition…',
  'Factions are being consulted…',
  'Weighing the auxiliary precautions…',
];

function getSessionQuestion(): string {
  if (typeof window === 'undefined') return sampleQuestions[0].question;
  return sampleQuestions[Math.floor(Math.random() * sampleQuestions.length)].question;
}

const BUSY_MESSAGE =
  'The service is temporarily busy — please try again in a moment.';
const GENERIC_ERROR_MESSAGE = 'Something went wrong — please try again.';

// The route's pre-stream error body is `{ error, code }` (see classifyError in
// lib/observability.ts: 503/529 → code 'overload'). The in-stream error event
// carries `streamError.message` straight from the Anthropic SDK, which can be
// a raw JSON dump like `{"type":"error","error":{"type":"overloaded_error",…}}`.
// Both paths funnel through here so the user only ever sees curated prose.
function friendlyError(args: {
  status?: number;
  code?: string;
  raw?: string;
}): string {
  const { status, code, raw } = args;
  if (status === 503 || status === 529) return BUSY_MESSAGE;
  if (code === 'overload' || code === 'rate_limit') return BUSY_MESSAGE;
  if (raw && /overload|529|rate[_ ]?limit/i.test(raw)) return BUSY_MESSAGE;
  return GENERIC_ERROR_MESSAGE;
}

function stripMarkdown(s: string): string {
  return s
    .replace(/^#{1,3}\s+/gm, '')
    .replace(/\*\*([\s\S]+?)\*\*/g, '$1')
    .replace(/__([\s\S]+?)__/g, '$1')
    .replace(/\*([\s\S]+?)\*/g, '$1');
}

// Parse a complete answer into a sequence of typed blocks. The model uses two
// structural devices: (a) a standalone segment whose entire content is bold
// (e.g. `**The functional case (Federalist No. 23)**`) acting as a section
// label, and (b) `---` on its own line as a separator that occasionally
// precedes a short label. Both render as headers. A length guard on (b)
// prevents closing prose paragraphs from being promoted when the model uses
// `---` as a horizontal rule before a summary.
//
// Splitting happens on raw text (before stripMarkdown) so the bold-label
// pattern is still visible. Streaming render uses a simpler path because a
// partially-arrived `**…` or `---` would misclassify.
function parseBlocks(raw: string): Block[] {
  const segments = raw.split(/\n{2,}/);
  const blocks: Block[] = [];
  let nextIsHeader = false;

  for (const seg of segments) {
    const rawTrimmed = seg.trim();
    if (!rawTrimmed) continue;

    if (rawTrimmed === '---') {
      nextIsHeader = true;
      continue;
    }

    // Entire-segment bold pattern. 80 char label + 4 for the `**` markers.
    const isBoldLabel =
      /^\*\*(.+)\*\*$/.test(rawTrimmed) && rawTrimmed.length <= 84;
    if (isBoldLabel) {
      const label = rawTrimmed.replace(/^\*\*|\*\*$/g, '');
      blocks.push({ kind: 'header', text: label });
      nextIsHeader = false;
      continue;
    }

    // Markdown `#`/`##`/`###` heading on the segment's first line.
    const isMarkdownHeader = /^#{1,3}\s+/.test(rawTrimmed);
    if (isMarkdownHeader) {
      const label = rawTrimmed.replace(/^#{1,3}\s+/, '');
      blocks.push({ kind: 'header', text: label });
      nextIsHeader = false;
      continue;
    }

    // Numbered section label: "1. Short label" — single line, ≤ 80 chars total.
    // The 80-char cap rules out numbered list items whose body runs into prose.
    const isNumberedLabel =
      /^\d+\.\s+\S/.test(rawTrimmed) &&
      !rawTrimmed.includes('\n') &&
      rawTrimmed.length <= 80;
    if (isNumberedLabel) {
      blocks.push({ kind: 'header', text: stripMarkdown(rawTrimmed) });
      nextIsHeader = false;
      continue;
    }

    const text = stripMarkdown(rawTrimmed);

    if (nextIsHeader) {
      if (text.length <= 80) {
        blocks.push({ kind: 'header', text });
      } else {
        blocks.push({ kind: 'paragraph', text });
      }
      nextIsHeader = false;
      continue;
    }

    blocks.push({ kind: 'paragraph', text });
  }

  return blocks;
}

// Fisher–Yates shuffle (returns a new array; does not mutate the input).
function shuffle<T>(arr: readonly T[]): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

type CitationParts = {
  head: string;
  title: string;
  authors: string;
  para: string;
};

// Parse a Tocqueville item_id like "tocqueville:vol1.part2.ch7" or
// "tocqueville:vol1.t1.notes.A" into a human-readable locator. Only vol/part/ch
// segments are emitted; other segments (preamble, introduction, t1, notes,
// letter codes) are omitted rather than guessed at. The reading view at
// /item/[id] handles full structural display.
function tocquevilleLocator(itemId: string): string {
  const prefix = 'tocqueville:';
  const path = itemId.startsWith(prefix) ? itemId.slice(prefix.length) : itemId;
  const parts: string[] = [];
  for (const seg of path.split('.')) {
    const vol = /^vol(\d+)$/.exec(seg);
    if (vol) {
      const n = parseInt(vol[1], 10);
      parts.push(`Vol. ${n === 1 ? 'I' : n === 2 ? 'II' : String(n)}`);
      continue;
    }
    const part = /^part(\d+)$/.exec(seg);
    if (part) {
      parts.push(`Pt. ${part[1]}`);
      continue;
    }
    const ch = /^ch(\d+)$/.exec(seg);
    if (ch) {
      parts.push(`Ch. ${ch[1]}`);
      continue;
    }
  }
  return parts.join(', ');
}

function citationParts(c: Citation): CitationParts {
  const para = c.paragraph_index != null ? `¶ ${c.paragraph_index}` : '';
  if (c.corpus === 'tocqueville') {
    const locator = tocquevilleLocator(c.item_id);
    return {
      head: locator ? `Democracy in America · ${locator}` : 'Democracy in America',
      title: c.title,
      authors: 'Tocqueville',
      para,
    };
  }
  return {
    head: `Federalist No. ${c.paper_number}`,
    title: c.title,
    authors: c.authors.join(' & '),
    para,
  };
}

function citationHref(c: Citation): string | null {
  if (c.corpus === 'federalist') {
    const base = `/paper/${c.paper_number}`;
    if (c.marker) return `${base}#fn-${c.marker.replace(/[()]/g, '')}`;
    if (c.paragraph_index != null) return `${base}#p-${c.paragraph_index + 1}`;
    return base;
  }
  if (c.corpus === 'tocqueville') {
    return `/item/${c.item_id}`;
  }
  return null;
}

export function AskForm() {
  const [question, setQuestion] = useState('');
  const [sessionQuestion] = useState<string>(getSessionQuestion);
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [streamingAnswer, setStreamingAnswer] = useState('');
  const [blocks, setBlocks] = useState<Block[] | null>(null);
  const [citations, setCitations] = useState<Citation[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [currentPhrase, setCurrentPhrase] = useState<string>(LOADING_PHRASES[0]);

  // Track the last phrase across reshuffles so we never repeat back-to-back.
  const lastPhraseRef = useRef<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Rotate loading phrases every 3s while `loading` is true. Reshuffle when
  // the current pass is exhausted, ensuring the first phrase of a new pass is
  // not the same as the last phrase of the previous one.
  useEffect(() => {
    if (!loading) return;

    let queue = shuffle(LOADING_PHRASES);
    if (lastPhraseRef.current && queue[0] === lastPhraseRef.current && queue.length > 1) {
      [queue[0], queue[1]] = [queue[1], queue[0]];
    }
    let i = 0;
    setCurrentPhrase(queue[0]);
    lastPhraseRef.current = queue[0];

    const interval = window.setInterval(() => {
      i += 1;
      if (i >= queue.length) {
        const reshuffled = shuffle(LOADING_PHRASES);
        if (
          lastPhraseRef.current &&
          reshuffled[0] === lastPhraseRef.current &&
          reshuffled.length > 1
        ) {
          [reshuffled[0], reshuffled[1]] = [reshuffled[1], reshuffled[0]];
        }
        queue = reshuffled;
        i = 0;
      }
      const next = queue[i];
      setCurrentPhrase(next);
      lastPhraseRef.current = next;
    }, 3000);

    return () => {
      window.clearInterval(interval);
    };
  }, [loading]);

  async function submit() {
    const trimmed = question.trim();
    if (!trimmed || loading) return;

    setLoading(true);
    setStreamingAnswer('');
    setBlocks(null);
    setCitations([]);
    setError(null);

    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ question: trimmed }),
      });

      if (!res.ok) {
        let code: string | undefined;
        let raw: string | undefined;
        try {
          const data = (await res.json()) as { error?: unknown; code?: unknown };
          if (typeof data?.code === 'string') code = data.code;
          if (typeof data?.error === 'string') raw = data.error;
        } catch {
          // body unreadable — friendlyError falls back to the generic message
        }
        setError(friendlyError({ status: res.status, code, raw }));
        setLoading(false);
        return;
      }

      if (!res.body) {
        setError(GENERIC_ERROR_MESSAGE);
        setLoading(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let accumulated = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop()!; // last element may be incomplete
        for (const line of lines) {
          if (!line.trim()) continue;
          let event: StreamEvent;
          try {
            event = JSON.parse(line) as StreamEvent;
          } catch {
            continue;
          }
          if (event.type === 'delta') {
            accumulated += event.text;
            setStreamingAnswer(accumulated);
          } else if (event.type === 'done') {
            setBlocks(parseBlocks(accumulated));
            setCitations(event.citations);
            // eslint-disable-next-line no-console
            console.log('promptSha256:', event.promptSha256);
            setLoading(false);
            setStreamingAnswer('');
          } else if (event.type === 'error') {
            setError(friendlyError({ raw: event.message }));
            setLoading(false);
          }
        }
      }
    } catch {
      setError(GENERIC_ERROR_MESSAGE);
      setLoading(false);
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void submit();
      return;
    }
    if (e.key === 'Tab' && question.trim() === '') {
      e.preventDefault();
      setQuestion(sessionQuestion);
    }
  }

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    void submit();
  }

  // Streaming render: strip markdown and split on blank lines but do not parse
  // blocks. A `---` separator may have arrived without its following section
  // label yet; treating it as a header mid-stream would render with stale text
  // and re-layout when the next delta lands.
  const streamingParagraphs = streamingAnswer
    ? stripMarkdown(streamingAnswer)
        .split(/\n{2,}/)
        .map((p) => p.trim())
        .filter((p) => p.length > 0)
    : [];

  return (
    <div>
      <form className="ask-form" onSubmit={onSubmit}>
        <textarea
          className="ask-input"
          rows={7}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={onKeyDown}
          onClick={() => {
            if (question.trim() === '') setQuestion(sessionQuestion);
          }}
          placeholder={mounted ? sessionQuestion : ''}
          disabled={loading}
          aria-label="Question"
          autoFocus
        />
        {question.trim() === '' && (
          <p className="ask-hint">Tap to use this question</p>
        )}
      </form>

      {loading && streamingAnswer === '' && (
        <p className="ask-status" aria-live="polite">
          <span key={currentPhrase} className="loading-phrase">
            {currentPhrase}
          </span>
        </p>
      )}

      {loading && streamingAnswer !== '' && (
        <article className="ask-answer" aria-live="polite">
          {streamingParagraphs.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </article>
      )}

      {!loading && error && (
        <article className="ask-answer" aria-live="polite">
          <p>{error}</p>
        </article>
      )}

      {!loading && blocks && (
        <>
          <article className="ask-answer">
            {blocks.map((block, i) =>
              block.kind === 'header' ? (
                <h3 key={i} className="ask-section-header">
                  {block.text}
                </h3>
              ) : (
                <p key={i}>{block.text}</p>
              ),
            )}
          </article>

          {citations.length > 0 && (
            <section className="ask-sources" aria-label="Sources">
              <h2>Sources</h2>
              <ol>
                {citations.map((c, i) => {
                  const parts = citationParts(c);
                  const href = citationHref(c);
                  const body = (
                    <>
                      {parts.head}
                      {' · '}
                      <em>{parts.title}</em>
                      {' · '}
                      {parts.authors}
                      {parts.para && (
                        <>
                          {' · '}
                          {parts.para}
                        </>
                      )}
                    </>
                  );
                  return (
                    <li key={`${c.item_id}-${i}`}>
                      {href ? <a href={href}>{body}</a> : body}
                    </li>
                  );
                })}
              </ol>
            </section>
          )}
        </>
      )}
    </div>
  );
}
