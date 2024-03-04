#!/usr/bin/env node
/* eslint-disable max-len */
const argv = require('yargs/yargs')(process.argv.slice(2))
  .usage('Usage: $0 [options]')
  .options({
    validate: {
      description:
        'Check the proxy.config.json file in the current working directory for validation errors.',
      required: false,
      alias: 'v',
    },
    config: {
      description: 'Path to custom git-proxy configuration file.',
      default: 'proxy.config.json',
      required: false,
      alias: 'c',
    },
  }).argv;

require('./src/config/file').configFile = argv.c ? argv.c : undefined;

if (argv.v) {
  const fs = require('fs');
  const path = require('path');
  const validate = require('jsonschema').validate;
  const configFile = require('./src/config/file').configFile;

  if (!fs.existsSync(configFile)) {
    console.error(
      `Config file ${configFile} doesn't exist, nothing to validate! Did you forget -c/--config?`,
    );
    process.exit(1);
  }

  const config = JSON.parse(fs.readFileSync(configFile));
  const schema = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'config.schema.json')),
  );

  validate(config, schema, { required: true, throwError: true });

  logger.info(`${configFile} is valid`);
  process.exit(0);
}

const proxy = require('./src/proxy');
const service = require('./src/service');
const logger = require('/src/logs/logger');

proxy.start();
service.start();

module.exports.proxy = proxy;
module.exports.service = service;
