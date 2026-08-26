import { describe, it, expect } from 'vitest';
import { extractSteps } from './index.js';

describe('extractSteps', () => {
  it('returns an empty array for empty input', () => {
    expect(extractSteps('')).toEqual([]);
  });

  it('returns an empty array for whitespace-only input', () => {
    expect(extractSteps('   \n  \t\n ')).toEqual([]);
  });

  it('extracts a fenced code block with no language', () => {
    expect(extractSteps('```\necho hello\n```')).toEqual([
      { id: 1, kind: 'fence', lang: undefined, content: 'echo hello', line: 2 },
    ]);
  });

  it('lowercases and trims the language tag', () => {
    expect(extractSteps('```BASH\necho hello\n```')).toEqual([
      { id: 1, kind: 'fence', lang: 'bash', content: 'echo hello', line: 2 },
    ]);
  });

  it('skips empty lines, comments and shebangs inside a fence', () => {
    expect(extractSteps('```sh\n# comment\n#!/bin/bash\n\nnpm install\n```')).toEqual([
      { id: 1, kind: 'fence', lang: 'sh', content: 'npm install', line: 5 },
    ]);
  });

  it('strips $ and # prompt prefixes', () => {
    expect(extractSteps('```sh\n$ npm install\n# apt-get install\n```')).toEqual([
      { id: 1, kind: 'fence', lang: 'sh', content: 'npm install', line: 2 },
      { id: 2, kind: 'fence', lang: 'sh', content: 'apt-get install', line: 3 },
    ]);
  });

  it('extracts inline command spans', () => {
    expect(extractSteps('Run `npm install` first, then `npx tsc`.')).toEqual([
      { id: 1, kind: 'inline', content: 'npm install', line: 1 },
      { id: 2, kind: 'inline', content: 'npx tsc', line: 1 },
    ]);
  });

  it('ignores inline spans that are not commands', () => {
    expect(extractSteps('Use `the force` and `npm install`.')).toEqual([
      { id: 1, kind: 'inline', content: 'npm install', line: 1 },
    ]);
  });

  it('assigns sequential ids in document order', () => {
    const md = 'First `git clone x`\n```sh\nnpm install\n```\nThen `yarn test`.';
    expect(extractSteps(md)).toEqual([
      { id: 1, kind: 'inline', content: 'git clone x', line: 1 },
      { id: 2, kind: 'fence', lang: 'sh', content: 'npm install', line: 3 },
      { id: 3, kind: 'inline', content: 'yarn test', line: 5 },
    ]);
  });

  it('ignores non-shell fences', () => {
    const md = '```js\nconsole.log(1)\n```\n```sh\necho hi\n```';
    expect(extractSteps(md)).toEqual([
      { id: 1, kind: 'fence', lang: 'sh', content: 'echo hi', line: 5 },
    ]);
  });

  it('does not scan for inline commands inside non-shell fences', () => {
    expect(extractSteps('```js\n`npm install`\n```')).toEqual([]);
  });

  it('treats shell-like languages as commands', () => {
    expect(extractSteps('```console\n$ echo hi\n```')).toEqual([
      { id: 1, kind: 'fence', lang: 'console', content: 'echo hi', line: 2 },
    ]);
  });
});
