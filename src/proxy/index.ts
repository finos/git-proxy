import express, { Express } from 'express';
import http from 'http';
import https from 'https';
import fs from 'fs';
import { getRouter } from './routes';
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

export default class Proxy {
  private httpServer: http.Server | null = null;
  private httpsServer: https.Server | null = null;
  private expressApp: Express | null = null;

  constructor() {}

  private async proxyPreparations() {
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
        const repo = await createRepo(x);
        await addUserCanPush(repo._id!, 'admin');
        await addUserCanAuthorise(repo._id!, 'admin');
      }
    });
  }

  private async createApp() {
    const app = express();
    const router = await getRouter();
    app.use('/', router);
    return app;
  }

  public async start() {
    await this.proxyPreparations();
    this.expressApp = await this.createApp();
    this.httpServer = http
      .createServer(options as any, this.expressApp)
      .listen(proxyHttpPort, () => {
        console.log(`HTTP Proxy Listening on ${proxyHttpPort}`);
      });
    // Start HTTPS server only if TLS is enabled
    if (getTLSEnabled()) {
      this.httpsServer = https.createServer(options, this.expressApp).listen(proxyHttpsPort, () => {
        console.log(`HTTPS Proxy Listening on ${proxyHttpsPort}`);
      });
    }
  }

  public getExpressApp() {
    return this.expressApp;
  }

  public stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Close HTTP server if it exists
        if (this.httpServer) {
          this.httpServer.close(() => {
            console.log('HTTP server closed');
            this.httpServer = null;
          });
        }

        // Close HTTPS server if it exists
        if (this.httpsServer) {
          this.httpsServer.close(() => {
            console.log('HTTPS server closed');
            this.httpsServer = null;
          });
        }

        resolve();
      } catch (error) {
        reject(error);
      }
    });
  }
}
