const express = require('express');
const session = require('express-session');
const http = require('http');
const cors = require('cors');
const app = express();
const port = 8080;
const os = require('os');
const osHostname = os.hostname();
const path = require('path');
const config = require('../config');
const db = require('../db');

const _httpServer = http.createServer(app);

const corsOptions = {
  credentials: true,
  origin: true,
  credentials: true,
};

const start = async () => {
  // configuration of passport is async
  // Before we can bind the routes - we need the passport strategy
  const passport = await require('./passport').configure();
  const routes = require('./routes');
  const absBuildPath = path.join(__dirname, '../../build');
  app.use(cors(corsOptions));
  app.use(session({
    store: db.getSessionStore(session),
    secret: config.getCookieSecret(),
    resave: false,
    saveUninitialized: false,
    secure: true,
    maxAge: config.getSessionMaxAgeHours() * 60 * 1000,
  }));
  app.use(passport.initialize());
  app.use(passport.session());
  app.use(express.json());
  app.use(express.urlencoded({extended: true}));
  app.use('/', routes);
  app.use('/', express.static(absBuildPath));
  app.get('/*', (req, res) => {
    res.sendFile(path.join(`${absBuildPath}/index.html`));
  });

  await _httpServer.listen(port);

  // eslint-disable-next-line max-len
  console.log(`Service Listening on os.host ${osHostname} ${port} ${__dirname} ${absBuildPath}`);
  app.emit('ready');

  return app;
};

module.exports.start = start;
module.exports.httpServer = _httpServer;
