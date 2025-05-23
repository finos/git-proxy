import { Router } from 'express';
import proxy from 'express-http-proxy';
import { executeChain } from '../chain';
import { getProxyUrl } from '../../config';

// eslint-disable-next-line new-cap
const router = Router();

/**
 * For a given Git HTTP request destined for a GitHub repo,
 * remove the GitHub specific components of the URL.
 * @param {string} url URL path of the request
 * @return {string} Modified path which removes the {owner}/{repo} parts
 */
const stripGitHubFromGitPath = (url: string): string | undefined => {
  const parts = url.split('/');
  // url = '/{owner}/{repo}.git/{git-path}'
  // url.split('/') = ['', '{owner}', '{repo}.git', '{git-path}']
  if (parts.length !== 4 && parts.length !== 5) {
    console.error('unexpected url received: ', url);
    return undefined;
  }
  parts.splice(1, 2); // remove the {owner} and {repo} from the array
  return parts.join('/');
};

/**
 * Check whether an HTTP request has the expected properties of a
 * Git HTTP request. The URL is expected to be "sanitized", stripped of
 * specific paths such as the GitHub {owner}/{repo}.git parts.
 * @param {string} url Sanitized URL which only includes the path specific to git
 * @param {*} headers Request headers (TODO: Fix JSDoc linting and refer to node:http.IncomingHttpHeaders)
 * @return {boolean} If true, this is a valid and expected git request. Otherwise, false.
 */
const validGitRequest = (url: string, headers: any): boolean => {
  const { 'user-agent': agent, accept } = headers;
  if (!agent) {
    return false;
  }
  if (['/info/refs?service=git-upload-pack', '/info/refs?service=git-receive-pack'].includes(url)) {
    // https://www.git-scm.com/docs/http-protocol#_discovering_references
    // We can only filter based on User-Agent since the Accept header is not
    // sent in this request
    return agent.startsWith('git/');
  }
  if (['/git-upload-pack', '/git-receive-pack'].includes(url)) {
    if (!accept) {
      return false;
    }
    // https://www.git-scm.com/docs/http-protocol#_uploading_data
    return agent.startsWith('git/') && accept.startsWith('application/x-git-') ;
  }
  return false;
};

router.use(
  '/',
  proxy(getProxyUrl(), {
    preserveHostHdr: false,
    filter: async function (req, res) {
      try {
        console.log('request url: ', req.url);
        console.log('host: ', req.headers.host);
        console.log('user-agent: ', req.headers['user-agent']);
        const gitPath = stripGitHubFromGitPath(req.url);
        if (gitPath === undefined || !validGitRequest(gitPath, req.headers)) {
          res.status(400).send('Invalid request received');
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
        console.error(e);
        return false;
      }
    },
    proxyReqPathResolver: (req) => {
      const url = getProxyUrl() + req.originalUrl;
      console.log('Sending request to ' + url);
      return url;
    },
    proxyReqOptDecorator: function (proxyReqOpts) {
      return proxyReqOpts;
    },

    proxyReqBodyDecorator: function (bodyContent, srcReq) {
      if (srcReq.method === 'GET') {
        return '';
      }
      return bodyContent;
    },

    proxyErrorHandler: function (err, res, next) {
      console.log(`ERROR=${err}`);
      next(err);
    },
  }),
);

const handleMessage = (message: string): string => {
  const errorMessage = `\t${message}`;
  const len = 6 + new TextEncoder().encode(errorMessage).length;

  const prefix = len.toString(16);
  const packetMessage = `${prefix.padStart(4, '0')}\x02${errorMessage}\n0000`;
  return packetMessage;
};

export {
  router,
  handleMessage,
  validGitRequest,
  stripGitHubFromGitPath,
};
