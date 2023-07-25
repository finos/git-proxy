import proxy from './src/proxy';
import service from './src/service';

proxy.start();
service.start();

module.exports.proxy = proxy;
module.exports.service = service;
