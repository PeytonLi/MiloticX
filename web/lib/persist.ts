export interface Snapshot {
  sessionId: string | null;
  repo: string;
  report: string | null;
  order: string[];
  events: [string, unknown][];
}

export const STORAGE_KEY = 'readme-verifier:snapshot';

export function serializeSnapshot(snapshot: Snapshot): string {
  return JSON.stringify(snapshot);
}

export function parseSnapshot(raw: string | null): Snapshot | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Snapshot;
    if (!Array.isArray(parsed.order) || !Array.isArray(parsed.events)) return null;
    return parsed;
  } catch {
    return null;
  }
}
