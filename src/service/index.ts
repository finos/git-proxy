import express, { Express } from 'express';
import session from 'express-session';
import http from 'http';
import cors from 'cors';
import path from 'path';
import rateLimit from 'express-rate-limit';
import lusca from 'lusca';

import * as config from '../config';
import * as db from '../db';
import { configure as configurePassport } from './passport';
import routes from './routes';
import { serverConfig } from '../config/env';

const app: Express = express();
const limiter = rateLimit(config.getRateLimit());
const { GIT_PROXY_UI_PORT: uiPort } = serverConfig;

const _httpServer = http.createServer(app);

const corsOptions = {
  credentials: true,
  origin: true,
};

export const createApp = async (): Promise<Express> => {
  const passport = await configurePassport();
  const absBuildPath = path.join(__dirname, '../../build');

  app.use(cors(corsOptions));
  app.set('trust proxy', 1);
  app.use(limiter);

  const sessionStore =
    config.getDatabase().type === 'mongo' ? db.getSessionStore(session) : undefined;

  app.use(
    session({
      store: sessionStore,
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
  app.get('/*', (_req, res) => {
    res.sendFile(path.join(`${absBuildPath}/index.html`));
  });

  return app;
};

export const start = async (): Promise<Express> => {
  const app = await createApp();

  _httpServer.listen(uiPort);
  console.log(`Service Listening on ${uiPort}`);
  app.emit('ready');

  return app;
};

export const httpServer = _httpServer;
