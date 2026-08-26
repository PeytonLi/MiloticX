import { describe, it, expect } from 'vitest';
import { buildReport } from './index.js';
import type { Verification, StepOutcome } from '../types.js';

function makeOutcome(overrides: Partial<StepOutcome> = {}): StepOutcome {
  return {
    step: { id: 1, kind: 'fence', lang: 'sh', content: 'npm install', line: 3 },
    result: { exitCode: 0, stdout: '', stderr: '', timedOut: false },
    category: 'success',
    ...overrides,
  };
}

function makeVerification(outcomes: StepOutcome[]): Verification {
  return {
    repo: 'acme/widget',
    outcomes,
    startedAt: '2026-08-24T00:00:00Z',
    finishedAt: '2026-08-24T00:00:01Z',
  };
}

describe('buildReport', () => {
  it('returns a non-empty string containing the repo name', () => {
    const verification: Verification = {
      repo: 'acme/widget',
      outcomes: [],
      startedAt: '2026-08-24T00:00:00Z',
      finishedAt: '2026-08-24T00:00:01Z',
    };
    const report = buildReport(verification);
    expect(report.length).toBeGreaterThan(0);
    expect(report).toContain('acme/widget');
  });

  it('emits a status table with one row per outcome and required columns', () => {
    const verification = makeVerification([
      makeOutcome({ step: { id: 1, kind: 'fence', lang: 'sh', content: 'npm install', line: 3 }, result: { exitCode: 0, stdout: '', stderr: '', timedOut: false }, category: 'success' }),
      makeOutcome({ step: { id: 2, kind: 'fence', lang: 'sh', content: 'npm run build', line: 5 }, result: { exitCode: 1, stdout: '', stderr: 'boom', timedOut: false }, category: 'outdated-command' }),
    ]);
    const report = buildReport(verification);

    expect(report).toContain('| Step | Command | Category | Exit code |');
    expect(report).toContain('| 1 | `npm install` | success | 0 |');
    expect(report).toContain('| 2 | `npm run build` | outdated-command | 1 |');
  });

  it('renders a null exit code as a dash', () => {
    const verification = makeVerification([
      makeOutcome({ result: { exitCode: null, stdout: '', stderr: '', timedOut: false }, category: 'unknown' }),
    ]);
    const report = buildReport(verification);
    expect(report).toContain('| 1 | `npm install` | unknown | - |');
  });

  it('emits a summary line with pass and total counts', () => {
    const verification = makeVerification([
      makeOutcome({ step: { id: 1, kind: 'fence', lang: 'sh', content: 'a', line: 1 }, category: 'success' }),
      makeOutcome({ step: { id: 2, kind: 'fence', lang: 'sh', content: 'b', line: 2 }, category: 'success' }),
      makeOutcome({ step: { id: 3, kind: 'fence', lang: 'sh', content: 'c', line: 3 }, category: 'success' }),
      makeOutcome({ step: { id: 4, kind: 'fence', lang: 'sh', content: 'd', line: 4 }, category: 'missing-dependency' }),
    ]);
    const report = buildReport(verification);
    expect(report).toContain('3 passed, 1 failed');
  });

  it('includes a Failures section with each failing command and the tail of its stderr', () => {
    const stderr = 'alpha\nbeta\ngamma\ndelta\nepsilon\nzeta\neta\ntheta\niota\nkappa\nlambda\nmu';
    const verification = makeVerification([
      makeOutcome({ step: { id: 1, kind: 'fence', lang: 'sh', content: 'npm run build', line: 5 }, category: 'outdated-command', result: { exitCode: 1, stdout: '', stderr, timedOut: false } }),
    ]);
    const report = buildReport(verification);
    expect(report).toContain('## Failures');
    expect(report).toContain('npm run build');
    expect(report).toContain('mu');
    expect(report).not.toContain('alpha');
    expect(report).not.toContain('beta');
  });

  it('renders a Suggested fixes section with a diff block when a fixDiff is present', () => {
    const verification = makeVerification([
      makeOutcome({ step: { id: 1, kind: 'fence', lang: 'sh', content: 'npm run build', line: 5 }, category: 'outdated-command', result: { exitCode: 1, stdout: '', stderr: 'err', timedOut: false }, fixDiff: '-npm run build\n+npm run compile' }),
    ]);
    const report = buildReport(verification);
    expect(report).toContain('## Suggested fixes');
    expect(report).toContain('```diff');
    expect(report).toContain('+npm run compile');
    expect(report).toContain('npm run build');
  });

  it('omits the Suggested fixes section when no outcome has a fixDiff', () => {
    const verification = makeVerification([
      makeOutcome({ step: { id: 1, kind: 'fence', lang: 'sh', content: 'npm run build', line: 5 }, category: 'outdated-command', result: { exitCode: 1, stdout: '', stderr: 'err', timedOut: false } }),
    ]);
    const report = buildReport(verification);
    expect(report).not.toContain('## Suggested fixes');
  });

  it('flags interactive-prompt and needs-secrets outcomes as requiring human', () => {
    const verification = makeVerification([
      makeOutcome({ step: { id: 1, kind: 'fence', lang: 'sh', content: 'npm init', line: 1 }, category: 'interactive-prompt', result: { exitCode: null, stdout: '', stderr: '', timedOut: false } }),
      makeOutcome({ step: { id: 2, kind: 'fence', lang: 'sh', content: 'npm login', line: 2 }, category: 'needs-secrets', result: { exitCode: null, stdout: '', stderr: '', timedOut: false } }),
    ]);
    const report = buildReport(verification);
    expect(report).toContain('| 1 | `npm init` | interactive-prompt (requires human) |');
    expect(report).toContain('| 2 | `npm login` | needs-secrets (requires human) |');
  });

  it('handles an empty outcomes array by reporting no steps were found', () => {
    const report = buildReport(makeVerification([]));
    expect(report).toContain('No steps were found');
    expect(report).toContain('0 passed, 0 failed');
  });

  it('produces byte-identical output for identical input', () => {
    const build = () =>
      makeVerification([
        makeOutcome({ step: { id: 1, kind: 'fence', lang: 'sh', content: 'npm install', line: 3 }, category: 'missing-dependency', result: { exitCode: 127, stdout: 'out', stderr: 'err1\nerr2', timedOut: false }, fixDiff: '-old\n+new' }),
        makeOutcome({ step: { id: 2, kind: 'fence', lang: 'sh', content: 'npm test', line: 4 }, category: 'success' }),
      ]);
    expect(buildReport(build())).toBe(buildReport(build()));
  });
});
