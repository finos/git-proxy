import express, { Express } from 'express';
import session from 'express-session';
import http from 'http';
import cors from 'cors';
import path from 'path';
import rateLimit from 'express-rate-limit';
import lusca from 'lusca';

import * as config from '../config';
import * as db from '../db';
import { serverConfig } from '../config/env';
import Proxy from '../proxy';

const limiter = rateLimit(config.getRateLimit());

const { GIT_PROXY_UI_PORT: uiPort } = serverConfig;

const DEFAULT_SESSION_MAX_AGE_HOURS = 12;

const app: Express = express();
const _httpServer = http.createServer(app);

const corsOptions = {
  credentials: true,
  origin: true,
};

/**
 * Internal function used to bootstrap the Git Proxy API's express application.
 * @param {Proxy} proxy A reference to the proxy, used to restart it when necessary.
 * @return {Promise<Express>} the express application
 */
async function createApp(proxy: Proxy): Promise<Express> {
  // configuration of passport is async
  // Before we can bind the routes - we need the passport strategy
  const passport = await require('./passport').configure();
  const routes = await import('./routes');
  const absBuildPath = path.join(__dirname, '../../build');
  app.use(cors(corsOptions));
  app.set('trust proxy', 1);
  app.use(limiter);

  app.use(
    session({
      store: db.getSessionStore(),
      secret: config.getCookieSecret() as string,
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: 'auto',
        httpOnly: true,
        maxAge: (config.getSessionMaxAgeHours() || DEFAULT_SESSION_MAX_AGE_HOURS) * 60 * 60 * 1000,
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
  app.use('/', routes.default(proxy));
  app.use('/', express.static(absBuildPath));
  app.get('/*', (req, res) => {
    res.sendFile(path.join(`${absBuildPath}/index.html`));
  });

  return app;
}

/**
 * Starts the proxy service.
 * @param {Proxy} proxy A reference to the proxy, used to restart it when necessary.
 * @return {Promise<Express>} the express application (used for testing).
 */
async function start(proxy: Proxy) {
  if (!proxy) {
    console.warn("WARNING: proxy is null and can't be controlled by the API service");
  }

  const app = await createApp(proxy);

  _httpServer.listen(uiPort);

  console.log(`Service Listening on ${uiPort}`);
  app.emit('ready');

  return app;
}

/**
 * Stops the proxy service.
 */
async function stop() {
  console.log(`Stopping Service Listening on ${uiPort}`);
  _httpServer.close();
}

export default {
  start,
  stop,
  httpServer: _httpServer,
};
