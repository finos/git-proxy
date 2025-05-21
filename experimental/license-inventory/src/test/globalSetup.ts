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
import { MongoMemoryServer } from 'mongodb-memory-server-core';
import * as mongoose from 'mongoose';
import { config } from './utils/config';

export default async function globalSetup() {
  // TODO: make this logic smarter for no mongo, existing mongo, or using MongoMemoryServer
  if (config.Memory) {
    const instance = await MongoMemoryServer.create();
    const uri = instance.getUri();
    global.__MONGOINSTANCE = instance;
    process.env.MONGO_URI = uri.slice(0, uri.lastIndexOf('/'));

    // The following is to make sure the database is clean before a test suite starts
    const conn = await mongoose.connect(`${process.env.MONGO_URI}/${config.Database}`);
    await conn.connection.db?.dropDatabase();
    await mongoose.disconnect();
  }

  if (typeof process.env.MONGO_URI !== 'string') {
    // pass env validation
    process.env.MONGO_URI = 'dummy';
  }
}
