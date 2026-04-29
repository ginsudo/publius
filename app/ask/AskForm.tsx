'use client';

import { useState } from 'react';
import type { FormEvent, KeyboardEvent } from 'react';

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

type AskResponse = {
  answer: string;
  citations: Citation[];
  usage: { inputTokens: number; outputTokens: number; stopReason: string };
  promptSha256: string;
};

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
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<AskResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    const trimmed = question.trim();
    if (!trimmed || loading) return;

    setLoading(true);
    setResponse(null);
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
        return;
      }

      const data = (await res.json()) as AskResponse;
      // eslint-disable-next-line no-console
      console.log('promptSha256:', data.promptSha256);
      setResponse(data);
    } catch {
      setError('Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void submit();
    }
  }

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    void submit();
  }

  const paragraphs = response ? splitParagraphs(response.answer) : [];

  return (
    <div>
      <form className="ask-form" onSubmit={onSubmit}>
        <textarea
          className="ask-input"
          rows={2}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Does republican government require strong central power, or does strong central power threaten republican government?"
          disabled={loading}
          aria-label="Question"
          autoFocus
        />
      </form>

      {loading && <p className="ask-status">Thinking…</p>}

      {!loading && error && (
        <p className="ask-status ask-status--error" role="alert">
          {error}
        </p>
      )}

      {!loading && response && (
        <>
          <article className="ask-answer">
            {paragraphs.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </article>

          {response.citations.length > 0 && (
            <section className="ask-sources" aria-label="Sources">
              <h2>Sources</h2>
              <ol>
                {response.citations.map((c, i) => {
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
