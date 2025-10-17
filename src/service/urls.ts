import { Request } from 'express';

import { serverConfig } from '../config/env';
import * as config from '../config';

const { GIT_PROXY_SERVER_PORT: PROXY_HTTP_PORT, GIT_PROXY_UI_PORT: UI_PORT } = serverConfig;

export const getProxyURL = (req: Request): string => {
  return (
    config.getDomains().proxy ??
    `${req.protocol}://${req.headers.host}`.replace(`:${UI_PORT}`, `:${PROXY_HTTP_PORT}`)
  );
};

export const getServiceUIURL = (req: Request): string => {
  return (
    config.getDomains().service ??
    `${req.protocol}://${req.headers.host}`.replace(`:${PROXY_HTTP_PORT}`, `:${UI_PORT}`)
  );
};
