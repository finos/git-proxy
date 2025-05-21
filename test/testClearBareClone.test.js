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
const fs = require('fs');
const chai = require('chai');
const clearBareClone = require('../src/proxy/processors/push-action/clearBareClone').exec;
const pullRemote = require('../src/proxy/processors/push-action/pullRemote').exec;
const { Action } = require('../src/proxy/actions/Action');
chai.should();

const expect = chai.expect;
const timestamp = Date.now();

describe('clear bare and local clones', async () => {
  it('pull remote generates a local .remote folder', async () => {
    const action = new Action('123', 'type', 'get', timestamp, 'finos/git-proxy');
    action.url = 'https://github.com/finos/git-proxy';

    const authorization = `Basic ${Buffer.from('JamieSlome:test').toString('base64')}`;

    await pullRemote(
      {
        headers: {
          authorization,
        },
      },
      action,
    );

    expect(fs.existsSync(`./.remote/${timestamp}`)).to.be.true;
  }).timeout(20000);

  it('clear bare clone function purges .remote folder and specific clone folder', async () => {
    const action = new Action('123', 'type', 'get', timestamp, 'finos/git-proxy');
    await clearBareClone(null, action);
    expect(fs.existsSync(`./.remote`)).to.throw;
    expect(fs.existsSync(`./.remote/${timestamp}`)).to.throw;
  });

  afterEach(() => {
    if (fs.existsSync(`./.remote`)) {
      fs.rmdirSync(`./.remote`, { recursive: true });
    }
  })
});
