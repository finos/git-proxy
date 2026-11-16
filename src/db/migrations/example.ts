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

// Template for a real migration. Copy this file, give it a timestamped id, and
// add it to registry.ts to make it run. It is intentionally NOT registered.
//
// It shows the pattern: read through the sink, use a backend capability
// (deriveCreatedAt) that each backend answers as best it can, write through the
// sink. Backfilling dateCreated/lastModified on repos is the worked example.

import type { Repo } from '../types';
import type { Migration } from './index';

export const exampleMigration: Migration = {
  id: '20260728-example-add-repo-timestamps',

  up: async (sink) => {
    const repos = await sink.getRepos();
    for (const repo of repos) {
      const record = repo as unknown as Record<string, unknown>;
      if (record.dateCreated || !repo._id) {
        continue;
      }
      const created = sink.deriveCreatedAt(repo._id) ?? new Date().toISOString();
      // cast: dateCreated/lastModified are new fields not yet on the Repo type
      await sink.updateRepo({
        _id: repo._id,
        dateCreated: created,
        lastModified: created,
      } as Partial<Repo>);
    }
  },

  down: async (sink) => {
    const repos = await sink.getRepos();
    for (const repo of repos) {
      if (!repo._id) {
        continue;
      }

      await sink.updateRepo({
        _id: repo._id,
        dateCreated: undefined,
        lastModified: undefined,
      } as Partial<Repo>);
    }
  },
};
