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

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
});

const { GIT_PROXY_UI_PORT: uiPort } = require('../config/env').Vars;

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
