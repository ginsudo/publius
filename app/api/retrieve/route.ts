import { queryIndex, type Hit } from '../../../data/eval/query.ts';

export const runtime = 'nodejs';

type RetrieveRequest = { question: string; k?: number };

type RetrieveResponse = { hits: Hit[] };

function errorResponse(status: number, error: string, code?: string): Response {
  return Response.json({ error, ...(code ? { code } : {}) }, { status });
}

export async function POST(request: Request): Promise<Response> {
  let body: RetrieveRequest;
  try {
    body = (await request.json()) as RetrieveRequest;
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
    return Response.json({ hits } satisfies RetrieveResponse);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('VOYAGE_API_KEY not set')) {
      return errorResponse(500, 'VOYAGE_API_KEY not set', 'missing_voyage_key');
    }
    return errorResponse(500, msg, 'unexpected_error');
  }
}
