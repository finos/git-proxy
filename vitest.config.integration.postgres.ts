/**
 * Copyright 2026 GitProxy Contributors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/db/postgres/**/*.integration.test.ts'],
    testTimeout: 30000,
    hookTimeout: 10000,
    setupFiles: ['test/setup-integration-postgres.ts'],
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    env: {
      NODE_ENV: 'test',
      RUN_POSTGRES_TESTS: 'true',
      CONFIG_FILE: path.resolve(__dirname, 'test-integration.postgres.proxy.config.json'),
      // Default for local runs; an exported GIT_PROXY_POSTGRES_CONNECTION_STRING
      // (e.g. in CI or a non-default local setup) takes precedence.
      GIT_PROXY_POSTGRES_CONNECTION_STRING:
        process.env.GIT_PROXY_POSTGRES_CONNECTION_STRING ||
        'postgresql://postgres:postgres@localhost:5432/git_proxy_test',
    },
  },
});
