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
import { beforeAll, afterAll } from '@jest/globals';
import mongoose from 'mongoose';

beforeAll(async () => {
  if (typeof process.env.MONGO_URI === 'string' && process.env.MONGO_URI.startsWith('mongodb')) {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('done connecting mongoose');
  }
});

afterAll(async () => {
  await mongoose.disconnect();
});
