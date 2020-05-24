const proxy = require('express-http-proxy');
const app = require('express')();
const https = require('https');
const bodyParser = require('body-parser');
const fs = require('fs');
const chain = require('./lib/chain.js');
const httpPort = 3000;
const httpsPort = 3001;

const options = {
  inflate: true,
  limit: '100000kb',
  type: '*/*',
};

app.use(bodyParser.raw(options));

app.use('/', proxy('https://github.com', {
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

      //const message = '001f# service=git-receive-pack\nERR 1234\n0000';

      const message = '0011\x02ERR problem';

      res.status(403).send(message);

      fs.writeFileSync(
          `./.logs/responses/${ts}.USER.${res.statusCode}.status`,
          res.statusCode);

      fs.writeFileSync(
          `./.logs/responses/${ts}.USER.headers.json`,
          JSON.stringify(res.getHeaders()));

      fs.writeFileSync(
          `./.logs/responses/${ts}.USER.raw`,
          res.body);

      return false;
    }

    return true;
  },
  userResDecorator: function(proxyRes, proxyResData, userReq, userRes) {
    const data = proxyResData;
    const ts = Date.now();

    fs.writeFileSync(
        `./.logs/responses/${ts}.${proxyRes.statusCode}.status`,
        proxyRes.statusCode);

    fs.writeFileSync(
        `./.logs/responses/${ts}.headers.json`,
        JSON.stringify(proxyRes.headers));

    fs.writeFileSync(
        `./.logs/responses/${ts}.raw`,
        data);

    fs.writeFileSync(
        `./.logs/responses/${ts}.txt`,
        data.toString('utf-8'));

    return proxyResData;
  },
}));

app.listen(httpPort, () => {
  console.log(`Listening on ${httpPort}`);
});

https.createServer({
  key: fs.readFileSync('./resources/server.key'),
  cert: fs.readFileSync('./resources/server.cert'),
}, app).listen(httpsPort, function() {
  console.log(`Listening on ${httpsPort}`);
});
