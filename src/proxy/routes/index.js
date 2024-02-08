const express = require('express');
const proxy = require('express-http-proxy');
const router = new express.Router();
const chain = require('../chain');
const config = require('../../config');

if (config.getAllowSelfSignedCert()) {
  process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = 0;
}

router.use(
  '/',
  proxy(config.getProxyUrl(), {
    preserveHostHdr: false,
    filter: async function (req, res) {
      try {
        console.log('received');
        console.log(req.hostname);
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

          packetMessage = handleMessage(message);

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
      const url = config.getProxyUrl() + req.originalUrl;
      console.log('Sending request to ' + url);
      return url;
    },
    proxyReqOptDecorator: function (proxyReqOpts, srcReq) {
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

const handleMessage = async(message) => {
  const errorMessage = `ERR\t${message}`;
  const len = 6 + new TextEncoder().encode(errorMessage).length;

  const prefix = len.toString(16);
  const packetMessage = `${prefix.padStart(4, '0')}\x02${errorMessage}\n0000`;
  return packetMessage
}

module.exports = {router, handleMessage};
