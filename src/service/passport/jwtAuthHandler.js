const { assignRoles, validateJwt } = require('./jwtUtils');

/**
 * Middleware function to handle JWT authentication.
 * @param {*} overrideConfig optional configuration to override the default JWT configuration (e.g. for testing)
 * @returns {Function} the middleware function 
 */
const jwtAuthHandler = (overrideConfig = null) => {
  return async (req, res, next) => {
    const apiAuthMethods = 
        overrideConfig
          ? [{ type: "jwt", jwtConfig: overrideConfig }]
          : require('../../config').getAPIAuthMethods();

    const jwtAuthMethod = apiAuthMethods.find((method) => method.type.toLowerCase() === "jwt");
      if (!overrideConfig && (!jwtAuthMethod || !jwtAuthMethod.enabled)) {
          return next();
      }

      if (req.isAuthenticated()) {
          return next();
      }

      const token = req.header("Authorization");
      if (!token) {
          return res.status(401).send("No token provided\n");
      }

      const { clientID, authorityURL, expectedAudience, roleMapping } = jwtAuthMethod.jwtConfig;
      const audience = expectedAudience || clientID;

      if (!authorityURL) {
          return res.status(500).send("OIDC authority URL is not configured\n");
      }

      if (!clientID) {
          return res.status(500).send("OIDC client ID is not configured\n");
      }

      const tokenParts = token.split(" ");
      const { verifiedPayload, error } = await validateJwt(tokenParts[1], authorityURL, audience, clientID);
      if (error) {
          return res.status(401).send(error);
      }

      req.user = verifiedPayload;
      assignRoles(roleMapping, verifiedPayload, req.user);

      return next();
  }
}

module.exports = jwtAuthHandler;
