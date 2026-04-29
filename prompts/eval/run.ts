// Phase 1.2 Q&A test-harness CLI.
//
// Run a system prompt against a question set, write a results markdown.
//
//   node --experimental-strip-types prompts/eval/run.ts \
//     --prompt prompts/system-prompt.md \
//     --questions prompts/test-questions.md \
//     --output prompts/eval/results-v0.1-runA.md \
//     [--k=10] [--limit=N]

import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadEnv } from '../../data/eval/lib.ts';
import { queryIndex, type Hit } from '../../data/eval/query.ts';
import {
  askClaude,
  extractPrompt,
  formatHits,
  parseQuestions,
  QA_MODEL,
  type Question,
} from '../../lib/ask.ts';
import {
  initObservability,
  withAskTrace,
  withGenerationSpan,
  withRetrievalSpan,
  type ObservabilityHandle,
} from '../../lib/observability.ts';

type Args = {
  prompt: string;
  questions: string;
  output: string;
  k: number;
  limit: number | null;
  questionsFilter: string[] | null;
};

function parseArgs(argv: string[]): Args {
  const map: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) throw new Error(`unexpected positional arg: ${a}`);
    const eq = a.indexOf('=');
    if (eq >= 0) {
      map[a.slice(2, eq)] = a.slice(eq + 1);
    } else {
      const next = argv[i + 1];
      if (next === undefined) throw new Error(`flag ${a} missing value`);
      map[a.slice(2)] = next;
      i++;
    }
  }
  for (const k of ['prompt', 'questions', 'output']) {
    if (!map[k]) {
      throw new Error(
        'usage: run.ts --prompt <path> --questions <path> --output <path> ' +
          '[--k=10] [--limit=N] [--questions-filter=Q1,Q3,...]',
      );
    }
  }
  const filterRaw = map['questions-filter'];
  const questionsFilter = filterRaw
    ? filterRaw.split(',').map((s) => s.trim()).filter((s) => s.length > 0)
    : null;
  return {
    prompt: map.prompt,
    questions: map.questions,
    output: map.output,
    k: map.k ? parseInt(map.k, 10) : 10,
    limit: map.limit ? parseInt(map.limit, 10) : null,
    questionsFilter,
  };
}

function sha256(s: string): string {
  return createHash('sha256').update(s).digest('hex');
}

function buildUserMessage(question: string, hits: Hit[]): string {
  return [
    'QUESTION:',
    question,
    '',
    'RETRIEVED PASSAGES:',
    formatHits(hits),
  ].join('\n');
}

function formatHitSummary(h: Hit): string {
  const where = h.kind === 'footnote' ? `footnote ${h.marker}` : `¶${h.paragraph_index}`;
  const status = h.authorship_status === 'undisputed' ? '' : ` _[${h.authorship_status}]_`;
  return `${h.rank}. **${h.score.toFixed(3)}** — \`${h.item_id}\` ${where} — ${h.authors.join(', ')}${status}`;
}

async function runOne(
  q: Question,
  k: number,
  promptText: string,
  promptHash: string,
): Promise<{ hits: Hit[]; result: Awaited<ReturnType<typeof askClaude>> }> {
  const traced = process.env.LANGFUSE_TRACING === '1';
  const work = async () => {
    const hits = traced
      ? await withRetrievalSpan(q.text, k, () => queryIndex(q.text, k))
      : await queryIndex(q.text, k);
    const userMsg = buildUserMessage(q.text, hits);
    const result = traced
      ? await withGenerationSpan(QA_MODEL, () => askClaude(promptText, userMsg))
      : await askClaude(promptText, userMsg);
    return { hits, result, answer: result.text };
  };
  if (traced) {
    const out = await withAskTrace(
      { question: q.text, k, promptSha256: promptHash, source: 'harness' },
      work,
    );
    return { hits: out.hits, result: out.result };
  }
  const out = await work();
  return { hits: out.hits, result: out.result };
}

async function main() {
  loadEnv();
  const args = parseArgs(process.argv.slice(2));

  let observability: ObservabilityHandle | null = null;
  if (process.env.LANGFUSE_TRACING === '1') {
    observability = await initObservability();
  }

  const promptPath = resolve(args.prompt);
  const questionsPath = resolve(args.questions);
  const outputPath = resolve(args.output);

  const promptText = extractPrompt(promptPath);
  const promptHash = sha256(promptText);

  const allQuestions = parseQuestions(questionsPath);
  let questions = allQuestions;
  if (args.questionsFilter) {
    const have = new Set(allQuestions.map((q) => q.id));
    const missing = args.questionsFilter.filter((id) => !have.has(id));
    if (missing.length > 0) {
      throw new Error(
        `--questions-filter references unknown IDs: ${missing.join(', ')}. ` +
          `Available: ${[...have].join(', ')}`,
      );
    }
    const wanted = new Set(args.questionsFilter);
    questions = allQuestions.filter((q) => wanted.has(q.id));
  }
  if (args.limit !== null) {
    questions = questions.slice(0, args.limit);
  }

  // Verification logging — print the extracted prompt to stderr so the
  // operator can eyeball that extraction matches the source. Quiet or
  // remove once trusted.
  console.error('===== EXTRACTED SYSTEM PROMPT =====');
  console.error(promptText);
  console.error('===== END EXTRACTED PROMPT =====');
  console.error('');
  console.error(`prompt path:    ${promptPath}`);
  console.error(`prompt sha256:  ${promptHash}`);
  console.error(`questions path: ${questionsPath}`);
  console.error(`questions:      ${questions.length} of ${allQuestions.length} (${questions.map((q) => q.id).join(', ')})`);
  console.error(`model:          ${QA_MODEL}`);
  console.error(`top-K:          ${args.k}`);
  console.error('');

  const lines: string[] = [];
  const startedAt = new Date().toISOString();
  lines.push('# Publius Q&A harness — results');
  lines.push('');
  lines.push(`- Run started: ${startedAt}`);
  lines.push(`- Prompt file: \`${args.prompt}\``);
  lines.push(`- Prompt sha256 (extracted section): \`${promptHash}\``);
  lines.push(`- Question set: \`${args.questions}\``);
  lines.push(`- Questions: ${questions.length} of ${allQuestions.length} — ${questions.map((q) => q.id).join(', ')}`);
  lines.push(`- Model: ${QA_MODEL}`);
  lines.push(`- Top-K: ${args.k}`);
  lines.push('');
  lines.push('---');
  lines.push('');

  for (const q of questions) {
    process.stderr.write(`  ${q.id}... `);
    const { hits, result } = await runOne(q, args.k, promptText, promptHash);
    process.stderr.write(`${result.outputTokens} tokens (${result.stopReason})\n`);

    lines.push(`## ${q.id}`);
    lines.push('');
    lines.push('**Question:**');
    lines.push('');
    lines.push('> ' + q.text.replace(/\n/g, '\n> '));
    lines.push('');
    lines.push(`**Retrieved hits (top-${args.k}):**`);
    lines.push('');
    for (const h of hits) lines.push(formatHitSummary(h));
    lines.push('');
    lines.push('**Answer:**');
    lines.push('');
    lines.push(result.text);
    lines.push('');
    lines.push(`_Tokens: ${result.inputTokens} in / ${result.outputTokens} out — stop: ${result.stopReason}_`);
    lines.push('');
    lines.push('---');
    lines.push('');
  }

  writeFileSync(outputPath, lines.join('\n'));
  console.error(`Wrote ${outputPath}`);

  if (observability) {
    await observability.shutdown();
  }
}

main().catch((e) => {
  console.error('run failed:', e.message);
  process.exit(1);
});
