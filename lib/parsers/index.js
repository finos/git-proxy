const recievePackRequest = require('./gitReceivePackRequest.js');
const requestParser = require('./requestParser.js');

exports.parsePush = recievePackRequest.exec;
exports.parseRequest = requestParser.exec;
