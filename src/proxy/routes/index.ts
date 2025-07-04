import { Router, Request, Response, NextFunction } from 'express';
import proxy from 'express-http-proxy';
import { PassThrough } from 'stream';
import getRawBody from 'raw-body';
import { executeChain } from '../chain';
import { processUrlPath, validGitRequest, getAllProxiedHosts } from './helper';
import { ProxyOptions } from 'express-http-proxy';

const proxyFilter: ProxyOptions['filter'] = async (req, res) => {
  try {
    console.log('request url: ', req.url);
    console.log('host: ', req.headers.host);
    console.log('user-agent: ', req.headers['user-agent']);

    const urlComponents = processUrlPath(req.url);

    if (
      !urlComponents ||
      urlComponents.gitPath === undefined ||
      !validGitRequest(urlComponents.gitPath, req.headers)
    ) {
      res.status(400).send('Invalid request received');
      console.log('action blocked');
      return false;
    }

    const action = await executeChain(req, res);
    console.log('action processed');

    if (action.error || action.blocked) {
      res.set('content-type', 'application/x-git-receive-pack-result');
      res.set('expires', 'Fri, 01 Jan 1980 00:00:00 GMT');
      res.set('pragma', 'no-cache');
      res.set('cache-control', 'no-cache, max-age=0, must-revalidate');
      res.set('vary', 'Accept-Encoding');
      res.set('x-frame-options', 'DENY');
      res.set('connection', 'close');

      let message = '';

      if (action.error) {
        message = action.errorMessage!;
        console.error(message);
      }
      if (action.blocked) {
        message = action.blockedMessage!;
      }

      const packetMessage = handleMessage(message);

      console.log(req.headers);

      res.status(200).send(packetMessage);

      return false;
    }

    return true;
  } catch (e) {
    console.error('Error occurred in proxy filter function ', e);
    return false;
  }
};

const handleMessage = (message: string): string => {
  const body = `\t${message}`;
  const len = (6 + Buffer.byteLength(body)).toString(16).padStart(4, '0');
  return `${len}\x02${body}\n0000`;
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

    console.log(`Sending request to ${url}`);
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
  // eslint-disable-next-line no-useless-escape
  /^\/[^\/]+\/[^\/]+\.git\/(?:git-upload-pack|git-receive-pack)$/.test(req.url);

const teeAndValidate = async (req: Request, res: Response, next: NextFunction) => {
  if (!isPackPost(req)) return next();

  const proxyStream = new PassThrough();
  const pluginStream = new PassThrough();

  req.pipe(proxyStream);
  req.pipe(pluginStream);

  try {
    const buf = await getRawBody(pluginStream, { limit: '1gb' });
    (req as any).body = buf;
    const verdict = await executeChain(req, res);
    console.log('action processed');
    if (verdict.error || verdict.blocked) {
      let msg = '';

      if (verdict.error) {
        msg = verdict.errorMessage!;
        console.error(msg);
      }
      if (verdict.blocked) {
        msg = verdict.blockedMessage!;
      }

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
        .status(200)
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
  console.log(
    `Initializing proxy router for origins: '${JSON.stringify(originsToProxy, null, 2)}'`,
  );
  // Middlewares are processed in the order that they are added, if one applies and then doesn't call `next` then subsequent ones are not applied.
  // Hence, we define known origins first, then a catch all route for backwards compatibility
  originsToProxy.forEach((origin) => {
    console.log(`\tsetting up origin: '${origin}'`);
    router.use(
      '/' + origin,
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

  // Catch-all route for backwards compatibility
  console.log('\tsetting up catch-all route (github.com) for backwards compatibility');
  router.use(
    '/',
    proxy('https://github.com', {
      parseReqBody: false,
      preserveHostHdr: false,
      filter: proxyFilter,
      proxyReqPathResolver: getRequestPathResolver('https://github.com'),
      proxyReqOptDecorator: proxyReqOptDecorator,
      proxyReqBodyDecorator: proxyReqBodyDecorator,
      proxyErrorHandler: proxyErrorHandler,
    }),
  );
  return router;
};

export { proxyFilter, getRouter, handleMessage, isPackPost, teeAndValidate, validGitRequest };
