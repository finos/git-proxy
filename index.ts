#!/usr/bin/env tsx

import path from 'path';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import * as fs from 'fs';
import { getConfigFile, setConfigFile, validate } from './src/config/file';
import { initUserConfig, logConfiguration } from './src/config';
import { Proxy } from './src/proxy';
import { Service } from './src/service';

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
      default: path.join(__dirname, 'proxy.config.json'),
      required: false,
      alias: 'c',
      type: 'string',
    },
  })
  .strict()
  .parseSync();

console.log('Setting config file to: ' + (argv.c as string) || '');
setConfigFile((argv.c as string) || '');
initUserConfig();
logConfiguration();

const configFile = getConfigFile();
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

console.log('validating config');
validate();

console.log('Setting up the proxy and Service');

// The deferred imports should cause these to be loaded on first access
const proxy = new Proxy();
proxy.start();
Service.start(proxy);

export { proxy, Service };
