import { resolve } from 'node:path';
import { createHash } from 'node:crypto';

import { queryIndex, toCitation, type Citation } from '../../../data/eval/query.ts';
import { askClaude, extractPrompt, formatHits, QA_MODEL } from '../../../prompts/eval/lib.ts';
import {
  classifyError,
  withAskTrace,
  withGenerationSpan,
  withRetrievalSpan,
} from '../../../lib/observability.ts';

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
  // Classification logic lives in lib/observability.ts so the trace's
  // error.code/error.status match what the client receives.
  const c = classifyError(e);
  return errorResponse(c.status, c.message, c.code);
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
    const response = await withAskTrace(
      { question, k, promptSha256: PROMPT_SHA256, source: 'route' },
      async () => {
        const hits = await withRetrievalSpan(question, k, () => queryIndex(question, k));
        const userMessage = `${question}\n\n---\n\nRetrieved passages:\n\n${formatHits(hits)}`;
        const result = await withGenerationSpan(QA_MODEL, () => askClaude(SYSTEM_PROMPT, userMessage));
        return {
          answer: result.text,
          citations: hits.map(toCitation),
          usage: {
            inputTokens: result.inputTokens,
            outputTokens: result.outputTokens,
            stopReason: result.stopReason,
          },
          promptSha256: PROMPT_SHA256,
        } satisfies AskResponse;
      },
    );
    return Response.json(response);
  } catch (e) {
    return mapError(e instanceof Error ? e : new Error(String(e)));
  }
}
