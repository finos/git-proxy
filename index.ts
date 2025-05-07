#!/usr/bin/env tsx
/* eslint-disable max-len */
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { existsSync } from 'fs';
import { configFile, setConfigFile, loadConfig } from './src/config/file';
import proxy from './src/proxy';
import service from './src/service';

const argv = yargs(hideBin(process.argv))
  .usage('Usage: $0 [options]')
  .options({
    validate: {
      description:
        'Check the proxy.config.json file in the current working directory for validation errors.',
      alias: 'v',
      type: 'boolean',
    },
    config: {
      description: 'Path to custom git-proxy configuration file.',
      alias: 'c',
      type: 'string',
      default: 'proxy.config.json',
    },
  })
  .strict()
  .parseSync();

setConfigFile(argv.config);

if (argv.validate) {
  if (!existsSync(configFile)) {
    console.error(
      `✖ Config file ${configFile} doesn't exist, nothing to validate! Did you forget -c/--config?`,
    );
    process.exit(1);
  }

  try {
    loadConfig();
    console.log(`✔️  ${configFile} is valid`);
    process.exit(0);
  } catch (err: any) {
    console.error('✖ Validation Error:', err.message);
    process.exit(1);
  }
}

try {
  loadConfig();
} catch (err: any) {
  console.error('✖ Errore di validazione:', err.message);
  process.exit(1);
}

proxy.start();
service.start();

export { proxy, service };
