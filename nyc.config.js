const { logger } = require('./src/logging/index');
const opts = {
  branches: 80,
  lines: 80,
  functions: 80,
  statements: 80,
};

logger.info(`nyc config: ${opts}`);
module.exports = opts;
