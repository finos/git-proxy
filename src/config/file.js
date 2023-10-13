const path = require('path');
// eslint-disable-next-line prefer-const
let configFile = undefined;

module.exports = {
  get configFile() {
    return configFile
      ? configFile
      : path.join(process.cwd(), 'proxy.config.json');
  },
  set configFile(file) {
    configFile = file;
  },
};
