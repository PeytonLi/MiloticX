import type { StepResult, FailureCategory } from '../types.js';

const INTERACTIVE_MARKERS = [
  'password',
  'passphrase',
  'enter your',
  'press any key',
  'are you sure',
  '[y/n]',
  'y/n',
];

const SECRET_MARKERS = [
  '401',
  '403',
  'permission denied (publickey)',
  'invalid credentials',
  'authentication failed',
  'not authenticated',
  'insufficient scope',
  'access denied',
];

const MISSING_DEP_MARKERS = [
  'command not found',
  ': not found',
  'not recognized as an internal or external command',
  'no such file or directory',
  'is not a recognized',
  'cannot find module',
  'module not found',
  'enoent',
];

const OUTDATED_MARKERS = [
  'unknown option',
  'invalid option',
  'unrecognized option',
  'unrecognized argument',
  'no such option',
  'unexpected argument',
  'unknown flag',
  'deprecated',
];

function includesAny(haystack: string, markers: string[]): boolean {
  const lower = haystack.toLowerCase();
  return markers.some((m) => lower.includes(m));
}

export function classifyFailure(result: StepResult): FailureCategory {
  const output = `${result.stdout}\n${result.stderr}`;

  if (result.exitCode === 0) {
    return 'success';
  }

  if (result.timedOut) {
    return 'unknown';
  }

  if (includesAny(output, INTERACTIVE_MARKERS)) {
    return 'interactive-prompt';
  }

  if (includesAny(output, SECRET_MARKERS)) {
    return 'needs-secrets';
  }

  if (includesAny(output, MISSING_DEP_MARKERS)) {
    return 'missing-dependency';
  }

  if (includesAny(output, OUTDATED_MARKERS)) {
    return 'outdated-command';
  }

  return 'unknown';
}
