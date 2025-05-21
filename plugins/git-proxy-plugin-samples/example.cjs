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

/**
 * This is a sample plugin that logs a message when the pull action is called. It is written using
 * CommonJS modules to demonstrate the use of CommonJS in plugins.
 */

// Peer dependencies; its expected that these deps exist on Node module path if you've installed @finos/git-proxy
const { PushActionPlugin } = require('@finos/git-proxy/src/plugin');
const { Step } = require('@finos/git-proxy/src/proxy/actions');
'use strict';

/**
 * 
 * @param {object} req Express Request object
 * @param {Action} action GitProxy Action
 * @return {Promise<Action>} Promise that resolves to an Action
 */
async function logMessage(req, action) {
  const step = new Step('LogRequestPlugin');
  action.addStep(step);
  console.log(`LogRequestPlugin: req url ${req.url}`);
  console.log(`LogRequestPlugin: req user-agent ${req.header('User-Agent')}`);
  console.log('LogRequestPlugin: action', JSON.stringify(action));
  return action;
}

class LogRequestPlugin extends PushActionPlugin {
  constructor() {
    super(logMessage)
  }
}


module.exports = {
  // Plugins can be written inline as new instances of Push/PullActionPlugin
  // A custom class is not required
  hello: new PushActionPlugin(async (req, action) => {
    const step = new Step('HelloPlugin');
    action.addStep(step);
    console.log('Hello world from the hello plugin!');
    return action;
  }),
  // Sub-classing is fine too if you require more control over the plugin
  logRequest: new LogRequestPlugin(),
  someOtherValue: 'foo', // This key will be ignored by the plugin loader
};
