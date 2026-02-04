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
import { Proxy } from '../proxy';
import routes from './routes';
import { configure } from './passport';

const limiter = rateLimit(config.getRateLimit());

const { GIT_PROXY_UI_PORT: uiPort } = serverConfig;

const DEFAULT_SESSION_MAX_AGE_HOURS = 12;

const app: Express = express();
let _httpServer: http.Server | null = null;

/**
 * CORS Configuration
 *
 * Environment Variable: ALLOWED_ORIGINS
 *
 * Configuration Options:
 * 1. Production (restrictive): ALLOWED_ORIGINS='https://gitproxy.company.com,https://gitproxy-staging.company.com'
 * 2. Development (permissive): ALLOWED_ORIGINS='*'
 * 3. Local dev with Vite: ALLOWED_ORIGINS='http://localhost:3000'
 * 4. Same-origin only: Leave ALLOWED_ORIGINS unset or empty
 *
 * Examples:
 * - Single origin: ALLOWED_ORIGINS='https://example.com'
 * - Multiple origins: ALLOWED_ORIGINS='http://localhost:3000,https://example.com'
 * - All origins (testing): ALLOWED_ORIGINS='*'
 * - Same-origin only: ALLOWED_ORIGINS='' or unset
 */

/**
 * Parse ALLOWED_ORIGINS environment variable
 * Supports:
 * - '*' for all origins
 * - Comma-separated list of origins: 'http://localhost:3000,https://example.com'
 * - Empty/undefined for same-origin only
 */
function getAllowedOrigins(): string[] | '*' | undefined {
  const allowedOrigins = process.env.ALLOWED_ORIGINS;

  if (!allowedOrigins) {
    return undefined; // No CORS, same-origin only
  }

  if (allowedOrigins === '*') {
    return '*'; // Allow all origins
  }

  // Parse comma-separated list
  return allowedOrigins
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

/**
 * CORS origin callback - determines if origin is allowed
 */
function corsOriginCallback(
  origin: string | undefined,
  callback: (err: Error | null, allow?: boolean) => void,
) {
  const allowedOrigins = getAllowedOrigins();

  // Allow all origins
  if (allowedOrigins === '*') {
    return callback(null, true);
  }

  // No ALLOWED_ORIGINS set - only allow same-origin (no origin header)
  if (!allowedOrigins) {
    if (!origin) {
      return callback(null, true); // Same-origin requests don't have origin header
    }
    return callback(null, false);
  }

  // Check if origin is in the allowed list
  if (!origin || allowedOrigins.includes(origin)) {
    return callback(null, true);
  }

  callback(new Error('Not allowed by CORS'));
}

const corsOptions: cors.CorsOptions = {
  origin: corsOriginCallback,
  credentials: true, // Allow credentials (cookies, authorization headers)
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-CSRF-TOKEN'],
  exposedHeaders: ['Set-Cookie'],
  maxAge: 86400, // 24 hours
};

/**
 * Internal function used to bootstrap GitProxy's API express application.
 * @param {Proxy} proxy A reference to the proxy, used to restart it when necessary.
 * @return {Promise<Express>} the express application
 */
async function createApp(proxy: Proxy): Promise<Express> {
  // configuration of passport is async
  // Before we can bind the routes - we need the passport strategy
  const passport = await configure();
  const absBuildPath = path.join(__dirname, '../../build');
  app.use(cors(corsOptions));
  app.set('trust proxy', 1);
  app.use(limiter);

  app.use(
    session({
      store: db.getSessionStore(),
      secret: config.getCookieSecret(),
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
  app.use('/', routes(proxy));
  app.use('/', express.static(absBuildPath));
  app.get('/*path', (_req, res) => {
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

  _httpServer = http.createServer(app);
  _httpServer.listen(uiPort);

  console.log(`Service Listening on ${uiPort}`);
  app.emit('ready');

  return app;
}

/**
 * Stops the proxy service.
 */
async function stop(): Promise<void> {
  if (!_httpServer) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    console.log(`Stopping Service Listening on ${uiPort}`);
    _httpServer!.close((err) => {
      if (err) {
        reject(err);
      } else {
        console.log('Service stopped');
        resolve();
      }
    });
  });
}

export const Service = {
  start,
  stop,
  get httpServer() {
    return _httpServer;
  },
};
