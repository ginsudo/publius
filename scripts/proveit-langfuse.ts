// Phase 1.3 prove-it: confirm a generic Langfuse span captures a Voyage embed call.
// Cashes the "no Voyage example in current docs" flag from the Phase 1.3 plan.
// Run: node --experimental-strip-types scripts/proveit-langfuse.ts
import { NodeSDK } from '@opentelemetry/sdk-node';
import { LangfuseSpanProcessor } from '@langfuse/otel';
import { startActiveObservation } from '@langfuse/tracing';
import { loadEnv, voyageEmbed } from '../data/eval/lib.ts';

loadEnv();
for (const k of ['LANGFUSE_PUBLIC_KEY', 'LANGFUSE_SECRET_KEY', 'LANGFUSE_BASE_URL', 'VOYAGE_API_KEY']) {
  if (!process.env[k]) { console.error(`missing env: ${k}`); process.exit(2); }
}

const sdk = new NodeSDK({ spanProcessors: [new LangfuseSpanProcessor()] });
sdk.start();

await startActiveObservation('publius-proveit-voyage', async (span) => {
  const q = 'proveit: voyage embed inside a generic langfuse span';
  span.update({ input: q });
  const { embeddings } = await voyageEmbed([q], 'query');
  span.update({ output: { embedding_dim: embeddings[0].length } });
});

await sdk.shutdown();
console.log('flushed; check Langfuse Cloud for trace name "publius-proveit-voyage"');
