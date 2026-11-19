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

/**
 * Helpers for testing the git-proxy-plugin-samples package the way users consume it:
 * built and installed next to GitProxy, or copied as standalone TypeScript files.
 */

import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const repoRoot = join(__dirname, '../..');
export const samplesRoot = join(repoRoot, 'plugins/git-proxy-plugin-samples');

const linkType = process.platform === 'win32' ? 'junction' : 'dir';

/** Run the samples package build (`npm run build`), throwing on failure. */
export function buildSamples(): void {
  const build = spawnSync('npm', ['run', 'build'], {
    cwd: samplesRoot,
    encoding: 'utf8',
    shell: true,
  });
  if (build.status !== 0) {
    throw new Error(`sample build failed\n${build.stdout}\n${build.stderr}`);
  }
}

/**
 * Compile the public plugin API of GitProxy into `<appDir>/git-proxy`, laid out
 * like the published `@finos/git-proxy` package.
 * @param {string} appDir directory to compile into
 * @return {string} path of the compiled package
 */
export function compileGitProxyPluginApi(appDir: string): string {
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

/**
 * Link packages from the repository's node_modules into `<dir>/node_modules`.
 * @param {string} dir directory whose node_modules receives the links
 * @param {string[]} deps package names to link
 */
function linkRepoDependencies(dir: string, deps: string[]): void {
  for (const dep of deps) {
    const target = join(dir, 'node_modules', dep);
    mkdirSync(join(target, '..'), { recursive: true });
    symlinkSync(join(repoRoot, 'node_modules', dep), target, linkType);
  }
}

/**
 * Create a temp app with the built samples package and GitProxy installed in node_modules.
 * Call {@link buildSamples} first.
 * @param {string} prefix temp directory prefix
 * @param {string[]} deps runtime dependencies of the sample to link from the repository
 * @return {{appDir: string, gitProxyBuild: string}} the app directory and compiled GitProxy
 */
export function createSampleApp(
  prefix: string,
  deps: string[] = [],
): { appDir: string; gitProxyBuild: string } {
  const appDir = mkdtempSync(join(tmpdir(), prefix));
  const gitProxyBuild = compileGitProxyPluginApi(appDir);

  const packageDir = join(appDir, 'node_modules/@finos/git-proxy-plugin-samples');
  mkdirSync(packageDir, { recursive: true });
  cpSync(join(samplesRoot, 'package.json'), join(packageDir, 'package.json'));
  cpSync(join(samplesRoot, 'dist'), join(packageDir, 'dist'), { recursive: true });
  symlinkSync(gitProxyBuild, join(appDir, 'node_modules/@finos/git-proxy'), linkType);
  linkRepoDependencies(appDir, deps);
  return { appDir, gitProxyBuild };
}

/**
 * Create a temp directory holding sample TypeScript sources outside any package,
 * with GitProxy resolvable from node_modules.
 * @param {string} prefix temp directory prefix
 * @param {string[]} sources sample source files to copy
 * @param {string} gitProxyBuild compiled GitProxy from {@link compileGitProxyPluginApi}
 * @param {string[]} deps runtime dependencies of the sample to link from the repository
 * @return {string} the standalone directory
 */
export function createStandaloneDir(
  prefix: string,
  sources: string[],
  gitProxyBuild: string,
  deps: string[] = [],
): string {
  const standaloneDir = mkdtempSync(join(tmpdir(), prefix));
  for (const source of sources) {
    cpSync(join(samplesRoot, source), join(standaloneDir, source));
  }
  mkdirSync(join(standaloneDir, 'node_modules/@finos'), { recursive: true });
  symlinkSync(gitProxyBuild, join(standaloneDir, 'node_modules/@finos/git-proxy'), linkType);
  linkRepoDependencies(standaloneDir, deps);
  return standaloneDir;
}
