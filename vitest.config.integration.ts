import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.integration.test.ts'],
    testTimeout: 30000,
    hookTimeout: 10000,
    setupFiles: ['test/setup-integration.ts'],
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    env: {
      NODE_ENV: 'test',
      RUN_MONGO_TESTS: 'true',
      CONFIG_FILE: path.resolve(__dirname, 'test-integration.proxy.config.json'),
      GIT_PROXY_MONGO_CONNECTION_STRING: 'mongodb://localhost:27017/git-proxy-test',
    },
  },
});
