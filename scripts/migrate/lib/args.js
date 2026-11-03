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

const VALID_DB_TYPES = new Set(['mongo', 'fs']);

function getArgValue(flag, argv) {
  const idx = argv.indexOf(flag);
  if (idx === -1) return null;
  return argv[idx + 1] ?? null;
}

function normalizeDbType(value, sourceLabel) {
  const v = (value || '').toString().trim().toLowerCase();
  if (!VALID_DB_TYPES.has(v)) {
    throw new Error(`Invalid ${sourceLabel}: "${value}". Use mongo or fs.`);
  }
  return v;
}

/**
 * Resolve database backend. Priority: --dbType → DB_TYPE env → mongo (default).
 * @param {string[]} [argv]
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {'mongo'|'fs'}
 */
function getDbType(argv = [], env = {}) {
  const fromCli = getArgValue('--dbType', argv);
  if (fromCli) {
    return normalizeDbType(fromCli, '--dbType');
  }

  const fromEnv = (env.DB_TYPE || '').trim();
  if (fromEnv) {
    return normalizeDbType(fromEnv, 'DB_TYPE');
  }

  return 'mongo';
}

/**
 * @param {string[]} [argv]
 * @param {NodeJS.ProcessEnv} [env]
 * @param {{ mongoUri?: string, dbName?: string, usersDbPath?: string, reposDbPath?: string }} [defaults]
 */
function parseMigrationArgs(argv = [], env = {}, defaults = {}) {
  const dbType = getDbType(argv, env);

  return {
    dbType,
    mongoUri: getArgValue('--mongoUri', argv) ?? env.MONGO_URI ?? defaults.mongoUri ?? null,
    dbName: getArgValue('--dbName', argv) ?? env.DB_NAME ?? defaults.dbName ?? null,
    usersDbPath:
      getArgValue('--usersDbPath', argv) ?? env.USERS_DB_PATH ?? defaults.usersDbPath ?? null,
    reposDbPath:
      getArgValue('--reposDbPath', argv) ?? env.REPOS_DB_PATH ?? defaults.reposDbPath ?? null,
  };
}

module.exports = {
  getArgValue,
  getDbType,
  parseMigrationArgs,
};
