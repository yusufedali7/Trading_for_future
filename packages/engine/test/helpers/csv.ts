import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** Loads a fixture as rows. '#' lines are fixture labels; real splitting is done by papaparse in the app. */
export function fixtureRows(name: string, delimiter = ','): string[][] {
  if (!name.startsWith('SYNTHETIC_')) throw new Error('Fixtures must be labelled SYNTHETIC_');
  const path = fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url));
  return readFileSync(path, 'utf8')
    .split('\n')
    .filter((line) => !line.startsWith('#'))
    .map((line) => (line === '' ? [''] : line.split(delimiter)));
}
