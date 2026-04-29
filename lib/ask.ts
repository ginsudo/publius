// Phase 1.2 Q&A test harness — shared helpers.
//
// Builds on data/eval primitives (loadEnv from data/eval/lib.ts and
// queryIndex from data/eval/query.ts). Adds: prompt-file extraction,
// question-set parsing, retrieval-hit formatting, and a minimal Anthropic
// HTTP client (no SDK).

import { readFileSync } from 'node:fs';
import type { Hit } from '../data/eval/query.ts';

// =====================================================================
// Prompt extraction
// =====================================================================

// By convention, a Publius prompt file contains a "## The prompt" heading
// (optionally with a version suffix like "(v0.1)") followed by the prompt
// text, terminated by the next "---" rule on its own line. Everything
// outside that span — preface, design notes, failure-mode predictions — is
// human-only and never sent to the model.
export function extractPrompt(filePath: string): string {
  const raw = readFileSync(filePath, 'utf8');
  const lines = raw.split('\n');
  const headingRe = /^##\s+The prompt(\s+\(.*\))?\s*$/i;

  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (headingRe.test(lines[i])) {
      start = i;
      break;
    }
  }
  if (start === -1) {
    throw new Error(
      `Prompt file ${filePath} has no "## The prompt" heading. ` +
        'See the structural note at the top of prompts/system-prompt.md.',
    );
  }

  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (lines[i].trim() === '---') {
      end = i;
      break;
    }
  }

  const body = lines
    .slice(start + 1, end)
    .join('\n')
    .replace(/^\s*\n/, '')
    .replace(/\n\s*$/, '');
  if (body.trim().length === 0) {
    throw new Error(`Prompt file ${filePath} has an empty "## The prompt" section.`);
  }
  return body;
}

// =====================================================================
// Question-set parsing
// =====================================================================

export type Question = {
  id: string;     // "Q1", "Q2", ...
  text: string;   // model-facing prose
};

// Each question begins with a "### Q<N>" heading. The model-facing text is
// the prose between that heading and the first line beginning with
// "*What it tests:*", or the next markdown heading if no italics line
// appears. Italic test-design commentary is human-only.
export function parseQuestions(filePath: string): Question[] {
  const raw = readFileSync(filePath, 'utf8');
  const lines = raw.split('\n');
  const headingRe = /^###\s+(Q\d+)\s*$/;
  const stopRe = /^\*What it tests:\*/i;
  const otherHeadingRe = /^#{1,3}\s+/;

  const out: Question[] = [];
  let i = 0;
  while (i < lines.length) {
    const m = lines[i].match(headingRe);
    if (!m) {
      i++;
      continue;
    }
    const id = m[1];
    let j = i + 1;
    const buf: string[] = [];
    while (j < lines.length) {
      if (stopRe.test(lines[j]) || otherHeadingRe.test(lines[j])) break;
      buf.push(lines[j]);
      j++;
    }
    const text = buf.join('\n').trim();
    if (text.length === 0) {
      throw new Error(`${filePath}: ${id} has no question text.`);
    }
    out.push({ id, text });
    i = j;
  }
  if (out.length === 0) {
    throw new Error(`${filePath}: no "### Q<N>" headings found.`);
  }
  return out;
}

// =====================================================================
// Hit formatting (model-facing context)
// =====================================================================

// One labeled block per hit. Preserves every metadata field the Q&A layer
// might need to attribute claims — corpus, kind, paragraph_index/marker,
// paper number, authors, authorship_status, date — alongside the chunk text
// as embedded. The chunk text already carries its own header (per Phase 1.1
// chunking) so the model sees the header context twice; that's intentional.
export function formatHit(h: Hit): string {
  const where = h.kind === 'footnote'
    ? `marker=${h.marker}`
    : `paragraph_index=${h.paragraph_index}`;
  const authors = h.authors.join(', ');
  return [
    `[Hit ${h.rank}] similarity=${h.score.toFixed(3)}`,
    `corpus=${h.corpus} | item=${h.item_id} | kind=${h.kind} | ${where}`,
    `paper=${h.paper_number} | title=${h.title} | authors=${authors}`,
    `authorship_status=${h.authorship_status} | date=${h.date}`,
    '',
    h.text,
  ].join('\n');
}

export function formatHits(hits: Hit[]): string {
  if (hits.length === 0) return '(no passages retrieved)';
  return hits.map(formatHit).join('\n\n---\n\n');
}

// =====================================================================
// Anthropic client (HTTP, no SDK)
// =====================================================================

export const QA_MODEL = 'claude-sonnet-4-6';

export type AnthropicResult = {
  text: string;
  inputTokens: number;
  outputTokens: number;
  stopReason: string;
};

export async function askClaude(
  systemPrompt: string,
  userMessage: string,
  options: { model?: string; maxTokens?: number } = {},
): Promise<AnthropicResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY not set in .env.local.');
  }
  const model = options.model ?? QA_MODEL;
  const maxTokens = options.maxTokens ?? 4096;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Anthropic API ${res.status} ${res.statusText}: ${body.slice(0, 800)}`);
  }
  const json = (await res.json()) as {
    content: Array<{ type: string; text?: string }>;
    usage: { input_tokens: number; output_tokens: number };
    stop_reason: string;
  };
  const textBlock = json.content.find((b) => b.type === 'text');
  if (!textBlock || !textBlock.text) {
    throw new Error('Anthropic response had no text content block');
  }
  return {
    text: textBlock.text,
    inputTokens: json.usage.input_tokens,
    outputTokens: json.usage.output_tokens,
    stopReason: json.stop_reason,
  };
}
