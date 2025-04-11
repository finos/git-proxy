import express, { Application } from 'express';
import bodyParser from 'body-parser';
import http from 'http';
import https from 'https';
import fs from 'fs';
import path from 'path';
import { router } from './routes';
import * as config from '../config';
import * as db from '../db';
import { PluginLoader } from '../plugin';
import chain from './chain';
import { serverConfig } from '../config/env';

const proxyHttpPort = serverConfig.GIT_PROXY_SERVER_PORT;
const proxyHttpsPort = serverConfig.GIT_PROXY_HTTPS_SERVER_PORT;

interface ServerOptions {
  inflate: boolean;
  limit: string;
  type: string;
  key: Buffer;
  cert: Buffer;
}

const options: ServerOptions = {
  inflate: true,
  limit: '100000kb',
  type: '*/*',
  key: fs.readFileSync(path.join(__dirname, config.getSSLKeyPath())),
  cert: fs.readFileSync(path.join(__dirname, config.getSSLCertPath())),
};

const proxyPreparations = async (): Promise<void> => {
  const plugins = config.getPlugins();
  const pluginLoader = new PluginLoader(plugins);
  await pluginLoader.load();
  chain.chainPluginLoader = pluginLoader;
  // Check to see if the default repos are in the repo list
  const defaultAuthorisedRepoList = config.getAuthorisedList();
  const allowedList = await db.getRepos();

  defaultAuthorisedRepoList.forEach(async (x) => {
    const found = allowedList.find((y: any) => y.project === x.project && x.name === y.name);
    if (!found) {
      await db.createRepo(x);
      await db.addUserCanPush(x.name, 'admin');
      await db.addUserCanAuthorise(x.name, 'admin');
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

  // Start HTTP server
  // @ts-expect-error - The options type is compatible with what http.createServer expects
  httpServer = http.createServer(options, app);
  httpServer.listen(proxyHttpPort, () => {
    console.log(`HTTP Proxy Listening on ${proxyHttpPort}`);
  });

  // Start HTTPS server if SSL certificates exist
  const sslKeyPath = config.getSSLKeyPath();
  const sslCertPath = config.getSSLCertPath();

  if (fs.existsSync(sslKeyPath) && fs.existsSync(sslCertPath)) {
    httpsServer = https.createServer(options, app);
    httpsServer.listen(proxyHttpsPort, () => {
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

export { proxyPreparations, createApp, start, stop };
