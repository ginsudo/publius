import type { NextConfig } from 'next';

// outputFileTracingIncludes: Next's static tracer doesn't follow runtime
// path-string reads (vec0 binary loaded via db.loadExtension(), index.sqlite
// opened via DatabaseSync, system prompt read via readFileSync). Force-include
// these into the function bundle so they ship to Vercel.
const config: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  outputFileTracingIncludes: {
    '/api/ask': [
      './data/eval/vendor/**',
      './data/eval/index.sqlite',
      './config/system-prompt.md',
    ],
    '/api/retrieve': [
      './data/eval/vendor/**',
      './data/eval/index.sqlite',
    ],
  },
};

export default config;
