const fs = require('fs');

const data = JSON.parse(fs.readFileSync('./config.json'));

const getWhiteList = () => {
  return data.repoWhiteList;
};

exports.getWhiteList = getWhiteList;
