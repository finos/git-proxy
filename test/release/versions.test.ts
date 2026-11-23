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
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const repoRoot = path.join(__dirname, '..', '..');
const script = path.join(repoRoot, 'scripts', 'release', 'versions.mjs');
const patchLockfile = path.join(
  repoRoot,
  '.github',
  'actions',
  'bump-versions',
  'patch-lockfile-version.js',
);
const CLI_PATH = 'packages/git-proxy-cli';
const ROOT_NAME = '@finos/git-proxy';

const run = (...args: string[]) =>
  spawnSync(process.execPath, [script, ...args], { encoding: 'utf8' });

const readJson = (file: string) => JSON.parse(fs.readFileSync(file, 'utf8'));

type Versions = {
  root: string;
  cli?: string;
  pin?: string;
  lockCliPin?: string;
};

describe('scripts/release/versions.mjs', () => {
  let dir: string;
  const files = () => ({
    root: path.join(dir, 'package.json'),
    cli: path.join(dir, CLI_PATH, 'package.json'),
    lock: path.join(dir, 'package-lock.json'),
  });

  // Copies the real manifests and rewrites their versions, so the fixture keeps
  // the same lockfile layout the release branches have.
  const writeFixture = ({ root, cli = root, pin = root, lockCliPin = pin }: Versions) => {
    const rootPkg = readJson(path.join(repoRoot, 'package.json'));
    const cliPkg = readJson(path.join(repoRoot, CLI_PATH, 'package.json'));
    const lock = readJson(path.join(repoRoot, 'package-lock.json'));

    rootPkg.version = root;
    cliPkg.version = cli;
    cliPkg.dependencies[ROOT_NAME] = pin;
    lock.version = root;
    lock.packages[''].version = root;
    lock.packages[CLI_PATH].version = cli;
    lock.packages[CLI_PATH].dependencies[ROOT_NAME] = lockCliPin;

    fs.mkdirSync(path.join(dir, CLI_PATH), { recursive: true });
    fs.writeFileSync(files().root, JSON.stringify(rootPkg, null, 2) + '\n');
    fs.writeFileSync(files().cli, JSON.stringify(cliPkg, null, 2) + '\n');
    fs.writeFileSync(files().lock, JSON.stringify(lock, null, 2) + '\n');
  };

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'git-proxy-release-'));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  describe('check', () => {
    it('passes on the repository as committed', () => {
      const result = run('check', repoRoot);
      expect(result.stderr).toBe('');
      expect(result.status).toBe(0);
    });

    it('fails when the CLI pin was left behind by a version bump', () => {
      writeFixture({ root: '2.2.1', pin: '2.2.0' });

      const result = run('check', dir);

      expect(result.status).toBe(1);
      expect(result.stderr).toContain(`${CLI_PATH} pin on ${ROOT_NAME} is 2.2.0, expected 2.2.1.`);
    });

    it('fails when the CLI version drifted from the root', () => {
      writeFixture({ root: '2.2.1', cli: '2.2.0' });

      const result = run('check', dir);

      expect(result.status).toBe(1);
      expect(result.stderr).toContain(`${CLI_PATH} version is 2.2.0, expected 2.2.1.`);
    });

    it('fails when only the lockfile pin is stale', () => {
      writeFixture({ root: '2.2.1', lockCliPin: '2.2.0' });

      const result = run('check', dir);

      expect(result.status).toBe(1);
      expect(result.stderr).toContain(
        `package-lock.json ${CLI_PATH} pin on ${ROOT_NAME} is 2.2.0, expected 2.2.1.`,
      );
    });
  });

  describe('after a bump by .github/actions/bump-versions', () => {
    // The action sets the manifest fields with `npm pkg set` and then patches
    // the lockfile with patch-lockfile-version.js. The manifest edits are
    // mirrored here so the test doesn't shell out to npm (npm.cmd on Windows).
    const bumpLikeTheAction = (version: string) => {
      const rootPkg = readJson(files().root);
      const cliPkg = readJson(files().cli);
      rootPkg.version = version;
      cliPkg.version = version;
      cliPkg.dependencies[ROOT_NAME] = version;
      fs.writeFileSync(files().root, JSON.stringify(rootPkg, null, 2) + '\n');
      fs.writeFileSync(files().cli, JSON.stringify(cliPkg, null, 2) + '\n');

      return spawnSync(process.execPath, [patchLockfile], {
        cwd: dir,
        encoding: 'utf8',
        env: { ...process.env, VERSION: version },
      });
    };

    it('passes the publish guard after a patch bump on a release branch', () => {
      writeFixture({ root: '2.2.0' });
      const lockBefore = readJson(files().lock);

      const result = bumpLikeTheAction('2.2.1');
      expect(result.stderr).toBe('');
      expect(result.status).toBe(0);

      // Only the four version fields move in the lockfile
      lockBefore.version = '2.2.1';
      lockBefore.packages[''].version = '2.2.1';
      lockBefore.packages[CLI_PATH].version = '2.2.1';
      lockBefore.packages[CLI_PATH].dependencies[ROOT_NAME] = '2.2.1';
      expect(readJson(files().lock)).toEqual(lockBefore);

      const guard = run('check', dir);
      expect(guard.stderr).toBe('');
      expect(guard.status).toBe(0);
    });

    it('passes the publish guard after a minor bump on main', () => {
      writeFixture({ root: '2.3.0' });

      expect(bumpLikeTheAction('2.4.0').status).toBe(0);

      expect(run('check', dir).status).toBe(0);
    });
  });

  describe('dist-tag', () => {
    it.each([
      ['a maintenance release on an older line', '2.1.1', '2.2.0', 'release-2.1'],
      ['a maintenance release on an older major', '1.19.5', '2.3.0', 'release-1.19'],
      ['a patch on the latest line', '2.3.1', '2.3.0', 'latest'],
      ['a new minor', '2.4.0', '2.3.0', 'latest'],
      ['a new major', '3.0.0', '2.3.0', 'latest'],
      ['a version that only sorts higher numerically', '2.10.0', '2.9.3', 'latest'],
      ['a first publish', '2.3.0', '0.0.0', 'latest'],
      ['a re-run after the root package became latest', '2.3.0', '2.3.0', 'latest'],
      ['a release candidate', '2.4.0-rc.1', '2.3.0', 'rc'],
      ['a release candidate on an older line', '2.1.0-rc.1', '2.3.0', 'rc'],
    ])('tags %s (%s with latest %s) as %s', (_label, version, latest, tag) => {
      const result = run('dist-tag', version, latest);
      expect(result.stderr).toBe('');
      expect(result.stdout.trim()).toBe(tag);
    });

    it('fails instead of guessing when the current latest is malformed', () => {
      const result = run('dist-tag', '2.3.1', 'not-a-version');

      expect(result.status).toBe(1);
      expect(result.stderr).toContain(
        "Current 'latest' 'not-a-version' isn't a plain X.Y.Z version.",
      );
    });
  });
});
