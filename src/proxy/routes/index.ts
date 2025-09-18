import { Router, Request, Response, NextFunction, RequestHandler } from 'express';
import proxy from 'express-http-proxy';
import { PassThrough } from 'stream';
import getRawBody from 'raw-body';
import { executeChain } from '../chain';
import { processUrlPath, validGitRequest, getAllProxiedHosts } from './helper';
import { ProxyOptions } from 'express-http-proxy';

const logAction = (
  url: string,
  host: string | null | undefined,
  userAgent: string | null | undefined,
  errMsg: string | null | undefined,
  blockMsg?: string | null | undefined,
) => {
  let msg = `Action processed: ${!(errMsg || blockMsg) ? 'Allowed' : 'Blocked'}
    Request URL: ${url}
    Host:        ${host}
    User-Agent:  ${userAgent}`;
  if (errMsg) {
    msg += `\n    Error:       ${errMsg}`;
  }
  if (blockMsg) {
    msg += `\n    Blocked:     ${blockMsg}`;
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
      logAction(
        req.url,
        req.headers.host,
        req.headers['user-agent'],
        'Invalid request received',
        null,
      );
      // return status 200 to ensure that the error message is rendered by the git client
      res.status(200).send(handleMessage('Invalid request received'));
      return false;
    }

    const action = await executeChain(req, res);

    if (action.error || action.blocked) {
      const errorMessage = action.errorMessage ?? action.blockedMessage ?? '';
      sendErrorResponse(req, res, errorMessage, action.blockedMessage);
      return false;
    }

    logAction(
      req.url,
      req.headers.host,
      req.headers['user-agent'],
      action.errorMessage,
      action.blockedMessage,
    );

    // this is the only case where we do not respond directly, instead we return true to proxy the request
    return true;
  } catch (e) {
    const errorMessage = `Error occurred in proxy filter function ${(e as Error).message ?? e}`;

    sendErrorResponse(req, res, errorMessage, null);
    return false;
  }
};

const sendErrorResponse = (
  req: Request,
  res: Response,
  errorMessage: string,
  actionBlockedMessage: string | null | undefined,
): void => {
  // GET requests to /info/refs (used to check refs for many git operations) must use Git protocol error packet format
  if (req.method === 'GET' && req.url.includes('/info/refs')) {
    res.set('content-type', 'application/x-git-upload-pack-advertisement');

    logAction(
      req.url,
      req.headers.host,
      req.headers['user-agent'],
      errorMessage,
      actionBlockedMessage,
    );

    // Use Git protocol error packet format
    res.status(200).send(handleRefsErrorMessage(errorMessage));
    return;
  }

  res.set('content-type', 'application/x-git-receive-pack-result');
  res.set('expires', 'Fri, 01 Jan 1980 00:00:00 GMT');
  res.set('pragma', 'no-cache');
  res.set('cache-control', 'no-cache, max-age=0, must-revalidate');
  res.set('vary', 'Accept-Encoding');
  res.set('x-frame-options', 'DENY');
  res.set('connection', 'close');

  const packetMessage = handleMessage(errorMessage);

  logAction(
    req.url,
    req.headers.host,
    req.headers['user-agent'],
    errorMessage,
    actionBlockedMessage,
  );

  // return status 200 to ensure that the error message is rendered by the git client
  res.status(200).send(packetMessage);
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

const proxyErrorHandler: ProxyOptions['proxyErrorHandler'] = (err, res, next) => {
  console.log(`ERROR=${err}`);
  next(err);
};

const isPackPost = (req: Request) =>
  req.method === 'POST' &&
  /^(?:\/[^/]+)*\/[^/]+\.git\/(?:git-upload-pack|git-receive-pack)$/.test(req.url);

const teeAndValidate = async (req: Request, res: Response, next: NextFunction) => {
  if (!isPackPost(req)) {
    return next();
  }

  const proxyStream = new PassThrough();
  const pluginStream = new PassThrough();

  req.pipe(proxyStream);
  req.pipe(pluginStream);

  try {
    const buf = await getRawBody(pluginStream, { limit: '1gb' });
    (req as any).body = buf;
    const verdict = await executeChain(req, res);
    if (verdict.error || verdict.blocked) {
      const msg = verdict.errorMessage ?? verdict.blockedMessage ?? '';

      logAction(
        req.url,
        req.headers?.host,
        req.headers?.['user-agent'],
        verdict.errorMessage,
        verdict.blockedMessage,
      );

      res
        .set({
          'content-type': 'application/x-git-receive-pack-result',
          expires: 'Fri, 01 Jan 1980 00:00:00 GMT',
          pragma: 'no-cache',
          'cache-control': 'no-cache, max-age=0, must-revalidate',
          vary: 'Accept-Encoding',
          'x-frame-options': 'DENY',
          connection: 'close',
        })
        .status(200) // return status 200 to ensure that the error message is rendered by the git client
        .send(handleMessage(msg));
      return;
    }

    (req as any).pipe = (dest: any, opts: any) => proxyStream.pipe(dest, opts);
    next();
  } catch (e) {
    console.error(e);
    proxyStream.destroy(e as Error);
    res.status(500).end('Proxy error');
  }
};

const getRouter = async () => {
  // eslint-disable-next-line new-cap
  const router = Router();
  router.use(teeAndValidate);

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
      }),
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
  });

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
  teeAndValidate,
  validGitRequest,
};
