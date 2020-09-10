const config = require('config')
const proxy = require('proxy')
const service = require('service')
const data = require('data')

module.exports.config = config;
module.exports.proxy = proxy
module.exports.service = service
module.exports.data = data

console.log(`authorisedList = ${JSON.stringify(config.getAuthorisedList())}`);
