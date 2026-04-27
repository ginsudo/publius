// Phase 1.3 observability — single audit point for what gets logged per
// /api/ask call (and per harness run when LANGFUSE_TRACING=1). The route
// and the harness call into withAskTrace + withRetrievalSpan +
// withGenerationSpan; all attribute logic lives here so any change to
// "what we log" lands in one diff.
//
// Failure mode (per Phase 1.3 plan): a Langfuse outage, bad keys, or any
// SDK error must not affect /api/ask behaviour. SDK init in
// initObservability() is wrapped in try/catch; the helpers wrap
// startActiveObservation in try/catch and fall through to running fn
// directly when tracing isn't available; individual span.update() calls
// are wrapped to swallow per-attribute failures.

import { createHash } from 'node:crypto';

import { startActiveObservation } from '@langfuse/tracing';

import { EMBEDDING_MODEL } from '../data/eval/lib.ts';
import type { Hit } from '../data/eval/query.ts';
import type { AnthropicResult } from '../prompts/eval/lib.ts';

// =====================================================================
// Error classification — shared with the route's mapError so the
// error.code/error.status attached to the trace match the HTTP error
// the client receives. Single source of truth.
// =====================================================================

export type ErrorClassification = {
  status: number;
  code: string;
  message: string;
};

export function classifyError(e: Error): ErrorClassification {
  const msg = e.message ?? 'unknown error';
  const upstream = msg.match(/Anthropic API (\d{3})/);
  if (upstream) {
    const code = parseInt(upstream[1], 10);
    if (code === 401) return { status: 401, code: 'unauthorized', message: 'Authentication failed upstream' };
    if (code === 429) return { status: 429, code: 'rate_limit', message: 'Rate limited upstream' };
    if (code === 529) return { status: 529, code: 'overload', message: 'Service overloaded upstream' };
    return { status: 502, code: 'upstream_error', message: msg };
  }
  if (msg.includes('ANTHROPIC_API_KEY not set')) {
    return { status: 500, code: 'missing_anthropic_key', message: 'ANTHROPIC_API_KEY not set' };
  }
  if (msg.includes('VOYAGE_API_KEY not set')) {
    return { status: 500, code: 'missing_voyage_key', message: 'VOYAGE_API_KEY not set' };
  }
  return { status: 500, code: 'unexpected_error', message: msg };
}

// =====================================================================
// SDK init — shared between Next.js instrumentation.ts and the harness.
// Returns a handle with shutdown() for harness flush; null if tracing is
// disabled (missing keys or init failure).
// =====================================================================

export type ObservabilityHandle = { shutdown: () => Promise<void> };

export async function initObservability(): Promise<ObservabilityHandle | null> {
  if (!process.env.LANGFUSE_PUBLIC_KEY || !process.env.LANGFUSE_SECRET_KEY) {
    console.error('[observability] Langfuse keys not set; tracing disabled');
    return null;
  }
  try {
    // OTel internal diagnostics — surface exporter failures (network
    // errors, retryable 4xx, terminal HTTP failures) to console.error so
    // they don't vanish silently. Two hooks: the OTLP fetch transport
    // calls diag.warn / diag.error directly (response status, network
    // errors) while the BatchSpanProcessor's export-result path goes
    // through globalErrorHandler. Setting both ensures any failure
    // surfaces. Note: Langfuse Cloud's OTLP endpoint accepts unknown
    // public keys with HTTP 2xx and filters server-side, so a bad
    // public key is invisible here — only network/HTTP failures fire.
    const { diag, DiagLogLevel } = await import('@opentelemetry/api');
    diag.setLogger(
      {
        verbose: () => {},
        debug: () => {},
        info: () => {},
        warn: (...args: unknown[]) => console.error('[observability]', ...args),
        error: (...args: unknown[]) => console.error('[observability]', ...args),
      },
      DiagLogLevel.WARN,
    );
    const { setGlobalErrorHandler } = await import('@opentelemetry/core');
    setGlobalErrorHandler((ex) => {
      const msg = ex instanceof Error ? `${ex.name}: ${ex.message}` : String(ex);
      console.error('[observability] exporter error:', msg);
    });

    const { NodeSDK } = await import('@opentelemetry/sdk-node');
    const { LangfuseSpanProcessor } = await import('@langfuse/otel');
    const sdk = new NodeSDK({ spanProcessors: [new LangfuseSpanProcessor()] });
    sdk.start();
    return {
      shutdown: () =>
        sdk.shutdown().catch((e) => {
          console.error(
            '[observability] sdk.shutdown failed:',
            e instanceof Error ? e.message : e,
          );
        }),
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[observability] Langfuse SDK init failed; tracing disabled:', msg);
    return null;
  }
}

// =====================================================================
// Hit-set hashes — full SHA-256 hex over '|'-joined ids.
// hash_ordered = ranking-order; hash_set = alphabetically-sorted (cross-
// session ranking-invariant fingerprint).
// =====================================================================

function hashIds(ids: string[]): string {
  return createHash('sha256').update(ids.join('|')).digest('hex');
}

// =====================================================================
// withAskTrace — parent observation for one /api/ask (or harness) call.
// Holds request-level attributes (question, k, prompt_sha256, source,
// answer) and the error.code/error.status pair on failure. fn must
// return an object with `answer: string` so the trace output can be
// stamped without a second helper call.
// =====================================================================

export type AskTraceOpts = {
  question: string;
  k: number;
  promptSha256: string;
  source: 'route' | 'harness';
};

export async function withAskTrace<T extends { answer: string }>(
  opts: AskTraceOpts,
  fn: () => Promise<T>,
): Promise<T> {
  let started = false;
  try {
    return await startActiveObservation('publius-ask', async (span) => {
      started = true;
      try {
        span.update({
          input: opts.question,
          metadata: {
            k: opts.k,
            prompt_sha256: opts.promptSha256,
            source: opts.source,
          },
        });
      } catch {
        /* swallow per-attribute failures */
      }

      try {
        const result = await fn();
        try {
          span.update({ output: result.answer });
        } catch {
          /* swallow */
        }
        return result;
      } catch (e) {
        const err = e instanceof Error ? e : new Error(String(e));
        try {
          const c = classifyError(err);
          span.update({
            level: 'ERROR',
            statusMessage: c.message,
            metadata: { 'error.code': c.code, 'error.status': c.status },
          });
        } catch {
          /* swallow */
        }
        throw err;
      }
    });
  } catch (e) {
    if (started) throw e;
    // SDK / wrapper failure before fn ran — fall back to uninstrumented.
    console.error(
      '[observability] withAskTrace wrapper failed; running uninstrumented:',
      e instanceof Error ? e.message : e,
    );
    return await fn();
  }
}

// =====================================================================
// withRetrievalSpan — child observation wrapping queryIndex. Captures
// retrieval.* attributes including the two hit-set hashes.
// =====================================================================

export async function withRetrievalSpan(
  question: string,
  k: number,
  fn: () => Promise<Hit[]>,
): Promise<Hit[]> {
  let started = false;
  const startedAt = Date.now();
  try {
    return await startActiveObservation(
      'retrieval',
      async (span) => {
        started = true;
        try {
          span.update({
            input: question,
            metadata: { k, 'voyage.model': EMBEDDING_MODEL },
          });
        } catch {
          /* swallow */
        }
        const hits = await fn();
        const latency = Date.now() - startedAt;
        try {
          const ids = hits.map((h) => h.id);
          const sortedIds = [...ids].sort();
          const scores = hits.map((h) => h.score);
          span.update({
            output: { ids, scores },
            metadata: {
              k,
              'voyage.model': EMBEDDING_MODEL,
              'retrieval.latency_ms': latency,
              'retrieval.top10.hash_ordered': hashIds(ids),
              'retrieval.top10.hash_set': hashIds(sortedIds),
              'retrieval.top10.ids': ids,
              'retrieval.top10.scores': scores,
              'retrieval.top1.score': scores[0] ?? null,
            },
          });
        } catch {
          /* swallow */
        }
        return hits;
      },
      { asType: 'retriever' },
    );
  } catch (e) {
    if (started) throw e;
    console.error(
      '[observability] withRetrievalSpan wrapper failed; running uninstrumented:',
      e instanceof Error ? e.message : e,
    );
    return await fn();
  }
}

// =====================================================================
// withGenerationSpan — child observation wrapping askClaude. Uses
// Langfuse's generation observation type so the UI surfaces tokens and
// model in the generation panel.
// =====================================================================

export async function withGenerationSpan(
  model: string,
  fn: () => Promise<AnthropicResult>,
): Promise<AnthropicResult> {
  let started = false;
  const startedAt = Date.now();
  try {
    return await startActiveObservation(
      'generation',
      async (span) => {
        started = true;
        try {
          span.update({ model });
        } catch {
          /* swallow */
        }
        const result = await fn();
        const latency = Date.now() - startedAt;
        try {
          span.update({
            output: result.text,
            model,
            usageDetails: {
              input: result.inputTokens,
              output: result.outputTokens,
            },
            metadata: {
              'generation.stop_reason': result.stopReason,
              'generation.latency_ms': latency,
            },
          });
        } catch {
          /* swallow */
        }
        return result;
      },
      { asType: 'generation' },
    );
  } catch (e) {
    if (started) throw e;
    console.error(
      '[observability] withGenerationSpan wrapper failed; running uninstrumented:',
      e instanceof Error ? e.message : e,
    );
    return await fn();
  }
}
