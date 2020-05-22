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

      res.contentType = 'application/x-git-upload-pack-advertisement';

      message = '000bfoobar\n';

      message = Buffer.from(message, 'utf-8');
      res.status(400).send(message);
      return false;
    }

    return true;
  },
  userResDecorator: function(proxyRes, proxyResData, userReq, userRes) {
    const data = proxyResData;
    const ts = Date.now();

    fs.writeFileSync(`./.logs/responses/${ts}.headers`, proxyRes.headers);
    fs.writeFileSync(`./.logs/responses/${ts}.raw`, data);
    fs.writeFileSync(`./.logs/responses/${ts}.txt`, data.toString('utf-8'));

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
