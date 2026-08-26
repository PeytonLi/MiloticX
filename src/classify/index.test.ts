import { describe, it, expect } from 'vitest';
import { classifyFailure } from './index.js';

const base = { stdout: '', stderr: '', timedOut: false };

describe('classifyFailure', () => {
  it('returns success when exitCode is 0', () => {
    expect(classifyFailure({ ...base, exitCode: 0 })).toBe('success');
  });

  it('returns success even when stderr has warnings', () => {
    expect(
      classifyFailure({ exitCode: 0, stdout: '', stderr: 'deprecated: use --new', timedOut: false }),
    ).toBe('success');
  });

  it('returns unknown on timeout', () => {
    expect(classifyFailure({ exitCode: null, stdout: '', stderr: '', timedOut: true })).toBe('unknown');
  });

  it('classifies a password prompt as interactive-prompt', () => {
    expect(
      classifyFailure({ ...base, exitCode: 1, stderr: 'sudo: a password is required' }),
    ).toBe('interactive-prompt');
  });

  it('classifies a y/n confirmation as interactive-prompt', () => {
    expect(
      classifyFailure({ ...base, exitCode: 1, stdout: 'Proceed? [y/n]' }),
    ).toBe('interactive-prompt');
  });

  it('classifies auth failures as needs-secrets', () => {
    expect(
      classifyFailure({ ...base, exitCode: 1, stderr: 'remote: authentication failed' }),
    ).toBe('needs-secrets');
  });

  it('classifies HTTP 401 as needs-secrets', () => {
    expect(classifyFailure({ ...base, exitCode: 1, stderr: 'HTTP 401 Unauthorized' })).toBe('needs-secrets');
  });

  it('classifies command not found as missing-dependency', () => {
    expect(
      classifyFailure({ ...base, exitCode: 127, stderr: 'bash: pip: command not found' }),
    ).toBe('missing-dependency');
  });

  it('classifies ENOENT as missing-dependency', () => {
    expect(
      classifyFailure({ ...base, exitCode: 1, stderr: "Error: ENOENT: no such file or directory, open 'x'" }),
    ).toBe('missing-dependency');
  });

  it('classifies an unknown flag as outdated-command', () => {
    expect(
      classifyFailure({ ...base, exitCode: 2, stderr: 'error: unknown option --no-cache' }),
    ).toBe('outdated-command');
  });

  it('classifies unrecognized argument as outdated-command', () => {
    expect(
      classifyFailure({ ...base, exitCode: 2, stderr: 'npm: unrecognized argument' }),
    ).toBe('outdated-command');
  });

  it('classifies a password prompt ahead of a command-not-found in the same output', () => {
    expect(
      classifyFailure({
        exitCode: 1,
        stdout: '',
        stderr: 'sudo: a password is required\nbash: git: command not found',
        timedOut: false,
      }),
    ).toBe('interactive-prompt');
  });

  it('falls back to unknown for unrecognized non-zero results', () => {
    expect(classifyFailure({ ...base, exitCode: 1, stderr: 'something went wrong' })).toBe('unknown');
  });
});
