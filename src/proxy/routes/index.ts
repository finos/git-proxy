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

import { Router, Request, Response, NextFunction, RequestHandler } from 'express';
import proxy from 'express-http-proxy';
import { PassThrough } from 'stream';
import getRawBody from 'raw-body';
import { executeChain } from '../chain';
import { processUrlPath, validGitRequest } from './helper';
import { getAllProxiedHosts } from '../../db';
import { ProxyOptions } from 'express-http-proxy';
import { getMaxPackSizeBytes, getSidebandProgressEnabled } from '../../config';
import { MEGABYTE } from '../../constants';
import { handleErrorAndLog } from '../../utils/errors';
import { getUpstreamProxyConfig } from '../../config';
import { HttpsProxyAgent } from 'https-proxy-agent';
import http, { OutgoingHttpHeaders, RequestOptions } from 'http';
import https from 'https';
import { buildRejectionReportStatus, encodeSidebandChunk, SidebandBand } from '../sideband';
import { Action } from '../actions';
import { FLUSH_PACKET } from '../constants';

enum ActionType {
  ALLOWED = 'Allowed',
  ERROR = 'Error',
  BLOCKED = 'Blocked',
}

const logAction = (
  url: string,
  host: string | null | undefined,
  userAgent: string | null | undefined,
  type: ActionType,
  message?: string,
) => {
  let msg = `Action processed: ${type}
    Request URL: ${url}
    Host:        ${host}
    User-Agent:  ${userAgent}`;

  if (message && type !== ActionType.ALLOWED) {
    msg += `\n    ${type}:       ${message}`;
  }

  console.log(msg);
};

const proxyFilter: ProxyOptions['filter'] = async (req, res) => {
  try {
    const urlComponents = processUrlPath(req.url);
    if (
      !urlComponents ||
      urlComponents.gitPath === undefined ||
      !validGitRequest(urlComponents.gitPath, req.headers)
    ) {
      const message = 'Invalid request received';
      logAction(req.url, req.headers.host, req.headers['user-agent'], ActionType.ERROR, message);
      res.status(200).send(handleMessage(message));
      return false;
    }

    // For POST pack requests, use the raw body extracted by extractRawBody middleware
    if (isPackPost(req) && req.bodyRaw) {
      req.body = req.bodyRaw;
      // Clean up the bodyRaw property before forwarding the request
      delete req.bodyRaw;
    }

    const action = await executeChain(req, res);

    if (action.error || action.blocked) {
      const message = action.errorMessage ?? action.blockedMessage ?? 'Unknown error';
      const type = action.error ? ActionType.ERROR : ActionType.BLOCKED;
      const statusReport = buildRejectionReportStatus(action, rejectionReasonFor(action));

      logAction(req.url, req.headers.host, req.headers['user-agent'], type, message);
      sendErrorResponse(req, res, message, statusReport);
      return false;
    }

    logAction(req.url, req.headers.host, req.headers['user-agent'], ActionType.ALLOWED);

    // this is the only case where we do not respond directly, instead we return true to proxy the request
    return true;
  } catch (error: unknown) {
    const message = handleErrorAndLog(error, 'Error occurred in proxy filter function');

    logAction(req.url, req.headers.host, req.headers['user-agent'], ActionType.ERROR, message);
    sendErrorResponse(req, res, message);
    return false;
  }
};

const sendErrorResponse = (
  req: Request,
  res: Response,
  message: string,
  statusReport?: Buffer,
): void => {
  // GET requests to /info/refs (used to check refs for many git operations) must use Git protocol error packet format
  if (req.method === 'GET' && req.url.includes('/info/refs')) {
    res.set('content-type', 'application/x-git-upload-pack-advertisement');
    res.status(200).send(handleRefsErrorMessage(message));
    return;
  }

  // Blocked pull/fetch: an upload-pack POST expects an upload-pack result. Send a protocol ERR
  // packet (PKT-LINE("ERR" SP explanation)) so the git client aborts the fetch and prints the
  // message ("remote error: ..."), rather than a receive-pack-shaped sideband it cannot parse.
  if (req.url.endsWith('/git-upload-pack')) {
    res.set('content-type', 'application/x-git-upload-pack-result');
    res.set('expires', 'Fri, 01 Jan 1980 00:00:00 GMT');
    res.set('pragma', 'no-cache');
    res.set('cache-control', 'no-cache, max-age=0, must-revalidate');
    res.status(200).send(handleErrPacket(message));
    return;
  }

  // Standard git receive-pack response
  res.set('content-type', 'application/x-git-receive-pack-result');
  res.set('expires', 'Fri, 01 Jan 1980 00:00:00 GMT');
  res.set('pragma', 'no-cache');
  res.set('cache-control', 'no-cache, max-age=0, must-revalidate');
  res.set('vary', 'Accept-Encoding');
  res.set('x-frame-options', 'DENY');
  res.set('connection', 'close');

  if (statusReport) {
    // Allow git client to end the session cleanly instead of
    // giving "fatal: the remote end hung up unexpectedly"
    res
      .status(200)
      .send(
        Buffer.concat([
          encodeSidebandChunk(SidebandBand.Progress, `\t${message}\n`),
          statusReport,
          Buffer.from(FLUSH_PACKET, 'ascii'),
        ]),
      );
    return;
  }

  res.status(200).send(handleMessage(message));
};

/**
 * The reason git shows in its "! [remote rejected] <ref> (<reason>)" line
 * for a push that GitProxy did not forward upstream.
 * @param {Action} action The completed push action.
 * @return {string} A short, single-line rejection reason.
 */
const rejectionReasonFor = (action: Action): string =>
  action.error ? 'rejected by GitProxy' : 'approval required';

const handleMessage = (message: string): string => {
  const packet = encodeSidebandChunk(SidebandBand.Progress, `\t${message}\n`);
  return packet.toString('utf8') + FLUSH_PACKET;
};

const handleRefsErrorMessage = (message: string): string => {
  // Git protocol for GET /info/refs error packets: PKT-LINE("ERR" SP explanation-text)
  const errorBody = `ERR ${message}`;
  const len = (4 + Buffer.byteLength(errorBody)).toString(16).padStart(4, '0');
  return `${len}${errorBody}\n0000`;
};

const handleErrPacket = (message: string): string => {
  // PKT-LINE("ERR" SP explanation-text LF) - the length header counts the trailing LF
  const errorBody = `ERR ${message}\n`;
  const len = (4 + Buffer.byteLength(errorBody)).toString(16).padStart(4, '0');
  return `${len}${errorBody}0000`;
};

const getRequestPathResolver: (prefix: string) => ProxyOptions['proxyReqPathResolver'] = (
  prefix,
) => {
  return (req) => {
    let url;
    // try to prevent too many slashes in the URL
    if (prefix.endsWith('/') && req.originalUrl.startsWith('/')) {
      url = prefix.substring(0, prefix.length - 1) + req.originalUrl;
    } else {
      url = prefix + req.originalUrl;
    }

    console.log(`Request resolved to ${url}`);
    return url;
  };
};

const getEnvProxyUrl = () =>
  process.env.HTTPS_PROXY ||
  process.env.https_proxy ||
  process.env.HTTP_PROXY ||
  process.env.http_proxy;

const getEnvNoProxyList = (): string[] => {
  const noProxy = process.env.NO_PROXY || process.env.no_proxy;
  if (!noProxy) {
    return [];
  }
  return noProxy
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
};

const hostMatchesNoProxy = (host: string | null | undefined, noProxyList: string[]): boolean => {
  if (!host) {
    return false;
  }

  const hostname = host.split(':')[0];

  return noProxyList.some((pattern) => {
    if (!pattern) {
      return false;
    }

    const trimmed = pattern.trim().replace(/^\./, ''); // strip leading dot
    if (trimmed === '*') return true; // wildcard - bypass all

    if (trimmed === '') {
      return false;
    }

    // Exact match
    if (hostname === trimmed) {
      return true;
    }

    // Domain suffix match, e.g. example.com matches foo.example.com
    if (hostname.endsWith(`.${trimmed}`)) {
      return true;
    }

    return false;
  });
};

// WARNING: proxyUrl may contain plaintext credentials in the userinfo portion
// (e.g. http://user:pass@proxy.corp.local:8080). Never log it directly — use
// redactProxyUrl() from config for any log statements involving this value.
let _cachedProxyAgent: { proxyUrl: string; agent: HttpsProxyAgent<string> } | null = null;

const getOrCreateProxyAgent = (proxyUrl: string): HttpsProxyAgent<string> => {
  if (!_cachedProxyAgent || _cachedProxyAgent.proxyUrl !== proxyUrl) {
    let parsed: URL;
    try {
      parsed = new URL(proxyUrl);
    } catch {
      throw new Error(
        `Invalid upstream proxy URL: check your upstreamProxy.url config or HTTPS_PROXY env var`,
      );
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error(
        `Unsupported upstream proxy URL scheme "${parsed.protocol.replace(/:$/, '')}": only http and https are supported`,
      );
    }
    if (!parsed.hostname) {
      throw new Error(
        `Invalid upstream proxy URL: hostname is missing — check your upstreamProxy.url config or HTTPS_PROXY env var`,
      );
    }
    _cachedProxyAgent = { proxyUrl, agent: new HttpsProxyAgent(proxyUrl) };
  }
  return _cachedProxyAgent.agent;
};

const buildUpstreamProxyAgent = (
  proxyReqOpts: Omit<RequestOptions, 'headers'> & {
    headers: OutgoingHttpHeaders;
  },
) => {
  const { enabled, url, noProxy } = getUpstreamProxyConfig();

  const proxyUrl = url || getEnvProxyUrl();

  // If enabled is not existant or false
  if (enabled === undefined || enabled === false || !proxyUrl) {
    return undefined;
  }

  const host: string | null | undefined = proxyReqOpts.host || proxyReqOpts.hostname;

  const combinedNoProxy = [...(noProxy || []), ...getEnvNoProxyList()];

  if (hostMatchesNoProxy(host, combinedNoProxy)) {
    return undefined;
  }

  return getOrCreateProxyAgent(proxyUrl);
};

const proxyReqOptDecorator: ProxyOptions['proxyReqOptDecorator'] = (proxyReqOpts, _srcReq) => {
  const agent = buildUpstreamProxyAgent(proxyReqOpts);

  if (!agent) {
    return proxyReqOpts;
  }

  return {
    ...proxyReqOpts,
    agent,
  };
};

const proxyReqBodyDecorator: ProxyOptions['proxyReqBodyDecorator'] = (bodyContent, srcReq) => {
  if (srcReq.method === 'GET') {
    return '';
  }
  return bodyContent;
};

const proxyErrorHandler: ProxyOptions['proxyErrorHandler'] = (err, _res, next) => {
  console.log(`ERROR=${err}`);
  next(err);
};

const isPackPost = (req: Request) =>
  req.method === 'POST' &&
  /^(?:\/[^/]+)*\/[^/]+\.git\/(?:git-upload-pack|git-receive-pack)$/.test(req.url);

const extractRawBody = async (req: Request, res: Response, next: NextFunction) => {
  if (!isPackPost(req)) {
    return next();
  }

  const proxyStream = new PassThrough({
    highWaterMark: 4 * MEGABYTE,
  });
  const pluginStream = new PassThrough({
    highWaterMark: 4 * MEGABYTE,
  });

  req.pipe(proxyStream);
  req.pipe(pluginStream);

  try {
    const buf = await getRawBody(pluginStream, { limit: getMaxPackSizeBytes() });
    req.bodyRaw = buf;
    req.pipe = (dest, opts) => proxyStream.pipe(dest, opts);
    next();
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error(error.message);
      proxyStream.destroy(error);
    } else {
      console.error(String(error));
      proxyStream.destroy(new Error(String(error)));
    }
    res.status(500).end('Proxy error');
  }
};

const isReceivePackPost = (req: Request): boolean =>
  isPackPost(req) && req.url.endsWith('/git-receive-pack');

/**
 * Finish a response that has already started streaming sideband progress
 * @param {Response} res The in-progress streaming response
 * @param {string} message The final message to display in the client terminal
 * @param {Buffer} [statusReport] Optional synthesized band-1 report-status,
 * written before the final flush so the client ends the session cleanly.
 */
const endStreamedResponseWithMessage = (
  res: Response,
  message: string,
  statusReport?: Buffer,
): void => {
  if (res.writableEnded) {
    return;
  }
  res.write(encodeSidebandChunk(SidebandBand.Progress, `\t${message}\n`));
  if (statusReport) {
    res.write(statusReport);
  }
  res.write(FLUSH_PACKET);
  res.end();
};

/**
 * Resolve the upstream URL for a request
 * @param {Request} req The client request.
 * @param {string[]} originsToProxy Origins configured for proxying.
 * @return {URL} The full upstream URL to forward the request to.
 */
const resolveUpstreamUrl = (req: Request, originsToProxy: string[]): URL => {
  const originalUrl = req.originalUrl || '/';

  for (const origin of originsToProxy) {
    const prefix = `/${origin}`;
    if (originalUrl === prefix || originalUrl.startsWith(`${prefix}/`)) {
      const upstreamBase = new URL(`https://${origin}`);
      const strippedPathAndQuery = originalUrl.slice(prefix.length) || '/';
      const safeRelative =
        strippedPathAndQuery.startsWith('/') && !strippedPathAndQuery.startsWith('//')
          ? strippedPathAndQuery
          : `/${strippedPathAndQuery.replace(/^\/+/, '')}`;
      return new URL(safeRelative, upstreamBase);
    }
  }

  // fallback (legacy URLs without an origin prefix)
  const safeFallbackRelative =
    originalUrl.startsWith('/') && !originalUrl.startsWith('//')
      ? originalUrl
      : `/${originalUrl.replace(/^\/+/, '')}`;
  return new URL(safeFallbackRelative, 'https://github.com');
};

/** Headers that must not be forwarded verbatim to the upstream host.
 * accept-encoding is stripped so the upstream response is not compressed,
 * allowing it to be piped into an already-started sideband stream. */
const UPSTREAM_HEADER_BLOCKLIST = [
  'host',
  'connection',
  'content-length',
  'transfer-encoding',
  'accept-encoding',
  'upgrade',
  'keep-alive',
  'proxy-authorization',
  'te',
  'trailer',
];

/**
 * Forward a buffered git-receive-pack request to the upstream host and relay
 * the response to the client.
 *
 * When the response has already started streaming sideband progress, the
 * upstream response body (itself a sideband pkt-line stream) is piped through
 * verbatim, continuing the stream the proxy started. Otherwise the upstream
 * status and headers are copied and the body piped, matching the behavior of
 * the transparent proxy.
 * @param {Request} req The client request (body must be a Buffer).
 * @param {Response} res The client response.
 * @param {URL} target The upstream URL to forward to.
 * @param {Buffer} [failureStatusReport] Optional synthesized band-1 report-status
 * appended when upstream fails after streaming started.
 * @return {Promise<void>} Resolves when the upstream response has been relayed.
 */
const forwardReceivePackUpstream = async (
  req: Request,
  res: Response,
  target: URL,
  failureStatusReport?: Buffer,
): Promise<void> => {
  if (!Buffer.isBuffer(req.body)) {
    res.status(400).send('Bad request');
    return;
  }
  const body: Buffer = req.body;
  const client = target.protocol === 'http:' ? http : https;

  const headers: OutgoingHttpHeaders = {};
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined || UPSTREAM_HEADER_BLOCKLIST.includes(key.toLowerCase())) {
      continue;
    }
    headers[key] = value;
  }
  headers['content-length'] = body.length;

  const agent =
    target.protocol === 'https:'
      ? buildUpstreamProxyAgent({ host: target.hostname, headers })
      : undefined;

  await new Promise<void>((resolve, reject) => {
    const upstreamReq = client.request(
      target,
      { method: 'POST', headers, ...(agent ? { agent } : {}) },
      (upstreamRes) => {
        upstreamRes.on('error', reject);
        upstreamRes.on('end', resolve);

        if (res.headersSent) {
          if (upstreamRes.statusCode !== 200) {
            upstreamRes.resume();
            endStreamedResponseWithMessage(
              res,
              `Push failed: upstream responded with status ${upstreamRes.statusCode}`,
              failureStatusReport,
            );
            return;
          }
          upstreamRes.pipe(res);
        } else {
          // No streaming took place so we just relay everything as is
          res.status(upstreamRes.statusCode ?? 502);
          for (const [key, value] of Object.entries(upstreamRes.headers)) {
            if (key === 'transfer-encoding' || key === 'connection' || value === undefined) {
              continue;
            }
            res.set(key, value);
          }
          upstreamRes.pipe(res);
        }
      },
    );
    upstreamReq.on('error', reject);
    upstreamReq.end(body);
  });
};

/**
 * Create the request handler for git-receive-pack POSTs (pushes).
 *
 * Unlike other git requests, pushes are handled directly rather than through
 * express-http-proxy so that validation progress can be streamed to the
 * client via git sideband channel 2 while the chain runs. When the
 * sidebandProgress config flag is disabled, the handler defers to the
 * transparent proxy (identical behavior to previous releases).
 * @param {string[]} originsToProxy Origins configured for proxying.
 * @return {RequestHandler} The express request handler.
 */
const createReceivePackHandler = (originsToProxy: string[]): RequestHandler => {
  return async (req, res, next) => {
    if (!isReceivePackPost(req) || !getSidebandProgressEnabled()) {
      return next();
    }

    let action: Action | undefined;
    try {
      const urlComponents = processUrlPath(req.url);
      if (
        !urlComponents ||
        urlComponents.gitPath === undefined ||
        !validGitRequest(urlComponents.gitPath, req.headers)
      ) {
        const message = 'Invalid request received';
        logAction(req.url, req.headers.host, req.headers['user-agent'], ActionType.ERROR, message);
        res.status(200).send(handleMessage(message));
        return;
      }

      // Use the raw body extracted by the extractRawBody middleware
      if (req.bodyRaw) {
        req.body = req.bodyRaw;
        delete req.bodyRaw;
      }

      action = await executeChain(req, res);

      if (action.error || action.blocked) {
        const message = action.errorMessage ?? action.blockedMessage ?? 'Unknown error';
        const type = action.error ? ActionType.ERROR : ActionType.BLOCKED;
        const statusReport = buildRejectionReportStatus(action, rejectionReasonFor(action));

        logAction(req.url, req.headers.host, req.headers['user-agent'], type, message);
        if (res.headersSent) {
          endStreamedResponseWithMessage(res, message, statusReport);
        } else {
          sendErrorResponse(req, res, message, statusReport);
        }
        return;
      }

      logAction(req.url, req.headers.host, req.headers['user-agent'], ActionType.ALLOWED);
      await forwardReceivePackUpstream(
        req,
        res,
        resolveUpstreamUrl(req, originsToProxy),
        buildRejectionReportStatus(action, 'upstream error'),
      );
    } catch (error: unknown) {
      const message = handleErrorAndLog(error, 'Error processing git-receive-pack request');
      const statusReport = buildRejectionReportStatus(action, 'internal error');

      logAction(req.url, req.headers.host, req.headers['user-agent'], ActionType.ERROR, message);
      if (res.headersSent) {
        endStreamedResponseWithMessage(res, message, statusReport);
      } else {
        sendErrorResponse(req, res, message, statusReport);
      }
    }
  };
};

const getRouter = async () => {
  const router = Router();
  router.use(extractRawBody);

  const originsToProxy = await getAllProxiedHosts();
  const proxyKeys: string[] = [];
  const proxies: RequestHandler[] = [];

  console.log(`Initializing proxy router for origins: '${JSON.stringify(originsToProxy)}'`);

  // Pushes are handled by a dedicated route instead of express-http-proxy
  // to stream sidebandProgress if enabled
  router.use(createReceivePackHandler(originsToProxy));

  // we need to wrap multiple proxy middlewares in a custom middleware as middlewares
  // with path are processed in descending path order (/ then /github.com etc.) and
  // we want the fallback proxy to go last.
  originsToProxy.forEach((origin) => {
    console.log(`\tsetting up origin: '${origin}'`);

    proxyKeys.push(`/${origin}/`);
    proxies.push(
      proxy('https://' + origin, {
        parseReqBody: false,
        preserveHostHdr: false,
        filter: proxyFilter,
        proxyReqPathResolver: getRequestPathResolver('https://'), // no need to add host as it's in the URL
        proxyReqOptDecorator: proxyReqOptDecorator,
        proxyReqBodyDecorator: proxyReqBodyDecorator,
        proxyErrorHandler: proxyErrorHandler,
        stream: true,
      } as any),
    );
  });

  console.log('\tsetting up catch-all route (github.com) for backwards compatibility');
  const fallbackProxy: RequestHandler = proxy('https://github.com', {
    parseReqBody: false,
    preserveHostHdr: false,
    filter: proxyFilter,
    proxyReqPathResolver: getRequestPathResolver('https://github.com'),
    proxyReqOptDecorator: proxyReqOptDecorator,
    proxyReqBodyDecorator: proxyReqBodyDecorator,
    proxyErrorHandler: proxyErrorHandler,
    stream: true,
  } as any);

  console.log('proxy keys registered: ', JSON.stringify(proxyKeys));

  router.use('/', ((req, res, next) => {
    if (req.path === '/healthcheck') {
      res.set('Cache-Control', 'no-cache, no-store, must-revalidate, proxy-revalidate');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');
      res.set('Surrogate-Control', 'no-store');
      return res.status(200).send('OK');
    }

    console.log(
      `processing request URL: '${req.url}' against registered proxy keys: ${JSON.stringify(proxyKeys)}`,
    );

    for (let i = 0; i < proxyKeys.length; i++) {
      if (req.url.startsWith(proxyKeys[i])) {
        console.log(`\tusing proxy ${proxyKeys[i]}`);
        return proxies[i](req, res, next);
      }
    }
    // fallback
    console.log(`\tusing fallback`);
    return fallbackProxy(req, res, next);
  }) as RequestHandler);
  return router;
};

export {
  proxyFilter,
  getRouter,
  handleMessage,
  handleRefsErrorMessage,
  handleErrPacket,
  isPackPost,
  isReceivePackPost,
  extractRawBody,
  validGitRequest,
  buildUpstreamProxyAgent,
  hostMatchesNoProxy,
  getOrCreateProxyAgent,
  createReceivePackHandler,
  resolveUpstreamUrl,
  forwardReceivePackUpstream,
  endStreamedResponseWithMessage,
};
