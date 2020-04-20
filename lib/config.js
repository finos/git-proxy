const fs = require('fs');

const data = JSON.parse(fs.readFileSync('./resources/config.json'));

const getWhiteList = () => {
  return data.repoWhiteList;
};

exports.getWhiteList = getWhiteList;
