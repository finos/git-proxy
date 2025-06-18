import { Router } from 'express';
import proxy from 'express-http-proxy';
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
      res.set('transfer-encoding', 'chunked');
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
  const errorMessage = `\t${message}`;
  const len = 6 + new TextEncoder().encode(errorMessage).length;
  const prefix = len.toString(16);
  const packetMessage = `${prefix.padStart(4, '0')}\x02${errorMessage}\n0000`;
  return packetMessage;
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

const getRouter = async () => {
  // eslint-disable-next-line new-cap
  const router = Router();

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

export { getRouter, handleMessage, validGitRequest };
