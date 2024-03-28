/* eslint-disable max-len */
const express = require('express');
const proxy = require('express-http-proxy');
// eslint-disable-next-line new-cap
const router = express.Router();
const chain = require('../chain');

const logger = require('../../../src/logging/logger');

/**
 * For a given Git HTTP request destined for a GitHub repo,
 * remove the GitHub specific components of the URL.
 * @param {string} url URL path of the request
 * @return {string} Modified path which removes the {owner}/{repo} parts
 */
const stripGitHubFromGitPath = (url) => {
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
const validGitRequest = (url, headers) => {
  const { 'user-agent': agent, accept } = headers;
  if (
    [
      '/info/refs?service=git-upload-pack',
      '/info/refs?service=git-receive-pack',
    ].includes(url)
  ) {
    // https://www.git-scm.com/docs/http-protocol#_discovering_references
    // We can only filter based on User-Agent since the Accept header is not
    // sent in this request
    return agent.startsWith('git/');
  }
  if (['/git-upload-pack', '/git-receive-pack'].includes(url)) {
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
        logger.info('request url: ', req.url);
        logger.log('host: ', req.headers.host);
        logger.info('user-agent: ', req.headers['user-agent']);
        const gitPath = stripGitHubFromGitPath(req.url);
        if (gitPath === undefined || !validGitRequest(gitPath, req.headers)) {
          res.status(400).send('Invalid request received');
          return false;
        }
        if (req.body && req.body.length) {
          req.rawBody = req.body.toString('utf8');
        }

        const action = await chain.exec(req, res);
        logger.info('action processed');

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
            logger.error(message);
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
        logger.error(e);
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
  stripGitHubFromGitPath,
};
