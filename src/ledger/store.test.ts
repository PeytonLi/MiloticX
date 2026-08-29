import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { createFileStore, createMemoryStore, reverify, type LedgerRecord } from './store.js';

function record(repo: string, fingerprint = 'fp-a'): LedgerRecord {
  return { repo, fingerprint, summary: '3 passed, 1 failed', verifiedAt: '2026-08-25T00:00:00.000Z' };
}

describe('createMemoryStore', () => {
  it('returns null for an unknown repo', () => {
    const store = createMemoryStore();
    expect(store.get('owner/x')).toBeNull();
  });

  it('stores and retrieves by repo', () => {
    const store = createMemoryStore();
    store.put(record('owner/x'));
    expect(store.get('owner/x')?.fingerprint).toBe('fp-a');
    expect(store.list()).toHaveLength(1);
  });

  it('overwrites an existing repo', () => {
    const store = createMemoryStore();
    store.put(record('owner/x', 'fp-a'));
    store.put(record('owner/x', 'fp-b'));
    expect(store.get('owner/x')?.fingerprint).toBe('fp-b');
    expect(store.list()).toHaveLength(1);
  });
});

describe('createFileStore', () => {
  let dir: string;
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('persists to disk and reloads', () => {
    dir = mkdtempSync(join(tmpdir(), 'rv-ledger-'));
    const path = join(dir, 'ledger.json');

    const store = createFileStore(path);
    store.put(record('owner/x'));

    const reloaded = createFileStore(path);
    expect(reloaded.get('owner/x')?.fingerprint).toBe('fp-a');
    expect(reloaded.list()).toHaveLength(1);
  });

  it('writes valid JSON', () => {
    const path = join(dir, 'ledger.json');
    const parsed = JSON.parse(readFileSync(path, 'utf8'));
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed[0].repo).toBe('owner/x');
  });

  it('handles a missing file gracefully', () => {
    const store = createFileStore(join(dir, 'does-not-exist.json'));
    expect(store.get('owner/x')).toBeNull();
    expect(store.list()).toHaveLength(0);
  });
});

describe('reverify', () => {
  it('returns true when there is no record', () => {
    expect(reverify(null, 'fp')).toBe(true);
  });

  it('returns true when the fingerprint differs', () => {
    expect(reverify(record('r', 'fp-old'), 'fp-new')).toBe(true);
  });

  it('returns false when the fingerprint matches', () => {
    expect(reverify(record('r', 'fp-same'), 'fp-same')).toBe(false);
  });
});
