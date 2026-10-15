import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: ['packages/*', 'apps/*'],
    // The default (all cores but one) starts ~15 jsdom workers here; on a ~6 GB machine that
    // starves the app tests and makes their waits flaky. Half the cores is as fast and stable (D81).
    maxWorkers: '50%',
  },
});
