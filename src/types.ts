export interface Step {
  id: number;
  kind: 'fence' | 'inline' | 'text';
  lang?: string;
  content: string;
  line: number;
}

export interface StepResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
}

export type FailureCategory =
  | 'success'
  | 'missing-dependency'
  | 'outdated-command'
  | 'interactive-prompt'
  | 'needs-secrets'
  | 'docs-drift'
  | 'unknown';

export interface StepOutcome {
  step: Step;
  result: StepResult;
  category: FailureCategory;
  fixDiff?: string;
  note?: string;
}

export interface Verification {
  repo: string;
  outcomes: StepOutcome[];
  startedAt: string;
  finishedAt: string;
}
