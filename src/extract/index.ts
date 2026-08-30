import type { Step } from '../types.js';

const NON_SHELL_LANGS = new Set([
  'js',
  'python',
  'json',
  'yaml',
  'css',
  'html',
  'diff',
]);

const COMMAND_PREFIX_RE =
  /^(?:npm|npx|yarn|pnpm|git|docker|pip3|pip|python|go|cargo|brew|apt|curl|wget|make|node|gh|bun|deno)\b/;

function isCommandText(text: string): boolean {
  const trimmed = text.trimStart();
  if (trimmed.startsWith('./')) return true;
  return COMMAND_PREFIX_RE.test(trimmed);
}

export function extractSteps(markdown: string): Step[] {
  const steps: Step[] = [];
  let nextId = 1;
  const lines = markdown.split(/\r?\n/);

  let inFence: { isShell: boolean; lang?: string } | null = null;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i] ?? '';
    const line = i + 1;

    if (inFence) {
      const trimmed = raw.trim();
      if (/^`{3,}/.test(trimmed)) {
        inFence = null;
        continue;
      }
      if (inFence.isShell) {
        const content = extractFenceCommand(raw);
        if (content !== undefined) {
          steps.push({ id: nextId++, kind: 'fence', lang: inFence.lang, content, line });
        }
      }
      continue;
    }

    const fence = parseFenceOpen(raw);
    if (fence) {
      const lang = fence.lang ? fence.lang.toLowerCase() : undefined;
      inFence = { isShell: isShellFence(lang), lang };
      continue;
    }

    for (const content of extractInlineCommands(raw)) {
      steps.push({ id: nextId++, kind: 'inline', content, line });
    }
  }

  return steps;
}

function parseFenceOpen(raw: string): { lang?: string } | null {
  const match = /^\s*(`{3,})(.*)$/.exec(raw);
  if (!match) return null;
  const rest = match[2]?.trim() ?? '';
  const lang = rest.split(/\s+/)[0] || undefined;
  return { lang };
}

function isShellFence(lang: string | undefined): boolean {
  if (lang === undefined) return true;
  return !NON_SHELL_LANGS.has(lang);
}

function extractFenceCommand(raw: string): string | undefined {
  let content = raw.trim();
  if (content === '') return undefined;

  if (content.startsWith('# ')) {
    const rest = content.slice(2).trim();
    if (rest === '') return undefined;
    return isCommandText(rest) ? rest : undefined;
  }
  if (content.startsWith('#')) return undefined;

  if (content.startsWith('$ ')) {
    content = content.slice(2).trim();
  }

  return content === '' ? undefined : content;
}

function extractInlineCommands(raw: string): string[] {
  const commands: string[] = [];
  const re = /`([^`]+)`/g;
  let match;
  while ((match = re.exec(raw)) !== null) {
    const text = match[1]?.trim() ?? '';
    if (text === '') continue;
    if (isCommandText(text)) commands.push(text);
  }
  return commands;
}
