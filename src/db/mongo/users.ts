/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.    
 */
import { User } from "../types";

const connect = require('./helper').connect;
const collectionName = 'users';

export const findUser = async function (username: string) {
  const collection = await connect(collectionName);
  return collection.findOne({ username: { $eq: username } });
};

export const getUsers = async function (query: any = {}) {
  console.log(`Getting users for query= ${JSON.stringify(query)}`);
  const collection = await connect(collectionName);
  return collection.find(query, { password: 0 }).toArray();
};

export const deleteUser = async function (username: string) {
  const collection = await connect(collectionName);
  return collection.deleteOne({ username: username });
};

export const createUser = async function (user: User) {
  user.username = user.username.toLowerCase();
  const collection = await connect(collectionName);
  return collection.insertOne(user);
};

export const updateUser = async (user: User) => {
  user.username = user.username.toLowerCase();
  const options = { upsert: true };
  const collection = await connect(collectionName);
  await collection.updateOne({ username: user.username }, { $set: user }, options);
};
