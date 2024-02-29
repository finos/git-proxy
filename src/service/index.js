const express = require('express');
const session = require('express-session');
const http = require('http');
const cors = require('cors');
const app = express();
require('dotenv').config();
const rateLimit = require('express-rate-limit');
const csrf = require('lusca').csrf;

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
});

const { GIT_PROXY_UI_PORT: uiPort } = require('../config/env').Vars;

const _httpServer = http.createServer(app);

const corsOptions = {
  origin: 'http://localhost:3000',
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  preflightContinue: false,
  credentials: true,
};

const start = async () => {
  // configuration of passport is async
  // Before we can bind the routes - we need the passport
  const passport = await require('./passport').configure();
  const routes = require('./routes');
  app.use(cors(corsOptions));
  app.use(limiter);
  app.use(
    session({
      secret: 'keyboard cat',
      resave: false,
      saveUninitialized: false,
    }),
  );
  app.use(csrf());
  app.use(passport.initialize());
  app.use(passport.session());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use('/', routes);

  await _httpServer.listen(uiPort);

  console.log(`Service Listening on ${uiPort}`);
  app.emit('ready');

  return app;
};

module.exports.start = start;
module.exports.httpServer = _httpServer;
