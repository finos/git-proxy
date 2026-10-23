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

const fs = require('fs');

const VERSION = process.env.VERSION;
const ROOT = '@finos/git-proxy';
const CLI_PATH = 'packages/git-proxy-cli';
const LOCK = 'package-lock.json';
const fail = (m) => {
  console.error('::error::' + m);
  process.exit(1);
};

const lock = JSON.parse(fs.readFileSync(LOCK, 'utf8'));
if (lock.lockfileVersion !== 3)
  fail('Expected lockfileVersion 3, got ' + lock.lockfileVersion + '.');

const rootEntry = lock.packages[''];
const cliEntry = lock.packages[CLI_PATH];
if (!rootEntry) fail('Lockfile has no root package entry.');
if (!cliEntry) fail('Lockfile has no "' + CLI_PATH + '" entry.');
if (!(lock.packages['node_modules/' + ROOT] || {}).link) {
  fail(
    'Lockfile is missing the workspace link entry for ' +
      ROOT +
      '. Something has already re-resolved the tree.',
  );
}
if (!cliEntry.dependencies || cliEntry.dependencies[ROOT] === undefined) {
  fail(CLI_PATH + ' no longer pins ' + ROOT + '; this workflow needs updating.');
}

lock.version = VERSION;
rootEntry.version = VERSION;
cliEntry.version = VERSION;
cliEntry.dependencies[ROOT] = VERSION;

fs.writeFileSync(LOCK, JSON.stringify(lock, null, 2) + '\n');
console.log('Patched ' + LOCK + ' to ' + VERSION + '.');
