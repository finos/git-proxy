import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true, // Run all tests in a single process
      },
    },
    coverage: {
      provider: 'v8',
      reportsDirectory: './coverage',
      reporter: ['text', 'lcov'],
      exclude: [
        'dist',
        'src/ui',
        'src/contents',
        'src/config/generated',
        'website',
        'packages',
        'experimental',
      ],
      thresholds: {
        lines: 80,
      },
    },
  },
});
