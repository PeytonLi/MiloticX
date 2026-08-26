import { describe, it, expect } from 'vitest';
import { verify } from '../verify/index.js';
import { createSandboxExecutor } from './index.js';
import { buildReport } from '../report/index.js';

const markdown = `# Demo

## Install

\`\`\`sh
node --version
nonexistent-command-xyz
\`\`\`
`;

describe('end-to-end verify with a real executor', () => {
  it('extracts, executes, classifies, and reports in one pass', async () => {
    const v = await verify(markdown, createSandboxExecutor(), 'owner/demo');
    expect(v.outcomes).toHaveLength(2);
    expect(v.outcomes[0]?.category).toBe('success');
    expect(v.outcomes[1]?.category).toBe('missing-dependency');
  });

  it('renders the result as a report', async () => {
    const v = await verify(markdown, createSandboxExecutor(), 'owner/demo');
    const report = buildReport(v);
    expect(report).toContain('owner/demo');
    expect(report).toContain('1 passed, 1 failed');
    expect(report).toContain('missing-dependency');
  });
});
