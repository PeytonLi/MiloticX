import type { Verification } from '../types.js';

const TAIL_LINES = 10;
const REQUIRES_HUMAN = new Set(['interactive-prompt', 'needs-secrets']);

function tail(text: string, lineCount: number): string {
  const lines = text.split('\n');
  return lines.slice(-lineCount).join('\n');
}

function categoryLabel(category: string): string {
  return REQUIRES_HUMAN.has(category) ? `${category} (requires human)` : category;
}

export function buildReport(verification: Verification): string {
  const lines: string[] = [];
  lines.push(`# Verification Report: ${verification.repo}`);
  lines.push('');
  lines.push('| Step | Command | Category | Exit code |');
  lines.push('| --- | --- | --- | --- |');
  for (const outcome of verification.outcomes) {
    const exitCode = outcome.result.exitCode === null ? '-' : String(outcome.result.exitCode);
    lines.push(`| ${outcome.step.id} | \`${outcome.step.content}\` | ${categoryLabel(outcome.category)} | ${exitCode} |`);
  }
  lines.push('');
  const passed = verification.outcomes.filter((o) => o.category === 'success').length;
  const failed = verification.outcomes.length - passed;
  lines.push(`${passed} passed, ${failed} failed`);
  if (verification.outcomes.length === 0) {
    lines.push('');
    lines.push('No steps were found.');
  }

  const failures = verification.outcomes.filter((o) => o.category !== 'success');
  if (failures.length > 0) {
    lines.push('');
    lines.push('## Failures');
    for (const outcome of failures) {
      lines.push('');
      lines.push(`### \`${outcome.step.content}\``);
      lines.push('');
      lines.push('```text');
      lines.push(tail(outcome.result.stderr, TAIL_LINES));
      lines.push('```');
    }
  }

  const fixes = verification.outcomes.filter((o) => o.fixDiff !== undefined);
  if (fixes.length > 0) {
    lines.push('');
    lines.push('## Suggested fixes');
    for (const outcome of fixes) {
      lines.push('');
      lines.push(`### \`${outcome.step.content}\``);
      lines.push('');
      lines.push('```diff');
      lines.push(outcome.fixDiff ?? '');
      lines.push('```');
    }
  }

  return lines.join('\n');
}
