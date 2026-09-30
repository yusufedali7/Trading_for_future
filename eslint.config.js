import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

export default tseslint.config(
  { ignores: ['**/node_modules/**', '**/dist/**', '**/coverage/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.es2022 } },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', destructuredArrayIgnorePattern: '^_' },
      ],
    },
  },
  {
    // Engine purity (CLAUDE.md): no clock, randomness, DOM, network or Node APIs.
    // Time is always passed in as a parameter.
    files: ['packages/engine/src/**/*.ts'],
    rules: {
      'no-restricted-properties': [
        'error',
        {
          object: 'Date',
          property: 'now',
          message: 'Engine must not read the clock; pass time in.',
        },
        {
          object: 'Math',
          property: 'random',
          message: 'Engine must be deterministic; use a seeded RNG.',
        },
        { object: 'performance', property: 'now', message: 'Engine must not read the clock.' },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: "NewExpression[callee.name='Date'][arguments.length=0]",
          message: 'Engine must not read the clock; use new Date(ms).',
        },
        {
          selector: "CallExpression[callee.name='Date']",
          message: 'Engine must not read the clock.',
        },
      ],
      'no-restricted-globals': [
        'error',
        ...[
          'window',
          'document',
          'navigator',
          'localStorage',
          'sessionStorage',
          'indexedDB',
          'fetch',
          'XMLHttpRequest',
          'WebSocket',
          'performance',
          'process',
          'crypto',
        ].map((name) => ({
          name,
          message: 'Engine is pure: no DOM, network, storage or host APIs.',
        })),
      ],
      'no-restricted-imports': [
        'error',
        { patterns: [{ group: ['node:*'], message: 'Engine must not depend on Node APIs.' }] },
      ],
    },
  },
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser } },
  },
  {
    files: ['**/test/**/*.{ts,tsx}', '*.config.{js,ts}', '**/*.config.{js,ts}'],
    languageOptions: { globals: { ...globals.node } },
  },
);
