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

import { Action } from '../../proxy/actions';
import { Repo, User } from '../types';

/**
 * A read-only view over a backend (mongo or fs) that data is migrated *from*.
 * Implementations own their own connection and must be closed by the caller.
 */
export interface MigrationSource {
  getUsers(): Promise<User[]>;
  getRepos(): Promise<Repo[]>;
  getPushes(): Promise<Action[]>;
  close(): Promise<void>;
}

/**
 * The subset of the Postgres adapter used to write migrated records. The
 * adapter module satisfies this shape directly, so the CLI can pass it as-is.
 */
export interface MigrationDestination {
  findUser(username: string): Promise<User | null>;
  findUserByEmail(email: string): Promise<User | null>;
  createUser(user: User): Promise<void>;
  getRepoByUrl(url: string): Promise<Repo | null>;
  createRepo(repo: Repo): Promise<Repo>;
  writeAudit(action: Action): Promise<void>;
}

export interface MigrationSummary {
  users: { imported: number; skipped: number };
  repos: { imported: number; skipped: number };
  pushes: { imported: number };
}

export interface MigrateOptions {
  /** Receives human-readable progress lines. Defaults to a no-op. */
  log?: (message: string) => void;
}

/**
 * Copy users, repos and pushes from `source` into the Postgres `destination`.
 *
 * Idempotent and re-runnable: users and repos that already exist (matched by
 * username/email and URL respectively) are skipped, and pushes are upserted by
 * their stable string id. Record `_id`s are intentionally NOT carried over —
 * Postgres assigns fresh UUIDs; push ids (TEXT) are preserved by the upsert.
 */
export const migrate = async (
  source: MigrationSource,
  destination: MigrationDestination,
  options: MigrateOptions = {},
): Promise<MigrationSummary> => {
  const log = options.log ?? (() => undefined);
  const summary: MigrationSummary = {
    users: { imported: 0, skipped: 0 },
    repos: { imported: 0, skipped: 0 },
    pushes: { imported: 0 },
  };

  const users = await source.getUsers();
  log(`Migrating ${users.length} user(s)...`);
  for (const user of users) {
    const existing =
      (await destination.findUser(user.username)) ||
      (user.email ? await destination.findUserByEmail(user.email) : null);
    if (existing) {
      summary.users.skipped++;
      continue;
    }
    await destination.createUser(user);
    summary.users.imported++;
  }

  const repos = await source.getRepos();
  log(`Migrating ${repos.length} repo(s)...`);
  for (const repo of repos) {
    if (await destination.getRepoByUrl(repo.url)) {
      summary.repos.skipped++;
      continue;
    }
    await destination.createRepo(repo);
    summary.repos.imported++;
  }

  const pushes = await source.getPushes();
  log(`Migrating ${pushes.length} push(es)...`);
  for (const push of pushes) {
    await destination.writeAudit(push);
    summary.pushes.imported++;
  }

  return summary;
};
