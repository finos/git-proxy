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

    const result = chain.exec(req);

    console.log(JSON.stringify(result));

    if (!result.ok) {
      return false;
    }

    return true;
  },
}));

app.listen(httpPort, () => {
  console.log(`Listening on ${httpPort}`);
});

https.createServer({
  key: fs.readFileSync('server.key'),
  cert: fs.readFileSync('server.cert'),
}, app).listen(httpsPort, function() {
  console.log(`Listening on ${httpsPort}`);
});
