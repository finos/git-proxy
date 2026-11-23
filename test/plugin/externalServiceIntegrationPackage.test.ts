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

const documentedSpecifier = '@finos/git-proxy-plugin-samples/externalServiceIntegration';

describe('externalServiceIntegration sample package', () => {
  let appDir: string;
  let standaloneDir: string;

  beforeAll(() => {
    buildSamples();

    let gitProxyBuild: string;
    ({ appDir, gitProxyBuild } = createSampleApp('git-proxy-external-service-'));

    writeFileSync(
      join(appDir, 'load.mjs'),
      `
import { PluginLoader } from '@finos/git-proxy/plugin';

const loader = new PluginLoader(['${documentedSpecifier}']);
await loader.load();
const plugin = loader.pushPlugins[0];
if (loader.pushPlugins.length !== 1 || plugin?.constructor?.name !== 'ExternalServiceIntegration') {
  console.error('plugin was not loaded', loader.pushPlugins.map((item) => item.constructor.name));
  process.exit(1);
}
console.log(JSON.stringify({
  phase: plugin.phase,
  chains: plugin.chains,
  isCollectible: plugin.isCollectible,
  displayName: plugin.displayName,
}));
`,
    );

    // Runs the built plugin end to end against the mock DLP service, with randomness pinned
    // so both scans settle after the 2s minimum delay: the first approves, the second rejects.
    writeFileSync(
      join(appDir, 'exec.mjs'),
      `
const draws = [0, 0, 0, 0.9, 0, 0, 0];
Math.random = () => draws.shift() ?? 0;

const { default: plugin } = await import('${documentedSpecifier}');
const { Action } = await import('@finos/git-proxy/proxy/actions');

const req = { socket: { destroyed: false } };
const newAction = (id) => {
  const action = new Action(id, 'push', 'POST', Date.now(), 'https://example.com/org/repo.git');
  action.diff = 'diff --git a/file b/file\\n+change\\n';
  return action;
};

const [approved, rejected] = await Promise.all([
  plugin.exec(req, newAction('approved-push')),
  plugin.exec(req, newAction('rejected-push')),
]);
console.log(JSON.stringify({
  approved: { error: approved.error, logs: approved.steps.at(-1).logs },
  rejected: { error: rejected.error, errorMessage: rejected.steps.at(-1).errorMessage },
}));
`,
    );

    standaloneDir = createStandaloneDir(
      'git-proxy-external-service-ts-',
      ['externalServiceIntegration.ts', 'mockDlpService.ts'],
      gitProxyBuild,
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
    expect(JSON.parse(result.stdout.trim().split('\n').at(-1)!)).toEqual({
      phase: 'AFTER_DIFF',
      chains: ['branch'],
      isCollectible: true,
      displayName: 'ExternalServiceIntegration',
    });
  });

  it('runs the built plugin against the mock DLP service', () => {
    const result = spawnSync(process.execPath, ['exec.mjs'], {
      cwd: appDir,
      encoding: 'utf8',
      timeout: 20000,
    });
    expect(result.status, result.stderr || result.stdout).toBe(0);
    const outcome = JSON.parse(result.stdout.trim().split('\n').at(-1)!);

    expect(outcome.approved.error).toBe(false);
    expect(outcome.approved.logs.join('\n')).toMatch(/DLP scan approved push approved-push/);
    expect(outcome.rejected.error).toBe(true);
    expect(outcome.rejected.errorMessage).toMatch(
      /DLP scan blocked push rejected-push .*Contains sensitive data/,
    );
  });

  it('loads the standalone TypeScript sources under plain Node outside node_modules', () => {
    const result = spawnSync(process.execPath, ['externalServiceIntegration.ts'], {
      cwd: standaloneDir,
      encoding: 'utf8',
    });
    expect(result.status, result.stderr || result.stdout).toBe(0);
  });
});
