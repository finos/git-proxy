const app = require('express')();
const https = require('https');
const bodyParser = require('body-parser');
const fs = require('fs');
const proxyMiddleware = require('./lib/proxy')
const httpPort = 3000;
const httpsPort = 3001;

const options = {
  inflate: true,
  limit: '100000kb',
  type: '*/*',
};

app.use(bodyParser.raw(options));
app.use('/', proxyMiddleware);


app.listen(httpPort, () => {
  console.log(`Listening on ${httpPort}`);
});

https.createServer(
    {
      key: fs.readFileSync('./resources/server.key'),
      cert: fs.readFileSync('./resources/server.cert'),
    }, app).listen(httpsPort, function() {
  console.log(`Listening on ${httpsPort}`);
});
