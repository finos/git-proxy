/* eslint-disable max-len */
const express = require('express');
const proxy = require('express-http-proxy');
const router = new express.Router();
const chain = require('../chain');
const config = require('../../config');

if (config.getAllowSelfSignedCert()) {
  process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = 0;
}


router.use('/', proxy(config.getProxyUrl(), {
  preserveHostHdr: true,
  filter: async function(req, res) {
    console.log(req.headers);
    try {
      console.log('recieved');
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

        // ERROR PCT LINE -- MOVE THIS TO HELPER
        const errorMessage = `ERR\t${message}`;
        const len = 6 + errorMessage.length;

        const prefix = len.toString(16);
        const packetMessage = `00${prefix}\x02${errorMessage}\n0000`;

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
  proxyReqOptDecorator: function(proxyReqOpts, srcReq) {
    // you can update headers
    if (proxyReqOpts.method === 'GET') {
      console.log('SETTING CONTENT LENGTH = 0');
    }
    // you can change the method
    // proxyReqOpts.method = 'GET';
    return proxyReqOpts;
  },

  proxyReqBodyDecorator: function(bodyContent, srcReq) {
    if (srcReq.method === 'GET') {
      console.log('SETTING GET BODY to NULL');
      return '';
    }
    return bodyContent;
  },

  proxyErrorHandler: function(err, res, next) {
    console.log(`ERROR=${err}`);
    next(err);
  },
}));

module.exports = router;
