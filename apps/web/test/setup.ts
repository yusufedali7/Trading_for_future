import { afterEach } from 'vitest';
import { cleanup, configure } from '@testing-library/react';
import { LONG_WAIT_MS } from './helpers/wait';

// Vitest runs without globals, so Testing Library's auto-cleanup is not registered.
afterEach(() => cleanup());

// findBy* / waitFor from Testing Library get the same window as waitLong (see helpers/wait.ts).
configure({ asyncUtilTimeout: LONG_WAIT_MS });
