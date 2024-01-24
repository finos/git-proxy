/* eslint-disable max-len */
const express = require('express');
const proxy = require('express-http-proxy');
// eslint-disable-next-line new-cap
const router = express.Router();
const chain = require('../chain');

/**
 * Check whether an HTTP request is a Git request. It is a Git request if it
 * matches one of the following:
 * - the URL path is a well-known Git endpoint
 * - the User-Agent starts with "git/"
 * - the Accept header starts with "application/x-git-" (for specific paths)
 * @param {express.Request} req Raw HTTP request
 * @return {boolean} Whether the request is a Git request
 */
const validGitRequest = (req) => {
  const { 'user-agent': agent, accept } = req.headers;
  const { url } = req;
  const parts = url.split('/');
  // only valid GitHub URLs are supported.
  // url = '/{owner}/{repo}.git/{git-path}'
  // url.split('/') = ['', '{owner}', '{repo}.git', '{git-path}']
  if (parts.length !== 4 && parts.length !== 5) {
    return false;
  }
  parts.splice(1, 2); // remove the {owner} and {repo} from the array
  const gitPath = parts.join('/');
  if (
    gitPath === '/info/refs?service=git-upload-pack' ||
    gitPath === '/info/refs?service=git-receive-pack'
  ) {
    // https://www.git-scm.com/docs/http-protocol#_discovering_references
    // We can only filter based on User-Agent since the Accept header is not
    // sent in this request
    return agent.startsWith('git/');
  }
  if (gitPath === '/git-upload-pack' || gitPath === '/git-receive-pack') {
    // https://www.git-scm.com/docs/http-protocol#_uploading_data
    return agent.startsWith('git/') && accept.startsWith('application/x-git-');
  }
  return false;
};

router.use(
  '/',
  proxy('https://github.com', {
    filter: async function (req, res) {
      try {
        console.log('request url: ', req.url);
        console.log('host: ', req.headers.host);
        console.log('user-agent: ', req.headers['user-agent']);
        if (!validGitRequest(req)) {
          res.status(400).send('Invalid request received');
          return false;
        }
        if (req.body && req.body.length) {
          req.rawBody = req.body.toString('utf8');
        }

        const action = await chain.exec(req, res);
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

          let message;

          if (action.error) {
            message = action.errorMessage;
            console.error(message);
          }
          if (action.blocked) {
            message = action.blockedMessage;
          }

          const packetMessage = handleMessage(message);

          res.status(200).send(packetMessage);

          return false;
        }

        return true;
      } catch (e) {
        console.error(e);
        return false;
      }
    },
    userResDecorator: function (proxyRes, proxyResData) {
      // const data = proxyResData;
      // const ts = Date.now();
      // fs.writeFileSync(`./.logs/responses/${ts}.${proxyRes.statusCode}.status`, proxyRes.statusCode);
      // fs.writeFileSync(`./.logs/responses/${ts}.headers.json`, JSON.stringify(proxyRes.headers));
      // fs.writeFileSync(`./.logs/responses/${ts}.raw`, data);
      // fs.writeFileSync(`./.logs/responses/${ts}.txt`, data.toString('utf-8'));
      return proxyResData;
    },
  }),
);

const handleMessage = async (message) => {
  const errorMessage = `ERR\t${message}`;
  const len = 6 + new TextEncoder().encode(errorMessage).length;

  const prefix = len.toString(16);
  const packetMessage = `${prefix.padStart(4, '0')}\x02${errorMessage}\n0000`;
  return packetMessage;
};

module.exports = {
  router,
  handleMessage,
  validGitRequest,
};
