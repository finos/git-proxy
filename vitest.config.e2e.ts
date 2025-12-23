import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'e2e',
    include: ['tests/e2e/**/*.test.{js,ts}'],
    testTimeout: 30000,
    hookTimeout: 10000,
    globals: true,
    environment: 'node',
    setupFiles: ['tests/e2e/setup.ts'],
  },
});
