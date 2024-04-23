const { createLogger, format, transports } = require('winston');
const { combine, timestamp, printf } = format;

const cleanFormat = printf(({ level, message, timestamp, ...meta }) => {
  if (meta?.filename) {
    return `${timestamp} ${level}: ${meta.filename} ${message}`;
  }
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

module.exports.logger = logger;
