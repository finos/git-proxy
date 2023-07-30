const proxy = require('./src/proxy');
const service = require('./src/service');

proxy.start();
service.start();

module.exports.proxy = proxy;
module.exports.service = service;
