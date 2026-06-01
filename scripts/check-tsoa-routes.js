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
 * src/service/generatedRoutes.ts via `npm run build-tsoa` and stages it
 * so the commit always includes routes in sync with their inputs —
 * the same fix-then-continue behaviour as `prettier --write`.
 */
const { spawnSync } = require('node:child_process');

const build = spawnSync('npm run --silent build-tsoa', {
  stdio: 'inherit',
  shell: true,
});
if (build.status !== 0) {
  process.exit(build.status ?? 1);
}

const add = spawnSync('git add src/service/generatedRoutes.ts', {
  stdio: 'inherit',
  shell: true,
});
process.exit(add.status ?? 0);
