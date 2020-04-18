const proxy = require('express-http-proxy');
const app = require('express')();
const https = require('https');
const bodyParser = require('body-parser');
const fs = require('fs');
const httpPort = 3000;
const httpsPort = 3001;

const options = {
  inflate: true,
  limit: '2048kb',
  type: '*/*',
};

app.use(bodyParser.raw(options));

app.use('/', proxy('https://github.com', {
  filter: function(req, res) {
    const headers = JSON.stringify(req.headers);
    const body = req.body;
    console.log(body);

    if (body && body.length) {
      req.rawBody = body.toString('utf8');
    }

    console.log(req.originalUrl);
    console.log(headers);
    console.log(`body=${req.rawBody}`);
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
