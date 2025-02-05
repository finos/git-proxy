#!/usr/bin/env node

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import addLicenseCMD from './cmds/add-license';
import process from 'node:process';

yargs(hideBin(process.argv))
  // .command(
  //   'serve [port]',
  //   'start the server',
  //   (yargs) => {
  //     return yargs.positional('port', {
  //       describe: 'port to bind on',
  //       default: 5000,
  //     });
  //   },
  //   (argv) => {
  //     addLicenseCMD();
  //   },
  // )
  .option('li-url', {
    type: 'string',
    describe: 'The url of the license inventory instance',
  })
  .command(
    'add-license [SPDXID]',
    '',
    (yargs) =>
      yargs
        .positional('SPDXID', {
          type: 'string',
          describe: 'ID of license',
        })
        .option('require-cal', {
          type: 'boolean',
          default: false,
          describe: 'require successful collection of info from Choose A License',
        })
        .demandOption('li-url'),
    async (argv) => {
      try {
        await addLicenseCMD(argv['li-url'], {
          spdxID: argv.SPDXID,
          requireCal: argv['require-cal'],
        });
      } catch (e) {
        process.exit(1);
      }
    },
  )
  .option('verbose', {
    alias: 'v',
    type: 'boolean',
    description: 'Run with verbose logging',
  })
  .demandCommand()
  .help()
  .parse();
