const { GIT_PROXY_SERVER_PORT: PROXY_HTTP_PORT, GIT_PROXY_UI_PORT: UI_PORT } =
  require('../config/env').Vars;
const config = require('../config');

module.exports = {
  getProxyURL: (req) => {
    const defaultURL = `${req.protocol}://${req.headers.host}`.replace(
      `:${UI_PORT}`,
      `:${PROXY_HTTP_PORT}`,
    );
    return config.getDomains().proxy ?? defaultURL;
  },
  getServiceUIURL: (req) => {
    const defaultURL = `${req.protocol}://${req.headers.host}`.replace(
      `:${PROXY_HTTP_PORT}`,
      `:${UI_PORT}`,
    );
    return config.getDomains().service ?? defaultURL;
  },
};
