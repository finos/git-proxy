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
import express from 'express';
import { logger } from '@/logger';
import createApiRouter from '@/routes/api';
import pinoHTTP from 'pino-http';
import bodyParser from 'body-parser';
import { rateLimit } from 'express-rate-limit';
import helmet from 'helmet';
import { LicenseDataService } from './services/data';
// import lusca from 'lusca';

// helmet and lusca comparison
// https://github.com/krakenjs/lusca/issues/42#issuecomment-65093906
// TODO: integrate lusca once added sessions/auth

const createApp = (lds: LicenseDataService) => {
  const app = express();

  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 100,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    // in memory store
  });

  app.use(helmet());
  app.use(limiter);
  app.use(bodyParser.json());
  app.use(
    pinoHTTP({
      logger,
      autoLogging: process.env.NODE_ENV === 'development',
      // overrides core logger redaction
      // please update in logger.ts
      // redact: [],
    }),
  );

  app.use('/api', createApiRouter(lds));
  return app;
};
export { createApp };
