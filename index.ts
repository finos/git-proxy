#!/usr/bin/env tsx
/* eslint-disable max-len */
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import * as fs from 'fs';
import { configFile, setConfigFile, validate } from './src/config/file';
import proxy from './src/proxy';
import service from './src/service';

const argv = yargs(hideBin(process.argv))
  .usage('Usage: $0 [options]')
  .options({
    validate: {
      description:
        'Check the proxy.config.json file in the current working directory for validation errors.',
      required: false,
      alias: 'v',
      type: 'boolean',
    },
    config: {
      description: 'Path to custom git-proxy configuration file.',
      default: 'proxy.config.json',
      required: false,
      alias: 'c',
      type: 'string',
    },
  })
  .strict()
  .parseSync();

setConfigFile(argv.c as string || "");

if (argv.v) {
  if (!fs.existsSync(configFile)) {
    console.error(
      `Config file ${configFile} doesn't exist, nothing to validate! Did you forget -c/--config?`,
    );
    process.exit(1);
  }

  validate();
  console.log(`${configFile} is valid`);
  process.exit(0);
}

validate();

proxy.start();
service.start();

export { proxy, service };
