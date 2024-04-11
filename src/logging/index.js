const { createLogger, format, transports } = require('winston');
const { combine, timestamp, printf } = format;

const cleanFormat = printf(({ level, message, timestamp }) => {
  return `${timestamp} ${level}: ${message}`;
});

const logger = createLogger({
  format: combine(timestamp(), format.errors({ stack: true }), cleanFormat),
  transports: [
    new transports.File({
      level: 'error',
      filename: 'error.log',
      dirname: './src/logging',
    }),
    new transports.File({
      level: 'info',
      filename: 'git-proxy.log',
      dirname: './src/logging',
    }),
    new transports.Console(),
  ],
});

/**
 * @param {string} logLevel
 * @param {string} filename
 * @param {string} message
 */
function winstonLogger(logLevel, filename, message) {
  if (logLevel === 'error') {
    logger.error(`${filename}: ${message}`);
  } else {
    logger.info(`${filename}: ${message}`);
  }
}

module.exports.logger = logger;
module.exports.winstonLogger = winstonLogger;
