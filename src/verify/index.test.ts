import { describe, it, expect } from 'vitest';
import type { Step, StepResult } from '../types.js';
import { verify, type Executor } from './index.js';

const ok: StepResult = { exitCode: 0, stdout: 'ok', stderr: '', timedOut: false };
const missing: StepResult = {
  exitCode: 127,
  stdout: '',
  stderr: 'bash: foo: command not found',
  timedOut: false,
};

function fakeExecutor(results: StepResult[], order: Step[]): Executor {
  return {
    async run(step: Step): Promise<StepResult> {
      order.push(step);
      return results[order.length - 1] ?? ok;
    },
  };
}

describe('verify', () => {
  it('returns a Verification with the repo name', async () => {
    const order: Step[] = [];
    const v = await verify('# hi', fakeExecutor([], order), 'owner/repo');
    expect(v.repo).toBe('owner/repo');
  });

  it('produces one outcome per extracted step', async () => {
    const markdown = '```sh\nnpm install\nnpm test\n```';
    const order: Step[] = [];
    const v = await verify(markdown, fakeExecutor([], order), 'owner/repo');
    expect(v.outcomes).toHaveLength(2);
  });

  it('returns empty outcomes for empty markdown', async () => {
    const order: Step[] = [];
    const v = await verify('', fakeExecutor([], order), 'owner/repo');
    expect(v.outcomes).toHaveLength(0);
  });

  it('executes steps in document order', async () => {
    const markdown = '```sh\nnpm install\nnpm test\nnpm run build\n```';
    const order: Step[] = [];
    await verify(markdown, fakeExecutor([], order), 'owner/repo');
    expect(order.map((s) => s.content)).toEqual(['npm install', 'npm test', 'npm run build']);
  });

  it('attaches the classified category to each outcome', async () => {
    const markdown = '```sh\nnpm install\nfoo\n```';
    const order: Step[] = [];
    const v = await verify(markdown, fakeExecutor([ok, missing], order), 'owner/repo');
    expect(v.outcomes[0]?.category).toBe('success');
    expect(v.outcomes[1]?.category).toBe('missing-dependency');
  });

  it('copies the step result into each outcome', async () => {
    const markdown = '```sh\nnpm install\n```';
    const order: Step[] = [];
    const v = await verify(markdown, fakeExecutor([missing], order), 'owner/repo');
    expect(v.outcomes[0]?.result.exitCode).toBe(127);
    expect(v.outcomes[0]?.result.stderr).toContain('command not found');
  });

  it('records ISO timestamps with startedAt <= finishedAt', async () => {
    const order: Step[] = [];
    const v = await verify('```sh\nnpm install\n```', fakeExecutor([], order), 'owner/repo');
    expect(new Date(v.startedAt).getTime()).toBeLessThanOrEqual(new Date(v.finishedAt).getTime());
    expect(v.startedAt).toMatch(/\d{4}-\d{2}-\d{2}T/);
  });
});
