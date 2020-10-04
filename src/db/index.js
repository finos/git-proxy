const config = require('../config');
let sink = null

console.log(config.getSink())

if (config.getSink() == 'fs') {
  sink = require('../db/file');
  console.log(sink)
}

module.exports.authorise = sink.authorise;
module.exports.getPushes = sink.getPushes;
module.exports.writeAudit = sink.writeAudit;
module.exports.getPush = sink.getPush;
module.exports.findByUsername = sink.findByUsername;
module.exports.findById = sink.findById;
