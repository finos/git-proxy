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
import { cpSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

const repoRoot = join(__dirname, '../..');
const samplesRoot = join(repoRoot, 'plugins/git-proxy-plugin-samples');
const documentedSpecifier = '@finos/git-proxy-plugin-samples/customSecretScanner';

const linkType = process.platform === 'win32' ? 'junction' : 'dir';

describe('customSecretScanner sample package', () => {
  let appDir: string;
  let standaloneDir: string;

  beforeAll(() => {
    const build = spawnSync('npm', ['run', 'build'], {
      cwd: samplesRoot,
      encoding: 'utf8',
      shell: true,
    });
    if (build.status !== 0) {
      throw new Error(`sample build failed\n${build.stdout}\n${build.stderr}`);
    }

    appDir = mkdtempSync(join(tmpdir(), 'git-proxy-scanner-'));
    const gitProxyBuild = compilePluginEntry(appDir);

    const packageDir = join(appDir, 'node_modules/@finos/git-proxy-plugin-samples');
    mkdirSync(packageDir, { recursive: true });
    cpSync(join(samplesRoot, 'package.json'), join(packageDir, 'package.json'));
    cpSync(join(samplesRoot, 'dist'), join(packageDir, 'dist'), { recursive: true });
    symlinkSync(gitProxyBuild, join(appDir, 'node_modules/@finos/git-proxy'), linkType);
    symlinkSync(
      join(repoRoot, 'node_modules/parse-diff'),
      join(appDir, 'node_modules/parse-diff'),
      linkType,
    );

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

    standaloneDir = mkdtempSync(join(tmpdir(), 'git-proxy-scanner-ts-'));
    cpSync(
      join(samplesRoot, 'customSecretScanner.ts'),
      join(standaloneDir, 'customSecretScanner.ts'),
    );
    mkdirSync(join(standaloneDir, 'node_modules/@finos'), { recursive: true });
    symlinkSync(gitProxyBuild, join(standaloneDir, 'node_modules/@finos/git-proxy'), linkType);
    symlinkSync(
      join(repoRoot, 'node_modules/parse-diff'),
      join(standaloneDir, 'node_modules/parse-diff'),
      linkType,
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

function compilePluginEntry(appDir: string): string {
  const outDir = join(appDir, 'git-proxy');
  const tsconfigPath = join(appDir, 'tsconfig.json');
  writeFileSync(
    tsconfigPath,
    JSON.stringify({
      compilerOptions: {
        target: 'ES6',
        lib: ['DOM', 'ESNext'],
        jsx: 'react-jsx',
        module: 'NodeNext',
        moduleResolution: 'NodeNext',
        strict: true,
        skipLibCheck: true,
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        resolveJsonModule: true,
        outDir,
        rootDir: repoRoot,
        declaration: false,
        types: ['node', 'react'],
        typeRoots: [join(repoRoot, 'node_modules/@types')],
      },
      files: [join(repoRoot, 'src/plugin.ts')],
    }),
  );

  const tsc = spawnSync(
    process.execPath,
    [join(repoRoot, 'node_modules/typescript/bin/tsc'), '-p', tsconfigPath],
    { cwd: repoRoot, encoding: 'utf8' },
  );
  if (tsc.status !== 0) {
    throw new Error(`plugin compile failed\n${tsc.stdout}\n${tsc.stderr}`);
  }

  writeFileSync(
    join(outDir, 'package.json'),
    JSON.stringify({
      name: '@finos/git-proxy',
      exports: {
        './plugin': './src/plugin.js',
        './proxy/actions': './src/proxy/actions/index.js',
      },
    }),
  );
  symlinkSync(join(repoRoot, 'node_modules'), join(outDir, 'node_modules'), linkType);
  return outDir;
}
