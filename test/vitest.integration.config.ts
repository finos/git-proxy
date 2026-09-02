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

import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const testDir = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  test: {
    dir: testDir,
    include: ['**/*.integration.test.ts'],
    testTimeout: 30000,
    hookTimeout: 10000,
    setupFiles: [fileURLToPath(new URL('./setup-integration.ts', import.meta.url))],
    pool: 'forks',
    fileParallelism: false,
    env: {
      NODE_ENV: 'test',
      RUN_MONGO_TESTS: 'true',
      CONFIG_FILE: fileURLToPath(new URL('./integration/proxy.config.json', import.meta.url)),
      GIT_PROXY_MONGO_CONNECTION_STRING: 'mongodb://localhost:27017/git-proxy-test',
    },
  },
});
