const express = require('express');
const bodyParser = require('body-parser');
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const router = require('./routes').router;
const config = require('../config');
const db = require('../db');
const { PluginLoader } = require('../plugin');
const chain = require('./chain');
const { GIT_PROXY_SERVER_PORT: proxyHttpPort } = require('../config/env').Vars;
const { GIT_PROXY_HTTPS_SERVER_PORT: proxyHttpsPort } = require('../config/env').Vars;

const options = {
  inflate: true,
  limit: '100000kb',
  type: '*/*',
  key: fs.readFileSync(path.join(__dirname, config.getSSLKeyPath())),
  cert: fs.readFileSync(path.join(__dirname, config.getSSLCertPath())),
};

const proxyPreparations = async () => {
  const plugins = config.getPlugins();
  const pluginLoader = new PluginLoader(plugins);
  await pluginLoader.load();
  chain.chainPluginLoader = pluginLoader;
  // Check to see if the default repos are in the repo list
  const defaultAuthorisedRepoList = config.getAuthorisedList();
  const allowedList = await db.getRepos();

  defaultAuthorisedRepoList.forEach(async (x) => {
    const found = allowedList.find((y) => y.project === x.project && x.name === y.name);
    if (!found) {
      await db.createRepo(x);
      await db.addUserCanPush(x.name, 'admin');
      await db.addUserCanAuthorise(x.name, 'admin');
    }
  });
};

// just keep this async incase it needs async stuff in the future
const createApp = async () => {
  const app = express();
  // Setup the proxy middleware
  app.use(bodyParser.raw(options));
  app.use('/', router);
  return app;
};

const start = async () => {
  const app = await createApp();
  await proxyPreparations();
  http.createServer(options, app).listen(proxyHttpPort, () => {
    console.log(`HTTP Proxy Listening on ${proxyHttpPort}`);
  });
  https.createServer(options, app).listen(proxyHttpsPort, () => {
    console.log(`HTTPS Proxy Listening on ${proxyHttpsPort}`);
  });

  return app;
};

module.exports.proxyPreparations = proxyPreparations;
module.exports.createApp = createApp;
module.exports.start = start;
