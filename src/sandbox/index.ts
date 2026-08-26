import { exec } from 'node:child_process';
import type { Step, StepResult } from '../types.js';
import type { Executor } from '../verify/index.js';

export interface SandboxOptions {
  timeoutMs?: number;
  maxOutputLines?: number;
  cwd?: string;
}

const DEFAULT_TIMEOUT_MS = 120_000;
const DEFAULT_MAX_LINES = 50;

function tailCap(output: string, maxLines: number): string {
  const lines = output.split(/\r?\n/).filter((l) => l.trim().length > 0);
  return lines.slice(-maxLines).join('\n');
}

export function runCommand(command: string, options: SandboxOptions = {}): Promise<StepResult> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxLines = options.maxOutputLines ?? DEFAULT_MAX_LINES;

  return new Promise((resolve) => {
    exec(
      command,
      { timeout: timeoutMs, maxBuffer: 10 * 1024 * 1024, cwd: options.cwd },
      (error, stdout, stderr) => {
        if (error) {
          resolve({
            exitCode: typeof error.code === 'number' ? error.code : null,
            stdout: tailCap(stdout ?? '', maxLines),
            stderr: tailCap(stderr ?? '', maxLines),
            timedOut: error.killed === true,
          });
          return;
        }
        resolve({
          exitCode: 0,
          stdout: tailCap(stdout, maxLines),
          stderr: tailCap(stderr, maxLines),
          timedOut: false,
        });
      },
    );
  });
}

export function createSandboxExecutor(options: SandboxOptions = {}): Executor {
  return {
    async run(step: Step): Promise<StepResult> {
      return runCommand(step.content, options);
    },
  };
}
