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

import { spawnSync } from 'node:child_process';
import { rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

import { buildSamples, createSampleApp, createStandaloneDir } from './samplePackageHarness';

const documentedSpecifier = '@finos/git-proxy-plugin-samples/customSecretScanner';

describe('customSecretScanner sample package', () => {
  let appDir: string;
  let standaloneDir: string;

  beforeAll(() => {
    buildSamples();

    let gitProxyBuild: string;
    ({ appDir, gitProxyBuild } = createSampleApp('git-proxy-scanner-', ['parse-diff']));

    writeFileSync(
      join(appDir, 'load.mjs'),
      `
import { PluginLoader } from '@finos/git-proxy/plugin';

const loader = new PluginLoader(['${documentedSpecifier}']);
await loader.load();
const plugin = loader.pushPlugins[0];
if (loader.pushPlugins.length !== 1 || plugin?.constructor?.name !== 'CustomSecretScanner') {
  console.error('scanner was not loaded', loader.pushPlugins.map((item) => item.constructor.name));
  process.exit(1);
}
if (plugin.phase !== 'AFTER_DIFF') {
  console.error('unexpected phase', plugin.phase);
  process.exit(1);
}
console.log('loaded');
`,
    );

    standaloneDir = createStandaloneDir(
      'git-proxy-scanner-ts-',
      ['customSecretScanner.ts'],
      gitProxyBuild,
      ['parse-diff'],
    );
  }, 30000);

  afterAll(() => {
    if (appDir) rmSync(appDir, { recursive: true, force: true });
    if (standaloneDir) rmSync(standaloneDir, { recursive: true, force: true });
  });

  it('loads the documented package specifier through the production plugin loader', () => {
    const result = spawnSync(process.execPath, ['load.mjs'], {
      cwd: appDir,
      encoding: 'utf8',
    });
    expect(result.status, result.stderr || result.stdout).toBe(0);
    expect(result.stdout).toContain('loaded');
  });

  it('loads the standalone TypeScript source under plain Node outside node_modules', () => {
    const result = spawnSync(process.execPath, ['customSecretScanner.ts'], {
      cwd: standaloneDir,
      encoding: 'utf8',
    });
    expect(result.status, result.stderr || result.stdout).toBe(0);
  });
});
