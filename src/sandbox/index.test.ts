import { describe, it, expect } from 'vitest';
import { runCommand, createSandboxExecutor } from './index.js';

describe('runCommand', () => {
  it('captures exit code 0 and stdout', async () => {
    const r = await runCommand('node --version');
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toMatch(/v\d+\.\d+\.\d+/);
    expect(r.timedOut).toBe(false);
  });

  it('captures a non-zero exit code and stderr', async () => {
    const r = await runCommand('node --bad-flag');
    expect(r.exitCode).not.toBe(0);
    expect(r.stderr.length).toBeGreaterThan(0);
  });

  it('tail-caps stdout to the last N non-empty lines', async () => {
    const r = await runCommand('node -e "for(let i=0;i<10;i++) console.log(i)"', { maxOutputLines: 3 });
    expect(r.stdout.trim().split(/\r?\n/)).toEqual(['7', '8', '9']);
  });

  it('marks a slow command as timed out with a null exit code', async () => {
    const r = await runCommand('node -e "setTimeout(()=>{},5000)"', { timeoutMs: 200 });
    expect(r.timedOut).toBe(true);
    expect(r.exitCode).toBeNull();
  });
});

describe('createSandboxExecutor', () => {
  it('runs step.content as a shell command', async () => {
    const ex = createSandboxExecutor();
    const r = await ex.run({ id: 1, kind: 'fence', content: 'node --version', line: 1 });
    expect(r.exitCode).toBe(0);
  });
});
