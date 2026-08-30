import { TrueForge } from '@truefoundry/trueforge-sdk';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const BASE_URL = process.env.TRUEFORGE_BASE_URL ?? 'http://localhost:8790';
const TURN_TIMEOUT_SECONDS = Number(process.env.TURN_TIMEOUT_SECONDS ?? 1800);

const encoder = new TextEncoder();
const sse = (obj: unknown) => encoder.encode(`data: ${JSON.stringify(obj)}\n\n`);

export async function POST(req: Request) {
  let sessionId: unknown;
  let approvals: unknown;
  try {
    ({ sessionId, approvals } = await req.json());
  } catch {
    /* ignore malformed body */
  }

  if (typeof sessionId !== 'string' || !Array.isArray(approvals) || approvals.length === 0) {
    return Response.json({ error: 'sessionId and approvals[] are required' }, { status: 400 });
  }

  const client = new TrueForge({ baseUrl: BASE_URL, timeoutInSeconds: TURN_TIMEOUT_SECONDS });

  let stream;
  try {
    stream = await client.sessions.createTurnStream(sessionId, { input: approvals });
  } catch (err) {
    return Response.json({ error: `Failed to resume turn: ${String(err)}` }, { status: 502 });
  }

  const body = new ReadableStream({
    async start(controller) {
      controller.enqueue(sse({ type: 'session', sessionId }));
      try {
        for await (const { data: event } of stream.withMetadata()) {
          controller.enqueue(sse(event));
        }
      } catch (err) {
        controller.enqueue(sse({ type: 'error', message: String(err) }));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(body, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
