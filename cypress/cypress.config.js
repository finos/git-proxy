/**
 * Copyright 2026 GitProxy Contributors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const { defineConfig } = require('cypress');
const { createPush, mintUpstreamToken } = require('./tasks');

// npm scripts pass cypress/cypress.config.js as config
// file and run from there
const PUBLIC_CONFIG_KEYS = ['API_BASE_URL', 'GIT_PROXY_URL', 'GIT_SERVER_TARGET', 'GIT_SERVER_URL'];

module.exports = defineConfig({
  expose: {
    API_BASE_URL: process.env.CYPRESS_API_BASE_URL || 'http://localhost:8080',
    GIT_PROXY_URL: process.env.CYPRESS_GIT_PROXY_URL || 'http://localhost:8000',
    GIT_SERVER_TARGET: process.env.CYPRESS_GIT_SERVER_TARGET || 'git-server:8443',
    // The Forgejo test server as reached from the Cypress host, for minting push tokens
    GIT_SERVER_URL: process.env.CYPRESS_GIT_SERVER_URL || 'https://localhost:8443',
  },
  e2e: {
    baseUrl: process.env.CYPRESS_BASE_URL || 'http://localhost:3000',
    specPattern: 'cypress/e2e/*.cy.{js,ts}',
    chromeWebSecurity: false, // Required for OIDC testing
    taskTimeout: 120000,
    setupNodeEvents(on, config) {
      config.expose ??= {};
      for (const key of PUBLIC_CONFIG_KEYS) {
        if (config.env?.[key] !== undefined) {
          config.expose[key] = config.env[key];
        }
      }

      on('task', {
        log(message) {
          console.log(message);
          return null;
        },
        mintUpstreamToken,
        createPush,
      });

      return config;
    },
  },
});
