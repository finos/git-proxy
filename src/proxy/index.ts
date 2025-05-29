import express, { Application } from 'express';
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

interface ServerOptions {
  inflate: boolean;
  limit: string;
  type: string;
  key: Buffer | undefined;
  cert: Buffer | undefined;
}

const options: ServerOptions = {
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
const createApp = async (): Promise<Application> => {
  const app = express();
  // Setup the proxy middleware
  app.use(bodyParser.raw(options));
  app.use('/', router);
  return app;
};

let httpServer: http.Server | null = null;
let httpsServer: https.Server | null = null;

const start = async (): Promise<Application> => {
  const app = await createApp();
  await proxyPreparations();
  httpServer = http.createServer(options as any, app).listen(proxyHttpPort, () => {
    console.log(`HTTP Proxy Listening on ${proxyHttpPort}`);
  });
  // Start HTTPS server only if TLS is enabled
  if (getTLSEnabled()) {
    httpsServer = https.createServer(options, app).listen(proxyHttpsPort, () => {
      console.log(`HTTPS Proxy Listening on ${proxyHttpsPort}`);
    });
  }
  return app;
};

const stop = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    try {
      // Close HTTP server if it exists
      if (httpServer) {
        httpServer.close(() => {
          console.log('HTTP server closed');
          httpServer = null;
        });
      }

      // Close HTTPS server if it exists
      if (httpsServer) {
        httpsServer.close(() => {
          console.log('HTTPS server closed');
          httpsServer = null;
        });
      }

      resolve();
    } catch (error) {
      reject(error);
    }
  });
};

export default {
  proxyPreparations,
  createApp,
  start,
  stop,
};
