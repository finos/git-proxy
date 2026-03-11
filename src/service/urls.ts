/**
 * Copyright 2026 GitProxy Contributors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { Request } from 'express';

import { serverConfig } from '../config/env';
import * as config from '../config';

const {
  GIT_PROXY_SERVER_PORT: PROXY_HTTP_PORT,
  GIT_PROXY_UI_PORT: UI_PORT,
  GIT_PROXY_UI_HOST: UI_HOST,
} = serverConfig;

const normaliseProtocol = (protocol: string): string => {
  if (!protocol) {
    return 'https';
  }
  if (protocol === 'ssh') {
    return 'https';
  }
  return protocol;
};

const extractHostname = (value: string): string | null => {
  if (!value || typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.hostname) {
      return parsed.hostname;
    }
    if (parsed.host) {
      return parsed.host;
    }
  } catch (_) {
    try {
      const parsed = new URL(`https://${trimmed}`);
      if (parsed.hostname) {
        return parsed.hostname;
      }
    } catch (_) {
      // ignore
    }
  }

  return trimmed.split('/')[0] || null;
};

const DEFAULT_HOST = (() => {
  const host = extractHostname(UI_HOST);
  const proxyPort = PROXY_HTTP_PORT || 8000;
  if (host) {
    return `${host}:${proxyPort}`;
  }
  return `localhost:${proxyPort}`;
})();

const resolveHost = (req: Request): string => {
  if (req?.headers?.host) {
    return req.headers.host;
  }
  return DEFAULT_HOST;
};

const getDefaultUrl = (req: Request): string => {
  const protocol = normaliseProtocol(req?.protocol);
  const host = resolveHost(req);
  return `${protocol}://${host}`;
};

export const getProxyURL = (req: Request): string => {
  return (
    config.getDomains().proxy ?? getDefaultUrl(req).replace(`:${UI_PORT}`, `:${PROXY_HTTP_PORT}`)
  );
};

export const getServiceUIURL = (req: Request): string => {
  return (
    config.getDomains().service ?? getDefaultUrl(req).replace(`:${PROXY_HTTP_PORT}`, `:${UI_PORT}`)
  );
};
