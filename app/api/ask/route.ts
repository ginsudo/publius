import { resolve } from 'node:path';
import { createHash } from 'node:crypto';

import Anthropic from '@anthropic-ai/sdk';
import { startActiveObservation } from '@langfuse/tracing';

import { queryIndex, toCitation, type Citation, type Hit } from '../../../data/eval/query.ts';
import { askClaude, extractPrompt, formatHits, QA_MODEL } from '../../../lib/ask.ts';
import {
  classifyError,
  withAskTrace,
  withGenerationSpan,
  withRetrievalSpan,
} from '../../../lib/observability.ts';

export const runtime = 'nodejs';

const PROMPT_PATH = resolve(process.cwd(), 'config/system-prompt.md');
const SYSTEM_PROMPT = extractPrompt(PROMPT_PATH);
const PROMPT_SHA256 = createHash('sha256').update(SYSTEM_PROMPT).digest('hex');

type AskRequest = { question: string; k?: number };

type DeltaEvent = { type: 'delta'; text: string };
type DoneEvent = {
  type: 'done';
  citations: Citation[];
  usage: { inputTokens: number; outputTokens: number; stopReason: string };
  promptSha256: string;
};
type ErrorEvent = { type: 'error'; message: string };

// Minimal shape we need from the askSpan. Use unknown updates because the
// startActiveObservation callback's span type is private to @langfuse/tracing.
type SpanLike = { update: (u: Record<string, unknown>) => void };

function errorResponse(status: number, error: string, code?: string): Response {
  return Response.json({ error, ...(code ? { code } : {}) }, { status });
}

function mapError(e: Error): Response {
  // Classification logic lives in lib/observability.ts so the trace's
  // error.code/error.status match what the client receives.
  const c = classifyError(e);
  return errorResponse(c.status, c.message, c.code);
}

function safeUpdate(span: SpanLike | null, update: Record<string, unknown>): void {
  if (!span) return;
  try {
    span.update(update);
  } catch {
    /* swallow per-attribute failures */
  }
}

// The streaming lifecycle does not fit the existing withAskTrace /
// withGenerationSpan signatures (which expect a single resolved AnthropicResult).
// Instead, we drive observation explicitly: askSpan is opened by the caller
// (or null when tracing is unavailable), and the generation span is opened
// inside ReadableStream.start() and finalized after stream.finalMessage()
// resolves. The askSpan stays alive across the stream because the caller
// awaits streamDone before its observation callback returns.
async function runStreamingAsk(
  askSpan: SpanLike | null,
  apiKey: string,
  question: string,
  k: number,
  resolveResponse: (r: Response) => void,
): Promise<void> {
  safeUpdate(askSpan, {
    input: question,
    metadata: { k, prompt_sha256: PROMPT_SHA256, source: 'route' },
  });

  let hits: Hit[];
  try {
    hits = await withRetrievalSpan(question, k, () => queryIndex(question, k));
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e));
    const c = classifyError(err);
    safeUpdate(askSpan, {
      level: 'ERROR',
      statusMessage: c.message,
      metadata: { 'error.code': c.code, 'error.status': c.status },
    });
    resolveResponse(mapError(err));
    return;
  }

  const userMessage = `${question}\n\n---\n\nRetrieved passages:\n\n${formatHits(hits)}`;
  const anthropic = new Anthropic({ apiKey });
  const stream = anthropic.messages.stream({
    model: QA_MODEL,
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userMessage }],
  });

  let accumulated = '';
  let streamError: Error | null = null;
  let resolveStreamDone!: () => void;
  const streamDone = new Promise<void>((r) => {
    resolveStreamDone = r;
  });

  const encoder = new TextEncoder();
  const enqueue = (
    controller: ReadableStreamDefaultController<Uint8Array>,
    obj: DeltaEvent | DoneEvent | ErrorEvent,
  ) => {
    controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n'));
  };

  const responseStream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        await startActiveObservation(
          'generation',
          async (genSpan) => {
            safeUpdate(genSpan as SpanLike, { model: QA_MODEL });
            const startedAt = Date.now();
            for await (const event of stream) {
              if (
                event.type === 'content_block_delta' &&
                event.delta.type === 'text_delta'
              ) {
                accumulated += event.delta.text;
                enqueue(controller, { type: 'delta', text: event.delta.text });
              }
            }
            const finalMessage = await stream.finalMessage();
            const latency = Date.now() - startedAt;
            const usage = {
              inputTokens: finalMessage.usage.input_tokens,
              outputTokens: finalMessage.usage.output_tokens,
              stopReason: finalMessage.stop_reason ?? 'end_turn',
            };
            safeUpdate(genSpan as SpanLike, {
              output: accumulated,
              model: QA_MODEL,
              usageDetails: { input: usage.inputTokens, output: usage.outputTokens },
              metadata: {
                'generation.stop_reason': usage.stopReason,
                'generation.latency_ms': latency,
              },
            });
            enqueue(controller, {
              type: 'done',
              citations: hits.map(toCitation),
              usage,
              promptSha256: PROMPT_SHA256,
            });
          },
          { asType: 'generation' },
        );
        controller.close();
      } catch (e) {
        streamError = e instanceof Error ? e : new Error(String(e));
        try {
          enqueue(controller, { type: 'error', message: streamError.message });
        } catch {
          /* swallow */
        }
        try {
          controller.close();
        } catch {
          /* swallow */
        }
      } finally {
        resolveStreamDone();
      }
    },
  });

  resolveResponse(
    new Response(responseStream, {
      headers: { 'content-type': 'application/x-ndjson' },
    }),
  );

  await streamDone;

  if (streamError) {
    const c = classifyError(streamError);
    safeUpdate(askSpan, {
      level: 'ERROR',
      statusMessage: c.message,
      metadata: { 'error.code': c.code, 'error.status': c.status },
    });
  } else {
    safeUpdate(askSpan, { output: accumulated });
  }
}

// Non-streaming escape hatch. Mirrors the route's pre-streaming shape and uses
// the existing withAskTrace / withGenerationSpan wrappers unchanged.
async function postJson(question: string, k: number): Promise<Response> {
  try {
    const response = await withAskTrace(
      { question, k, promptSha256: PROMPT_SHA256, source: 'route' },
      async () => {
        const hits = await withRetrievalSpan(question, k, () => queryIndex(question, k));
        const userMessage = `${question}\n\n---\n\nRetrieved passages:\n\n${formatHits(hits)}`;
        const result = await withGenerationSpan(QA_MODEL, () =>
          askClaude(SYSTEM_PROMPT, userMessage),
        );
        return {
          answer: result.text,
          citations: hits.map(toCitation),
          usage: {
            inputTokens: result.inputTokens,
            outputTokens: result.outputTokens,
            stopReason: result.stopReason,
          },
          promptSha256: PROMPT_SHA256,
        };
      },
    );
    return Response.json(response);
  } catch (e) {
    return mapError(e instanceof Error ? e : new Error(String(e)));
  }
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

  // Escape hatch: ?transport=json bypasses streaming and returns the original
  // single-object JSON shape. For debugging and incident response. Not
  // documented in the public API surface.
  const transport = new URL(request.url).searchParams.get('transport');
  if (transport === 'json') {
    return await postJson(question, k);
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return mapError(new Error('ANTHROPIC_API_KEY not set in .env.local.'));
  }

  let resolveResponse!: (r: Response) => void;
  const responsePromise = new Promise<Response>((r) => {
    resolveResponse = r;
  });

  // Floating ask-trace task. Two failure shapes:
  //   1) The observation wrapper fails before fn runs (started === false).
  //      Fall through to running the work uninstrumented, like withAskTrace.
  //   2) The wrapper or the work itself throws after fn runs. Log and ensure
  //      resolveResponse has been called so the client doesn't hang.
  let started = false;
  void (async () => {
    try {
      await startActiveObservation('publius-ask', async (askSpan) => {
        started = true;
        await runStreamingAsk(askSpan as SpanLike, apiKey, question, k, resolveResponse);
      });
    } catch (e) {
      if (!started) {
        console.error(
          '[observability] askTrace wrapper failed; running uninstrumented:',
          e instanceof Error ? e.message : e,
        );
        try {
          await runStreamingAsk(null, apiKey, question, k, resolveResponse);
        } catch (inner) {
          console.error(
            '[ask] uninstrumented run failed:',
            inner instanceof Error ? inner.message : inner,
          );
          resolveResponse(
            mapError(inner instanceof Error ? inner : new Error(String(inner))),
          );
        }
      } else {
        console.error(
          '[ask] traced run threw after start:',
          e instanceof Error ? e.message : e,
        );
      }
    }
  })();

  return await responsePromise;
}
