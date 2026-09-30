import { describe, expect, it } from 'vitest';
import { ESLint } from 'eslint';
import { fileURLToPath } from 'node:url';

// The engine must be pure: no clock, randomness, DOM, network or Node APIs (CLAUDE.md).
// These tests prove the lint config actually enforces that for files under packages/engine/src.
const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));
const eslint = new ESLint({ cwd: repoRoot });
const engineFile = 'packages/engine/src/__lint_probe__.ts';

async function ruleIdsFor(code: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath: engineFile });
  return (result?.messages ?? []).map((m) => m.ruleId ?? 'fatal');
}

describe('engine purity lint rules', () => {
  it.each([
    ['Date.now()', 'export const t = Date.now();\n', 'no-restricted-properties'],
    ['argumentless new Date()', 'export const d = new Date();\n', 'no-restricted-syntax'],
    ['Math.random()', 'export const r = Math.random();\n', 'no-restricted-properties'],
    ['window', 'export const w = window;\n', 'no-restricted-globals'],
    ['document', 'export const d = document;\n', 'no-restricted-globals'],
    ['fetch', "export const f = fetch('x');\n", 'no-restricted-globals'],
    [
      'node imports',
      "import { readFileSync } from 'node:fs';\nexport { readFileSync };\n",
      'no-restricted-imports',
    ],
  ])('rejects %s', async (_label, code, rule) => {
    expect(await ruleIdsFor(code)).toContain(rule);
  });

  it('allows new Date(ms) with an explicit timestamp', async () => {
    expect(await ruleIdsFor('export const d = new Date(0);\n')).toEqual([]);
  });
});
