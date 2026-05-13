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
  paper_number: number;
  title: string;
  authors: string[];
  authorship_status: string;
  date: string;
};

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
  'The inquiry is before us.',
  'Let us trace this further.',
  'The matter deserves a candid inquiry.',
  'It remains to be considered…',
  'The inquiry naturally presents itself…',
  'Upon reflection, the question resolves into…',
];

function getSessionQuestion(): string {
  if (typeof window === 'undefined') return sampleQuestions[0].question;
  return sampleQuestions[Math.floor(Math.random() * sampleQuestions.length)].question;
}

function stripMarkdown(s: string): string {
  return s
    .replace(/\*\*([\s\S]+?)\*\*/g, '$1')
    .replace(/__([\s\S]+?)__/g, '$1')
    .replace(/\*([\s\S]+?)\*/g, '$1');
}

function splitParagraphs(answer: string): string[] {
  return stripMarkdown(answer)
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
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

function citationParts(c: Citation): CitationParts {
  return {
    head: `Federalist No. ${c.paper_number}`,
    title: c.title,
    authors: c.authors.join(' & '),
    para: c.paragraph_index != null ? `¶ ${c.paragraph_index}` : '',
  };
}

function citationHref(c: Citation): string {
  const base = `/paper/${c.paper_number}`;
  if (c.marker) return `${base}#fn-${c.marker.replace(/[()]/g, '')}`;
  if (c.paragraph_index != null) return `${base}#p-${c.paragraph_index + 1}`;
  return base;
}

export function AskForm() {
  const [question, setQuestion] = useState('');
  const [sessionQuestion] = useState<string>(getSessionQuestion);
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [streamingAnswer, setStreamingAnswer] = useState('');
  const [answer, setAnswer] = useState<string | null>(null);
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
    setAnswer(null);
    setCitations([]);
    setError(null);

    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ question: trimmed }),
      });

      if (!res.ok) {
        let message = 'Something went wrong.';
        try {
          const data = (await res.json()) as { error?: unknown };
          if (typeof data?.error === 'string' && data.error.length > 0) {
            message = data.error;
          }
        } catch {
          // fall through with default message
        }
        setError(message);
        setLoading(false);
        return;
      }

      if (!res.body) {
        setError('Something went wrong.');
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
            setAnswer(accumulated);
            setCitations(event.citations);
            // eslint-disable-next-line no-console
            console.log('promptSha256:', event.promptSha256);
            setLoading(false);
            setStreamingAnswer('');
          } else if (event.type === 'error') {
            setError(event.message);
            setLoading(false);
          }
        }
      }
    } catch {
      setError('Something went wrong.');
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

  const finalParagraphs = answer ? splitParagraphs(answer) : [];
  const streamingParagraphs = streamingAnswer ? splitParagraphs(streamingAnswer) : [];

  return (
    <div>
      <form className="ask-form" onSubmit={onSubmit}>
        <textarea
          className="ask-input"
          rows={5}
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
        <p className="ask-status ask-status--error" role="alert">
          {error}
        </p>
      )}

      {!loading && answer && (
        <>
          <article className="ask-answer">
            {finalParagraphs.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </article>

          {citations.length > 0 && (
            <section className="ask-sources" aria-label="Sources">
              <h2>Sources</h2>
              <ol>
                {citations.map((c, i) => {
                  const parts = citationParts(c);
                  return (
                    <li key={`${c.item_id}-${i}`}>
                      <a href={citationHref(c)}>
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
                      </a>
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
