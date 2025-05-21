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
import { logger } from '@/logger';
import { connectDB } from './db/connect';
import env from '@/env';
import { createApp } from './app';
import { MongooseLicenseDataService } from './services/data/mongoose';
import { Database } from './db';

const port = env.PORT;

const run = async () => {
  logger.info('starting server', { port });

  const { error, data: dbConnection } = await connectDB(env.MONGO_URI);
  if (error !== null) {
    logger.error(error);
    throw new Error('failed to connect to mongo');
  }
  const db = new Database(dbConnection);

  const running = () => {
    logger.info('started server', { port });
  };

  const lds = new MongooseLicenseDataService(db);
  const app = createApp(lds);
  app.listen(port, running);
};
run();
