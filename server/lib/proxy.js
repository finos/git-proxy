const express = require('express');
const proxy = require('express-http-proxy');
const router = express.Router();

router.use('/', proxy('https://github.com', {
  filter: function(req, res) {
    if (req.body && req.body.length) {
      req.rawBody = req.body.toString('utf8');
    }

    const result = chain.exec(req, res);

    console.log(JSON.stringify(result));

    if (!result.ok) {
      console.error('NOT OK!');
      const ts = Date.now();


      res.set('content-type', 'application/x-git-receive-pack-result');

      res.set('transfer-encoding', 'chunked');
      res.set('expires', 'Fri, 01 Jan 1980 00:00:00 GMT');
      res.set('pragma', 'no-cache');
      res.set('cache-control', 'no-cache, max-age=0, must-revalidate');
      res.set('vary', 'Accept-Encoding');
      res.set('x-frame-options', 'DENY');
      res.set('connection', 'close');

      result.message = `ERR\t${result.message}`;
      const len = 6 + result.message.length;
      const prefix = len.toString(16);

      const message = `00${prefix}\x02${result.message}\n0000`;

      console.log(message);

      res.status(200).send(message);

      return false;
    }

    return true;
  },
  userResDecorator: function(proxyRes, proxyResData) {
    const data = proxyResData;
    const ts = Date.now();

    fs.writeFileSync(`./.logs/responses/${ts}.${proxyRes.statusCode}.status`, proxyRes.statusCode);

    fs.writeFileSync(`./.logs/responses/${ts}.headers.json`, JSON.stringify(proxyRes.headers));

    fs.writeFileSync(`./.logs/responses/${ts}.raw`, data);

    fs.writeFileSync(`./.logs/responses/${ts}.txt`, data.toString('utf-8'));

    return proxyResData;
  }
}));


module.exports = router;