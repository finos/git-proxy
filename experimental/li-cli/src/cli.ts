/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.    
 */
#!/usr/bin/env node

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import addLicenseCMD from './cmds/add-license';
import process from 'node:process';

yargs(hideBin(process.argv))
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
