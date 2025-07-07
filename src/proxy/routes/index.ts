import { Router, Request, Response, NextFunction } from 'express';
import proxy from 'express-http-proxy';
import { PassThrough } from 'stream';
import getRawBody from 'raw-body';
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
    return agent.startsWith('git/') && accept.startsWith('application/x-git-');
  }
  return false;
};

// function to convert SSH URL to HTTPS
const convertSshToHttps = (url: string) => {
  // Handle SSH URLs in the format git@host:path
  const sshRegex = /^git@([^:]+):(.+)$/;
  const match = url.match(sshRegex);

  if (match) {
    const [, host, path] = match;
    return `https://${host}/${path}`;
  }

  return url;
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

router.use(teeAndValidate);

router.use(
  '/',
  proxy(getProxyUrl(), {
    parseReqBody: false,
    preserveHostHdr: false,

    filter: async (req, res) => {
      console.log('request url: ', req.url);
      console.log('host: ', req.headers.host);
      console.log('user-agent: ', req.headers['user-agent']);
      const gitPath = stripGitHubFromGitPath(req.url);
      if (gitPath === undefined || !validGitRequest(gitPath, req.headers)) {
        res.status(400).send('Invalid request received');
        return false;
      }
      return true;
    },

    proxyReqPathResolver: (req) => {
      const url = getProxyUrl() + req.originalUrl;
      console.log('Sending request to ' + url);
      return url;
    },
    proxySSHReqPathResolver: (req) => {
      const url = convertSshToHttps(getProxyUrl()) + req.originalUrl;
      console.log('Sending request to ' + url);
      return url;
    },
    proxyReqOptDecorator: function (proxyReqOpts) {
      return proxyReqOpts;
    },

    proxyErrorHandler: (err, res, next) => {
      console.log(`ERROR=${err}`);
      next(err);
    },
  }),
);

const handleMessage = (message: string): string => {
  const body = `\t${message}`;
  const len = (6 + Buffer.byteLength(body)).toString(16).padStart(4, '0');
  return `${len}\x02${body}\n0000`;
};

export {
  router,
  handleMessage,
  validGitRequest,
  teeAndValidate,
  isPackPost,
  stripGitHubFromGitPath,
};
