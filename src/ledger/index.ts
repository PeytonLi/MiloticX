import { createHash } from 'node:crypto';

function normalize(markdown: string): string {
  return markdown
    .split(/\r?\n/)
    .map((line) => line.trim())
    .map((line) => (line.startsWith('```') ? '```' : line))
    .filter((line) => line.length > 0)
    .join('\n');
}

export function fingerprint(markdown: string): string {
  const normalized = normalize(markdown);
  return createHash('sha256').update(normalized).digest('hex');
}

export function shouldReVerify(fingerprint: string, previous: string | null): boolean {
  return previous === null || fingerprint !== previous;
}
