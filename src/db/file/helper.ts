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

import { existsSync, mkdirSync } from 'fs';
import Datastore from '@seald-io/nedb';
import { PaginatedResult } from '../types';

export const getSessionStore = (): undefined => undefined;
export const initializeFolders = () => {
  if (!existsSync('./.data/db')) mkdirSync('./.data/db', { recursive: true });
};

export const paginatedFind = <T>(
  db: Datastore,
  filter: Record<string, unknown>,
  sort: Record<string, 1 | -1>,
  skip: number,
  limit: number,
): Promise<PaginatedResult<T>> => {
  const countPromise = new Promise<number>((resolve, reject) => {
    db.count(filter as any, (err: Error | null, count: number) => {
      /* istanbul ignore if */
      if (err) reject(err);
      else resolve(count);
    });
  });

  const dataPromise = new Promise<T[]>((resolve, reject) => {
    db.find(filter as any)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .exec((err: Error | null, docs: any[]) => {
        /* istanbul ignore if */
        if (err) reject(err);
        else resolve(docs);
      });
  });

  return limit > 0
    ? Promise.all([dataPromise, countPromise]).then(([data, total]) => ({ data, total }))
    : dataPromise.then((data) => ({ data, total: data.length }));
};
