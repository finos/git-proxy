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
  })
  .strict().argv;

const config = require('./src/config/file');
config.configFile = argv.c ? argv.c : undefined;

if (argv.v) {
  const fs = require('fs');

  if (!fs.existsSync(config.configFile)) {
    console.error(
      `Config file ${config.configFile} doesn't exist, nothing to validate! Did you forget -c/--config?`,
    );
    process.exit(1);
  }

  config.validate();
  console.log(`${config.configFile} is valid`);
  process.exit(0);
}

config.validate();

const proxy = require('./src/proxy');
const service = require('./src/service');

proxy.start();
service.start();

module.exports.proxy = proxy;
module.exports.service = service;
