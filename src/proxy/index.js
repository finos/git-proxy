const proxyApp = require('express')();
const bodyParser = require('body-parser');
const routes = require('./routes');
const proxyHttpPort = 8000;

const options = {
  inflate: true,
  limit: '100000kb',
  type: '*/*',
};

// Setup the proxy middleware
proxyApp.use(bodyParser.raw(options));
proxyApp.use('/', routes);


const start = () => {
  proxyApp.listen(proxyHttpPort, () => {
    console.log(`Listening on ${proxyHttpPort}`);
  });

  return proxyApp;
};

module.exports.start = start;
