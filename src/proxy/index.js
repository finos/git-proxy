const proxyApp = require('express')();
const bodyParser = require('body-parser');
const http = require("http");
const https = require("https");
const fs = require('fs');
const path = require("path");
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
  cert: fs.readFileSync(path.join(__dirname, config.getSSLCertPath()))
};

// Setup the proxy middleware
proxyApp.use(bodyParser.raw(options));
proxyApp.use('/', router);

const start = async () => {
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

  http.createServer(options, proxyApp).listen(proxyHttpPort, () => {
    console.log(`HTTP Proxy Listening on ${proxyHttpPort}`);
  });
  https.createServer(options, proxyApp).listen(proxyHttpsPort, () => {
    console.log(`HTTPS Proxy Listening on ${proxyHttpsPort}`);
  });

  return proxyApp;
};

module.exports.start = start;
