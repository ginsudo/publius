import { resolve } from 'node:path';
import { createHash } from 'node:crypto';

import { queryIndex, toCitation, type Citation } from '../../../data/eval/query.ts';
import { askClaude, extractPrompt, formatHits } from '../../../prompts/eval/lib.ts';

export const runtime = 'nodejs';

const PROMPT_PATH = resolve(process.cwd(), 'prompts/system-prompt-v0.2.md');
const SYSTEM_PROMPT = extractPrompt(PROMPT_PATH);
const PROMPT_SHA256 = createHash('sha256').update(SYSTEM_PROMPT).digest('hex');

type AskRequest = { question: string; k?: number };

type AskResponse = {
  answer: string;
  citations: Citation[];
  usage: { inputTokens: number; outputTokens: number; stopReason: string };
  promptSha256: string;
};

function errorResponse(status: number, error: string, code?: string): Response {
  return Response.json({ error, ...(code ? { code } : {}) }, { status });
}

function mapError(e: Error): Response {
  const msg = e.message ?? 'unknown error';
  const upstream = msg.match(/Anthropic API (\d{3})/);
  if (upstream) {
    const code = parseInt(upstream[1], 10);
    if (code === 401) return errorResponse(401, 'Authentication failed upstream', 'unauthorized');
    if (code === 429) return errorResponse(429, 'Rate limited upstream', 'rate_limit');
    if (code === 529) return errorResponse(529, 'Service overloaded upstream', 'overload');
    return errorResponse(502, msg, 'upstream_error');
  }
  if (msg.includes('ANTHROPIC_API_KEY not set')) {
    return errorResponse(500, 'ANTHROPIC_API_KEY not set', 'missing_anthropic_key');
  }
  if (msg.includes('VOYAGE_API_KEY not set')) {
    return errorResponse(500, 'VOYAGE_API_KEY not set', 'missing_voyage_key');
  }
  return errorResponse(500, msg, 'unexpected_error');
}

export async function POST(request: Request): Promise<Response> {
  let body: AskRequest;
  try {
    body = (await request.json()) as AskRequest;
  } catch {
    return errorResponse(400, 'Body must be valid JSON', 'malformed_input');
  }

  const question = typeof body?.question === 'string' ? body.question.trim() : '';
  if (!question) {
    return errorResponse(400, 'question must be a non-empty string', 'malformed_input');
  }

  const k = body.k ?? 10;
  if (typeof k !== 'number' || !Number.isInteger(k) || k < 1 || k > 25) {
    return errorResponse(400, 'k must be an integer between 1 and 25', 'malformed_input');
  }

  try {
    const hits = await queryIndex(question, k);
    const userMessage = `${question}\n\n---\n\nRetrieved passages:\n\n${formatHits(hits)}`;
    const result = await askClaude(SYSTEM_PROMPT, userMessage);

    const response: AskResponse = {
      answer: result.text,
      citations: hits.map(toCitation),
      usage: {
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        stopReason: result.stopReason,
      },
      promptSha256: PROMPT_SHA256,
    };
    return Response.json(response);
  } catch (e) {
    return mapError(e instanceof Error ? e : new Error(String(e)));
  }
}
