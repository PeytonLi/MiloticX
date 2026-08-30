import type { FailureCategory, Verification } from '../types.js';
import { buildReport } from './index.js';

export interface FlatOutcome {
  command: string;
  category: string;
  exit_code: number | null;
  stderr?: string;
  fix_diff?: string;
}

const VALID_CATEGORIES: FailureCategory[] = [
  'success',
  'missing-dependency',
  'outdated-command',
  'interactive-prompt',
  'needs-secrets',
  'docs-drift',
  'unknown',
];

export function coerceCategory(category: string): FailureCategory {
  return VALID_CATEGORIES.includes(category as FailureCategory) ? (category as FailureCategory) : 'unknown';
}

export function buildReportFromFlat(repo: string, outcomes: FlatOutcome[]): string {
  const now = new Date().toISOString();
  const verification: Verification = {
    repo,
    outcomes: outcomes.map((o, i) => ({
      step: { id: i + 1, kind: 'fence', content: o.command, line: i + 1 },
      result: { exitCode: o.exit_code, stdout: '', stderr: o.stderr ?? '', timedOut: false },
      category: coerceCategory(o.category),
      fixDiff: o.fix_diff,
    })),
    startedAt: now,
    finishedAt: now,
  };
  return buildReport(verification);
}
