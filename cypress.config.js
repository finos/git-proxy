const { defineConfig } = require('cypress');

module.exports = defineConfig({
  e2e: {
    baseUrl: process.env.CYPRESS_BASE_URL || 'http://localhost:3000',
    chromeWebSecurity: false, // Required for OIDC testing
    env: {
      API_BASE_URL: process.env.CYPRESS_API_BASE_URL || 'http://localhost:8080',
      GIT_PROXY_URL: process.env.CYPRESS_GIT_PROXY_URL || 'http://localhost:8000',
      GIT_SERVER_TARGET: process.env.CYPRESS_GIT_SERVER_TARGET || 'git-server:8443',
    },
    setupNodeEvents(on, config) {
      on('task', {
        log(message) {
          console.log(message);
          return null;
        },
      });
    },
  },
});
