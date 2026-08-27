import { TrueForge } from '@truefoundry/trueforge-sdk';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const BASE_URL = process.env.TRUEFORGE_BASE_URL ?? 'http://localhost:8790';
const AGENT_NAME = process.env.TRUEFORGE_AGENT ?? 'readme-verifier';

const encoder = new TextEncoder();
const sse = (obj: unknown) => encoder.encode(`data: ${JSON.stringify(obj)}\n\n`);

export async function POST(req: Request) {
  let repo: unknown;
  try {
    ({ repo } = await req.json());
  } catch {
    /* ignore malformed body */
  }

  if (typeof repo !== 'string' || repo.trim() === '') {
    return Response.json({ error: 'repo is required' }, { status: 400 });
  }

  const client = new TrueForge({ baseUrl: BASE_URL, timeoutInSeconds: 600 });

  let sessionId = '';
  try {
    const { data: session } = await client.sessions.create({ agent: { name: AGENT_NAME } });
    sessionId = session.id;
  } catch (err) {
    return Response.json(
      { error: `Failed to open session (is TrueForge running and the '${AGENT_NAME}' agent saved?): ${String(err)}` },
      { status: 502 },
    );
  }

  const content = `Verify the README of the repository ${repo}. Follow the readme-verification skill: extract the setup steps, run each in the sandbox, classify failures, and produce a verification report. Pause for approval before opening a pull request.`;

  let stream;
  try {
    stream = await client.sessions.createTurnStream(sessionId, {
      input: [{ type: 'user.message', content }],
    });
  } catch (err) {
    return Response.json({ error: `Failed to start turn: ${String(err)}` }, { status: 502 });
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
