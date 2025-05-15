import express from 'express';
import bodyParser from 'body-parser';
import http from 'http';
import https from 'https';
import fs from 'fs';
import { router } from './routes';
import {
  getAuthorisedList,
  getPlugins,
  getTLSKeyPemPath,
  getTLSCertPemPath,
  getTLSEnabled,
} from '../config';
import { addUserCanAuthorise, addUserCanPush, createRepo, getRepos } from '../db';
import { PluginLoader } from '../plugin';
import chain from './chain';
import { Repo } from '../db/types';

const { GIT_PROXY_SERVER_PORT: proxyHttpPort, GIT_PROXY_HTTPS_SERVER_PORT: proxyHttpsPort } =
  require('../config/env').serverConfig;

const options = {
  inflate: true,
  limit: '100000kb',
  type: '*/*',
  key: getTLSEnabled() ? fs.readFileSync(getTLSKeyPemPath()) : undefined,
  cert: getTLSEnabled() ? fs.readFileSync(getTLSCertPemPath()) : undefined,
};

export const proxyPreparations = async () => {
  const plugins = getPlugins();
  const pluginLoader = new PluginLoader(plugins);
  await pluginLoader.load();
  chain.chainPluginLoader = pluginLoader;
  // Check to see if the default repos are in the repo list
  const defaultAuthorisedRepoList = getAuthorisedList();
  const allowedList: Repo[] = await getRepos();

  defaultAuthorisedRepoList.forEach(async (x) => {
    const found = allowedList.find((y) => y.project === x.project && x.name === y.name);
    if (!found) {
      await createRepo(x);
      await addUserCanPush(x.name, 'admin');
      await addUserCanAuthorise(x.name, 'admin');
    }
  });
};

// just keep this async incase it needs async stuff in the future
export const createApp = async () => {
  const app = express();
  // Setup the proxy middleware
  app.use(bodyParser.raw(options));
  app.use('/', router);
  return app;
};

export const start = async () => {
  const app = await createApp();
  await proxyPreparations();
  http.createServer(options as any, app).listen(proxyHttpPort, () => {
    console.log(`HTTP Proxy Listening on ${proxyHttpPort}`);
  });
  // Start HTTPS server only if TLS is enabled
  if (getTLSEnabled()) {
    https.createServer(options, app).listen(proxyHttpsPort, () => {
      console.log(`HTTPS Proxy Listening on ${proxyHttpsPort}`);
    });
  }
  return app;
};

export default {
  proxyPreparations,
  createApp,
  start,
};
