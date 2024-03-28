const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  defaultMeta: { service: 'user-service' },
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error', dirname: './src/logging' }),
    new winston.transports.File({ filename: 'combined.log', dirname: './src/logging' }),
  ],
});

module.exports.logger = logger;