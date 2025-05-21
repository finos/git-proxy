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
const express = require('express');
const session = require('express-session');
const http = require('http');
const cors = require('cors');
const app = express();
const path = require('path');
const config = require('../config');
const db = require('../db');
const rateLimit = require('express-rate-limit');
const lusca = require('lusca');

const limiter = rateLimit(config.getRateLimit());

const { GIT_PROXY_UI_PORT: uiPort } = require('../config/env').serverConfig;

const _httpServer = http.createServer(app);

const corsOptions = {
  credentials: true,
  origin: true,
};

const createApp = async () => {
  // configuration of passport is async
  // Before we can bind the routes - we need the passport strategy
  const passport = await require('./passport').configure();
  const routes = require('./routes');
  const absBuildPath = path.join(__dirname, '../../build');
  app.use(cors(corsOptions));
  app.set('trust proxy', 1);
  app.use(limiter);
  app.use(
    session({
      store: config.getDatabase().type === 'mongo' ? db.getSessionStore(session) : null,
      secret: config.getCookieSecret(),
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: 'auto',
        httpOnly: true,
        maxAge: config.getSessionMaxAgeHours() * 60 * 60 * 1000,
      },
    }),
  );
  if (config.getCSRFProtection() && process.env.NODE_ENV !== 'test') {
    app.use(
      lusca({
        csrf: {
          cookie: { name: 'csrf' },
        },
        hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
        nosniff: true,
        referrerPolicy: 'same-origin',
        xframe: 'SAMEORIGIN',
        xssProtection: true,
      }),
    );
  }
  app.use(passport.initialize());
  app.use(passport.session());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use('/', routes);
  app.use('/', express.static(absBuildPath));
  app.get('/*', (req, res) => {
    res.sendFile(path.join(`${absBuildPath}/index.html`));
  });

  return app;
};

const start = async () => {
  const app = await createApp();

  _httpServer.listen(uiPort);

  console.log(`Service Listening on ${uiPort}`);
  app.emit('ready');

  return app;
};

module.exports.createApp = createApp;
module.exports.start = start;
module.exports.httpServer = _httpServer;
