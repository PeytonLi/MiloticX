import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { shouldReVerify } from './index.js';

export interface LedgerRecord {
  repo: string;
  fingerprint: string;
  summary: string;
  verifiedAt: string;
}

export interface LedgerStore {
  get(repo: string): LedgerRecord | null;
  put(record: LedgerRecord): void;
  list(): LedgerRecord[];
}

export function createMemoryStore(seed: LedgerRecord[] = []): LedgerStore {
  const records = new Map(seed.map((r) => [r.repo, r]));
  return {
    get: (repo) => records.get(repo) ?? null,
    put: (record) => {
      records.set(record.repo, record);
    },
    list: () => [...records.values()],
  };
}

export function createFileStore(path: string): LedgerStore {
  let records = load();

  function load(): Map<string, LedgerRecord> {
    if (!existsSync(path)) return new Map();
    const raw = readFileSync(path, 'utf8');
    const arr = JSON.parse(raw) as LedgerRecord[];
    return new Map(arr.map((r) => [r.repo, r]));
  }

  function persist(): void {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify([...records.values()], null, 2));
  }

  return {
    get: (repo) => records.get(repo) ?? null,
    put: (record) => {
      records.set(record.repo, record);
      persist();
    },
    list: () => [...records.values()],
  };
}

export function reverify(record: LedgerRecord | null, fingerprint: string): boolean {
  return shouldReVerify(fingerprint, record?.fingerprint ?? null);
}
