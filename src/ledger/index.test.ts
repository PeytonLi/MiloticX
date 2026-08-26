import { describe, it, expect } from 'vitest';
import { fingerprint, shouldReVerify } from './index.js';

describe('fingerprint', () => {
  it('returns a 64-character lowercase hex string for empty input', () => {
    const fp = fingerprint('');
    expect(fp).toMatch(/^[0-9a-f]{64}$/);
  });

  it('returns a 64-character lowercase hex string for non-empty input', () => {
    expect(fingerprint('# README\n\nnpm install')).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is deterministic', () => {
    const input = 'npm install\nnpm test';
    expect(fingerprint(input)).toBe(fingerprint(input));
  });

  it('ignores trailing/leading line whitespace and blank lines', () => {
    const a = 'npm install\n\nnpm test';
    const b = '  npm install  \n\n\nnpm test  ';
    expect(fingerprint(a)).toBe(fingerprint(b));
  });

  it('ignores fence language tags', () => {
    const a = '```sh\nnpm install\n```';
    const b = '```\nnpm install\n```';
    expect(fingerprint(a)).toBe(fingerprint(b));
  });

  it('changes when actual content changes', () => {
    expect(fingerprint('npm install')).not.toBe(fingerprint('npm i'));
  });
});

describe('shouldReVerify', () => {
  it('returns true when there is no previous fingerprint', () => {
    expect(shouldReVerify(fingerprint('x'), null)).toBe(true);
  });

  it('returns true when the fingerprint differs', () => {
    expect(shouldReVerify(fingerprint('a'), fingerprint('b'))).toBe(true);
  });

  it('returns false when the fingerprint matches', () => {
    const fp = fingerprint('same');
    expect(shouldReVerify(fp, fp)).toBe(false);
  });
});
