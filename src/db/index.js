const config = require('../config');

console.log(JSON.stringify(config.getDatabase()));

if (config.getDatabase().type === 'fs') {
  sink = require('../db/file');
  console.log('USING TYPE FS')
}

module.exports.authorise = sink.authorise;
module.exports.reject = sink.reject;
module.exports.cancel = sink.cancel;
module.exports.getPushes = sink.getPushes;
module.exports.writeAudit = sink.writeAudit;
module.exports.getPush = sink.getPush;
module.exports.findUser = sink.findUser;
module.exports.createUser = sink.createUser;
