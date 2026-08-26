import type { Step, StepResult, StepOutcome, Verification } from '../types.js';
import { extractSteps } from '../extract/index.js';
import { classifyFailure } from '../classify/index.js';

export interface Executor {
  run(step: Step): Promise<StepResult>;
}

export async function verify(
  markdown: string,
  executor: Executor,
  repo: string,
): Promise<Verification> {
  const startedAt = new Date().toISOString();
  const steps = extractSteps(markdown);

  const outcomes: StepOutcome[] = [];
  for (const step of steps) {
    const result = await executor.run(step);
    outcomes.push({
      step,
      result,
      category: classifyFailure(result),
    });
  }

  const finishedAt = new Date().toISOString();
  return { repo, outcomes, startedAt, finishedAt };
}
