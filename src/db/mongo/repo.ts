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

import _ from 'lodash';
import { PaginatedResult, PaginationOptions, Repo, RepoQuery } from '../types';
import { connect, paginatedFind } from './helper';
import { toClass, buildSearchFilter, buildSort } from '../helper';
import { ObjectId, OptionalId, Document } from 'mongodb';

const collectionName = 'repos';

export const getRepos = async (
  query: Partial<RepoQuery> = {},
  pagination?: PaginationOptions,
): Promise<PaginatedResult<Repo>> => {
  const filter = buildSearchFilter({ ...query }, ['name', 'project', 'url'], pagination?.search);
  const sort = buildSort(pagination, 'name', 1, ['name', 'project', 'url']);
  const skip = pagination?.skip ?? 0;
  const limit = pagination?.limit ?? 0;

  const collection = await connect(collectionName);
  const { data, total } = await paginatedFind<Repo>(collection, filter, sort, skip, limit);
  return {
    data: _.chain(data)
      .map((x) => toClass(x, Repo.prototype))
      .value(),
    total,
  };
};

export const getRepo = async (name: string): Promise<Repo | null> => {
  const collection = await connect(collectionName);
  const doc = await collection.findOne({ name: { $eq: name.toLowerCase() } });
  return doc ? toClass(doc, Repo.prototype) : null;
};

export const getRepoByUrl = async (repoUrl: string): Promise<Repo | null> => {
  const collection = await connect(collectionName);
  const doc = await collection.findOne({ url: { $eq: repoUrl } });
  return doc ? toClass(doc, Repo.prototype) : null;
};

export const getRepoById = async (_id: string): Promise<Repo | null> => {
  const collection = await connect(collectionName);
  const doc = await collection.findOne({ _id: new ObjectId(_id) });
  return doc ? toClass(doc, Repo.prototype) : null;
};

export const createRepo = async (repo: Repo): Promise<Repo> => {
  const collection = await connect(collectionName);
  const response = await collection.insertOne(repo as OptionalId<Document>);
  console.log(`created new repo ${JSON.stringify(repo)}`);
  // add in the _id generated for the record
  repo._id = response.insertedId.toString();
  return repo;
};

export const addUserCanPush = async (_id: string, user: string): Promise<void> => {
  user = user.toLowerCase();
  const collection = await connect(collectionName);
  await collection.updateOne({ _id: new ObjectId(_id) }, { $push: { 'users.canPush': user } });
};

export const addUserCanAuthorise = async (_id: string, user: string): Promise<void> => {
  user = user.toLowerCase();
  const collection = await connect(collectionName);
  await collection.updateOne({ _id: new ObjectId(_id) }, { $push: { 'users.canAuthorise': user } });
};

export const removeUserCanPush = async (_id: string, user: string): Promise<void> => {
  user = user.toLowerCase();
  const collection = await connect(collectionName);
  await collection.updateOne({ _id: new ObjectId(_id) }, { $pull: { 'users.canPush': user } });
};

export const removeUserCanAuthorise = async (_id: string, user: string): Promise<void> => {
  user = user.toLowerCase();
  const collection = await connect(collectionName);
  await collection.updateOne({ _id: new ObjectId(_id) }, { $pull: { 'users.canAuthorise': user } });
};

export const deleteRepo = async (_id: string): Promise<void> => {
  const collection = await connect(collectionName);
  await collection.deleteMany({ _id: new ObjectId(_id) });
};
