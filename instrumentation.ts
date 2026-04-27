// Next.js instrumentation hook — boots the Langfuse OTel processor when the
// Node runtime starts. Edge runtime is skipped (sqlite-vec + node:sqlite are
// Node-only anyway). Failure to initialise observability is logged but never
// crashes the app: the route falls back to uninstrumented operation.

export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const { initObservability } = await import('./lib/observability.ts');
  await initObservability();
}
