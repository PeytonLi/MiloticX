import { describe, it, expect } from 'vitest';
import { readSse } from './sse';

function sseResponse(raw: string): Response {
  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(raw));
      controller.close();
    },
  });
  return new Response(body, { headers: { 'Content-Type': 'text/event-stream' } });
}

describe('readSse', () => {
  it('parses data lines into JSON objects', async () => {
    const response = sseResponse(
      'data: {"type":"session","sessionId":"s1"}\n\n' +
        'data: {"type":"turn.created","id":"1"}\n\n' +
        'data: {"type":"turn.done","id":"2"}\n\n',
    );
    const events: unknown[] = [];
    for await (const e of readSse(response)) events.push(e);
    expect(events).toEqual([
      { type: 'session', sessionId: 's1' },
      { type: 'turn.created', id: '1' },
      { type: 'turn.done', id: '2' },
    ]);
  });

  it('handles a payload split across multiple chunks', async () => {
    const full = 'data: {"type":"tool.response","content":"a long response"}\n\n';
    const mid = Math.floor(full.length / 2);
    const response = sseResponse(full.slice(0, mid)); // only first half in this stream
    // We need the rest to arrive; emulate by concatenating via a custom stream below.
    const body = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(full.slice(0, mid)));
        controller.enqueue(new TextEncoder().encode(full.slice(mid)));
        controller.close();
      },
    });
    const events: unknown[] = [];
    for await (const e of readSse(new Response(body))) events.push(e);
    expect(events).toHaveLength(1);
    expect((events[0] as any).type).toBe('tool.response');
  });

  it('ignores non-data lines and empty payloads', async () => {
    const response = sseResponse('event: ping\n\ndata: \n\ndata: {"type":"x"}\n\n');
    const events: unknown[] = [];
    for await (const e of readSse(response)) events.push(e);
    expect(events).toEqual([{ type: 'x' }]);
  });
});
