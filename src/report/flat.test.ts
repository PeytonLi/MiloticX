import { describe, expect, it } from 'vitest';
import { buildReportFromFlat, coerceCategory } from './flat.js';

describe('coerceCategory', () => {
  it('accepts valid categories', () => {
    expect(coerceCategory('missing-dependency')).toBe('missing-dependency');
    expect(coerceCategory('success')).toBe('success');
    expect(coerceCategory('docs-drift')).toBe('docs-drift');
  });

  it('maps unknown categories to unknown', () => {
    expect(coerceCategory('bogus')).toBe('unknown');
    expect(coerceCategory('')).toBe('unknown');
  });
});

describe('buildReportFromFlat', () => {
  it('renders a report from flat outcomes', () => {
    const report = buildReportFromFlat('owner/demo', [
      { command: 'node --version', category: 'success', exit_code: 0 },
      { command: 'npm --versoin', category: 'outdated-command', exit_code: 2, stderr: 'Unknown option' },
    ]);
    expect(report).toContain('owner/demo');
    expect(report).toContain('1 passed, 1 failed');
    expect(report).toContain('node --version');
    expect(report).toContain('outdated-command');
  });

  it('handles empty outcomes', () => {
    const report = buildReportFromFlat('owner/demo', []);
    expect(report).toContain('0 passed, 0 failed');
  });

  it('includes a suggested fix when fix_diff is present', () => {
    const report = buildReportFromFlat('owner/demo', [
      { command: 'npm --versoin', category: 'outdated-command', exit_code: 2, fix_diff: '-npm --versoin\n+npm --version' },
    ]);
    expect(report).toContain('Suggested fixes');
    expect(report).toContain('npm --version');
  });
});
