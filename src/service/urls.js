const {
  GIT_PROXY_SERVER_PORT: PROXY_HTTP_PORT,
  GIT_PROXY_UI_PORT: UI_PORT,
  GIT_PROXY_UI_HOST: UI_HOST,
} = require('../config/env').serverConfig;
const config = require('../config');

const normaliseProtocol = (protocol) => {
  if (!protocol) {
    return 'https';
  }
  if (protocol === 'ssh') {
    return 'https';
  }
  return protocol;
};

const extractHostname = (value) => {
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

const resolveHost = (req) => {
  if (req?.headers?.host) {
    return req.headers.host;
  }
  return DEFAULT_HOST;
};

module.exports = {
  getProxyURL: (req) => {
    const protocol = normaliseProtocol(req?.protocol);
    const host = resolveHost(req);
    const defaultURL = `${protocol}://${host}`.replace(`:${UI_PORT}`, `:${PROXY_HTTP_PORT}`);
    return config.getDomains().proxy ?? defaultURL;
  },
  getServiceUIURL: (req) => {
    const protocol = normaliseProtocol(req?.protocol);
    const host = resolveHost(req);
    const defaultURL = `${protocol}://${host}`.replace(`:${PROXY_HTTP_PORT}`, `:${UI_PORT}`);
    return config.getDomains().service ?? defaultURL;
  },
};
