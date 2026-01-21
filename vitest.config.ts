import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globalSetup: './test/globalSetup.ts',
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
      include: ['src/**/*.ts'],
      exclude: [
        'dist',
        'experimental',
        'packages',
        'plugins',
        'scripts',
        'src/**/types.ts',
        'src/config/generated',
        'src/constants',
        'src/contents',
        'src/types',
        'src/ui',
        'website',
      ],
      thresholds: {
        lines: 80,
      },
    },
  },
});
