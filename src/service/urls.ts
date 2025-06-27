import { serverConfig } from '../config/env';
import * as config from '../config';
import { Request } from 'express';

const { GIT_PROXY_SERVER_PORT: PROXY_HTTP_PORT, GIT_PROXY_UI_PORT: UI_PORT } = serverConfig;

export function getProxyURL(req: Request): string {
  const defaultURL = `${req.protocol}://${req.headers.host}`.replace(
    `:${UI_PORT}`,
    `:${PROXY_HTTP_PORT}`,
  );
  return config.getDomains().proxy ?? defaultURL;
}

export function getServiceUIURL(req: Request): string {
  const defaultURL = `${req.protocol}://${req.headers.host}`.replace(
    `:${PROXY_HTTP_PORT}`,
    `:${UI_PORT}`,
  );
  return config.getDomains().service ?? defaultURL;
}
