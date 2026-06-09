#!/usr/bin/env node

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

/*
 * Invoked by lint-staged when any TSOA input is staged. Regenerates
 * src/service/generatedRoutes.ts via `npm run build-tsoa` and the API
 * docs under website/docs/api/ via `npm run gen-swagger-doc`, then stages
 * both so the commit always includes routes and docs in sync with their
 * inputs — the same fix-then-continue behaviour as `prettier --write`.
 */
const { spawnSync } = require('node:child_process');

const run = (command) => {
  const result = spawnSync(command, { stdio: 'inherit', shell: true });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
};

run('npm run --silent build-tsoa');
run('git add src/service/generatedRoutes.ts');
run('npm run --silent gen-swagger-doc');
run('git add website/docs/api');
