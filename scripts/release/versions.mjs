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
 * Keeps @finos/git-proxy and @finos/git-proxy-cli released in lockstep.
 * 
 * Usage:
 *   node scripts/release/versions.mjs check [dir]
 *     Fails unless the CLI version, the CLI's @finos/git-proxy pin and the
 *     matching package-lock.json entries all equal the root version.
 *   node scripts/release/versions.mjs bump <version> [dir]
 *     Sets all of the above to <version>.
 *   node scripts/release/versions.mjs dist-tag <version> <current-latest>
 *     Prints the npm dist-tag to publish <version> under.
 */

import fs from 'node:fs';
import path from 'node:path';

const ROOT_NAME = '@finos/git-proxy';
const CLI_PATH = 'packages/git-proxy-cli';
const SEMVER = /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?(\+[0-9A-Za-z.-]+)?$/;
const STABLE = /^(\d+)\.(\d+)\.(\d+)$/;

class ReleaseError extends Error {}

const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const writeJson = (file, data) => fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');

function load(dir) {
  const files = {
    root: path.join(dir, 'package.json'),
    cli: path.join(dir, CLI_PATH, 'package.json'),
    lock: path.join(dir, 'package-lock.json'),
  };
  const root = readJson(files.root);
  const cli = readJson(files.cli);
  const lock = readJson(files.lock);

  if (lock.lockfileVersion !== 3) {
    throw new ReleaseError(`Expected lockfileVersion 3, got ${lock.lockfileVersion}.`);
  }
  const lockRoot = lock.packages?.[''];
  const lockCli = lock.packages?.[CLI_PATH];
  if (!lockRoot) throw new ReleaseError('package-lock.json has no root package entry.');
  if (!lockCli) throw new ReleaseError(`package-lock.json has no "${CLI_PATH}" entry.`);
  if (!lock.packages[`node_modules/${ROOT_NAME}`]?.link) {
    throw new ReleaseError(
      `package-lock.json resolves ${ROOT_NAME} from the registry instead of linking the root package.`,
    );
  }
  if (cli.dependencies?.[ROOT_NAME] === undefined) {
    throw new ReleaseError(`${CLI_PATH} no longer depends on ${ROOT_NAME}; update this script.`);
  }

  return { files, root, cli, lock, lockRoot, lockCli };
}

function check(dir) {
  const { root, cli, lock, lockRoot, lockCli } = load(dir);
  const expected = root.version;
  const problems = [];
  const expect = (label, actual) => {
    if (actual !== expected) problems.push(`${label} is ${actual}, expected ${expected}.`);
  };

  expect(`${CLI_PATH} version`, cli.version);
  expect(`${CLI_PATH} pin on ${ROOT_NAME}`, cli.dependencies[ROOT_NAME]);
  expect('package-lock.json version', lock.version);
  expect('package-lock.json root package version', lockRoot.version);
  expect(`package-lock.json ${CLI_PATH} version`, lockCli.version);
  expect(`package-lock.json ${CLI_PATH} pin on ${ROOT_NAME}`, lockCli.dependencies?.[ROOT_NAME]);

  return { expected, problems };
}

function bump(dir, version) {
  if (!SEMVER.test(version ?? '')) {
    throw new ReleaseError(`'${version}' isn't a plain semver version (for example '2.2.1').`);
  }
  const { files, root, cli, lock, lockRoot, lockCli } = load(dir);

  root.version = version;
  cli.version = version;
  cli.dependencies[ROOT_NAME] = version;
  lock.version = version;
  lockRoot.version = version;
  lockCli.version = version;
  lockCli.dependencies = { ...lockCli.dependencies, [ROOT_NAME]: version };

  writeJson(files.root, root);
  writeJson(files.cli, cli);
  writeJson(files.lock, lock);
}

function parseStable(version, label) {
  const match = STABLE.exec(version ?? '');
  if (!match) throw new ReleaseError(`${label} '${version}' isn't a plain X.Y.Z version.`);
  return match.slice(1).map(Number);
}

function distTag(version, currentLatest) {
  if (!SEMVER.test(version ?? '')) {
    throw new ReleaseError(`'${version}' isn't a semver version.`);
  }
  if (version.includes('-')) return 'rc';

  const next = parseStable(version, 'Version');
  const latest = parseStable(currentLatest, "Current 'latest'");
  const diff = next.map((part, i) => part - latest[i]).find((d) => d !== 0) ?? 0;
  if (diff > 0) return 'latest';

  // Maintenance release on an older line, so it mustn't take over 'latest'
  return `release-${next[0]}.${next[1]}`;
}

const USAGE = `Usage:
  versions.mjs check [dir]
  versions.mjs bump <version> [dir]
  versions.mjs dist-tag <version> <current-latest>`;

function main([command, ...args]) {
  switch (command) {
    case 'check': {
      const { expected, problems } = check(args[0] ?? '.');
      if (problems.length > 0) {
        for (const problem of problems) console.error(`::error::${problem}`);
        return 1;
      }
      console.log(`${ROOT_NAME} and ${CLI_PATH} are in lockstep at ${expected}.`);
      return 0;
    }
    case 'bump':
      bump(args[1] ?? '.', args[0]);
      console.log(`Bumped ${ROOT_NAME} and ${CLI_PATH} to ${args[0]}.`);
      return 0;
    case 'dist-tag':
      console.log(distTag(args[0], args[1]));
      return 0;
    default:
      console.error(USAGE);
      return 2;
  }
}

try {
  process.exitCode = main(process.argv.slice(2));
} catch (err) {
  if (!(err instanceof ReleaseError)) throw err;
  console.error(`::error::${err.message}`);
  process.exitCode = 1;
}
