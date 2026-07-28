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

import { connect } from './helper';

const collectionName = 'migrations';

export const getAppliedMigrations = async (): Promise<string[]> => {
  const collection = await connect(collectionName);
  const docs = await collection.find({}).toArray();
  return docs.map((doc) => doc.id as string);
};

export const recordMigration = async (id: string): Promise<void> => {
  const collection = await connect(collectionName);
  await collection.updateOne({ id }, { $set: { id } }, { upsert: true });
};

export const unrecordMigration = async (id: string): Promise<void> => {
  const collection = await connect(collectionName);
  await collection.deleteOne({ id });
};
