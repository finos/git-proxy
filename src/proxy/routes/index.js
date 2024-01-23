/* eslint-disable max-len */
const express = require('express');
const proxy = require('express-http-proxy');
// eslint-disable-next-line new-cap
const router = express.Router();
const chain = require('../chain');

/**
 * Check whether an HTTP request matches the list of permitted User-Agent strings.
 * @param {string} agent the User-Agent string from the http request
 * @return {boolean} whether the User-Agent is allowed
 */
const allowedUserAgent = (agent) => {
  return agent.startsWith('git/');
};

/**
 * As part of content negotiation, the client sends an Accept header to indicate
 * the media types it understands. This function checks whether the media type
 * is allowed.
 * @param {string} contentType Received media type from the request Accept header
 * @return {boolean} Whether the media type is allowed
 */
const allowedContentType = (contentType) => {
  return contentType.startsWith('application/x-git-');
};

/**
 * Test whether the request URL is allowed for proxying.
 * @param {string} url the request URL (path)
 * @return {boolean} whether the URL is allowed
 */
const allowedUrl = (url) => {
  const safePaths = [
    '/info/refs?service=git-upload-pack',
    '/info/refs?service=git-receive-pack',
    '/git-upload-pack',
    '/git-receive-pack',
  ];
  const parts = url.split('/');
  if (
    (parts.length === 4 || parts.length === 5) &&
    Boolean(safePaths.find((path) => url.endsWith(path)))
  ) {
    return true;
  }
  return false;
};

router.use(
  '/',
  proxy('https://github.com', {
    filter: async function (req, res) {
      try {
        console.log(req.url);
        console.log('recieved');
        if (
          !(
            allowedUserAgent(req.headers['user-agent']) &&
            allowedUrl(req.url) &&
            allowedContentType(req.headers['content-type'])
          )
        ) {
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
  allowedContentType,
  allowedUrl,
  allowedUserAgent,
};
