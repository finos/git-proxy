const proxyApp = require('express')();
const serviceApp = require('express')();
const cors = require('cors')
const https = require('https');
const bodyParser = require('body-parser');
const fs = require('fs');
const server = require('./src')
const proxyHttpPort = 8000;
const proxyHttpsPort = 8001;
const servicePort = 8080;

const options = {
  inflate: true,
  limit: '100000kb',
  type: '*/*',
};

// Setup the proxy middleware
proxyApp.use(bodyParser.raw(options));
proxyApp.use('/', server.proxy);

// Setup the service middleware
serviceApp.use(cors());
serviceApp.use('/api/v1/', server.service);

// Start the proxy
proxyApp.listen(proxyHttpPort, () => {
  console.log(`Listening on ${proxyHttpPort}`);
});

https.createServer(
    {
      key: fs.readFileSync('./resources/server.key'),
      cert: fs.readFileSync('./resources/server.cert'),
    }, proxyApp).listen(proxyHttpsPort, function() {
  console.log(`Proxy open on ${proxyHttpsPort}`);
});

// Start the service app
serviceApp.listen(servicePort, () => {
  console.log(`Service Listening on ${servicePort}`);
});