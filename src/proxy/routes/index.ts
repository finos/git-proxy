import { Router, Request, Response, NextFunction, RequestHandler } from 'express';
import proxy from 'express-http-proxy';
import { PassThrough } from 'stream';
import getRawBody from 'raw-body';
import { executeChain } from '../chain';
import { processUrlPath, validGitRequest, getAllProxiedHosts } from './helper';
import { ProxyOptions } from 'express-http-proxy';

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
    if (isPackPost(req) && (req as any).bodyRaw) {
      (req as any).body = (req as any).bodyRaw;
      // Clean up the bodyRaw property before forwarding the request
      delete (req as any).bodyRaw;
    }

    const action = await executeChain(req, res);

    if (action.error || action.blocked) {
      const message = action.errorMessage ?? action.blockedMessage ?? 'Unknown error';
      const type = action.error ? ActionType.ERROR : ActionType.BLOCKED;

      logAction(req.url, req.headers.host, req.headers['user-agent'], type, message);
      sendErrorResponse(req, res, message);
      return false;
    }

    logAction(req.url, req.headers.host, req.headers['user-agent'], ActionType.ALLOWED);

    // this is the only case where we do not respond directly, instead we return true to proxy the request
    return true;
  } catch (e) {
    const message = `Error occurred in proxy filter function ${(e as Error).message ?? e}`;

    logAction(req.url, req.headers.host, req.headers['user-agent'], ActionType.ERROR, message);
    sendErrorResponse(req, res, message);
    return false;
  }
};

const sendErrorResponse = (req: Request, res: Response, message: string): void => {
  // GET requests to /info/refs (used to check refs for many git operations) must use Git protocol error packet format
  if (req.method === 'GET' && req.url.includes('/info/refs')) {
    res.set('content-type', 'application/x-git-upload-pack-advertisement');
    res.status(200).send(handleRefsErrorMessage(message));
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

  res.status(200).send(handleMessage(message));
};

const handleMessage = (message: string): string => {
  const body = `\t${message}`;
  const len = (6 + Buffer.byteLength(body)).toString(16).padStart(4, '0');
  return `${len}\x02${body}\n0000`;
};

const handleRefsErrorMessage = (message: string): string => {
  // Git protocol for GET /info/refs error packets: PKT-LINE("ERR" SP explanation-text)
  const errorBody = `ERR ${message}`;
  const len = (4 + Buffer.byteLength(errorBody)).toString(16).padStart(4, '0');
  return `${len}${errorBody}\n0000`;
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

const proxyReqOptDecorator: ProxyOptions['proxyReqOptDecorator'] = (proxyReqOpts) => proxyReqOpts;

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
    highWaterMark: 4 * 1024 * 1024,
  });
  const pluginStream = new PassThrough({
    highWaterMark: 4 * 1024 * 1024,
  });

  req.pipe(proxyStream);
  req.pipe(pluginStream);

  try {
    const buf = await getRawBody(pluginStream, { limit: '1gb' });
    (req as any).bodyRaw = buf;
    (req as any).pipe = (dest: any, opts: any) => proxyStream.pipe(dest, opts);
    next();
  } catch (e) {
    console.error(e);
    proxyStream.destroy(e as Error);
    res.status(500).end('Proxy error');
  }
};

const getRouter = async () => {
  const router = Router();
  router.use(extractRawBody);

  const originsToProxy = await getAllProxiedHosts();
  const proxyKeys: string[] = [];
  const proxies: RequestHandler[] = [];

  console.log(`Initializing proxy router for origins: '${JSON.stringify(originsToProxy)}'`);

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
  isPackPost,
  extractRawBody,
  validGitRequest,
};
