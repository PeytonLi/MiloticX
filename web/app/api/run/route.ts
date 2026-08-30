import { TrueForge } from '@truefoundry/trueforge-sdk';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const BASE_URL = process.env.TRUEFORGE_BASE_URL ?? 'http://localhost:8790';
const AGENT_NAME = process.env.TRUEFORGE_AGENT ?? 'readme-verifier';
const TURN_TIMEOUT_SECONDS = Number(process.env.TURN_TIMEOUT_SECONDS ?? 1800);

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

  const client = new TrueForge({ baseUrl: BASE_URL, timeoutInSeconds: TURN_TIMEOUT_SECONDS });

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

  const content = `Verify the README of the repository ${repo}. Follow the readme-verification skill: extract the setup steps, run each in the sandbox, classify failures, and produce a verification report with build_report. If anything failed with a clear README fix, CALL the GitHub write tools to apply the fix and open a pull request — do not ask for approval in chat and stop. Write tools are approval-gated; the UI will pause for Allow/Deny before anything public happens.`;

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
