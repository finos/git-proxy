const { createLogger, format, transports } = require('winston');
const { combine, timestamp, printf } = format;

const cleanFormat = printf(({ level, message, timestamp }) => {
  return `${timestamp} ${level}: ${message}`;
});

const logger = createLogger({
  format: combine(timestamp(), cleanFormat),
  transports: [
    new transports.File({
      filename: 'error.log',
      level: 'error',
      dirname: './src/logging',
    }),
    new transports.File({
      filename: 'git-proxy.log',
      dirname: './src/logging',
    }),
  ],
});

module.exports.logger = logger;
