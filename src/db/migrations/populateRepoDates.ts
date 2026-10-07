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

import type { Migration } from './index';

/**
 * Backfills dateCreated/lastModified on repos created before those fields
 * existed. Reads through the sink, asks the backend to derive a creation time
 * (Mongo derives it from the ObjectId; the file backend has no source and
 * returns undefined), and writes through the sink. Repos that already have a
 * dateCreated are skipped, so the migration is safe to re-run.
 */
export const populateRepoDates: Migration = {
  id: '20260729-populate-repo-dates',

  up: async (sink) => {
    const repos = await sink.getRepos();
    for (const repo of repos) {
      if (repo.dateCreated || !repo._id) {
        continue;
      }
      const created = sink.deriveCreatedAt(repo._id) ?? new Date().toISOString();
      await sink.updateRepo({
        _id: repo._id,
        dateCreated: created,
        lastModified: repo.lastModified ?? created,
      });
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
      });
    }
  },
};
