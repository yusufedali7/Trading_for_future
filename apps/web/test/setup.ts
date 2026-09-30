import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Vitest runs without globals, so Testing Library's auto-cleanup is not registered.
afterEach(() => cleanup());
