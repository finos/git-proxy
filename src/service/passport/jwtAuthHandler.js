const axios = require("axios");
const jwt = require("jsonwebtoken");
const jwkToPem = require("jwk-to-pem");

/**
 * Obtain the JSON Web Key Set (JWKS) from the OIDC authority.
 * @param {string} authorityUrl the OIDC authority URL. e.g. https://login.microsoftonline.com/{tenantId}
 * @returns {Promise<object[]>} the JWKS keys
 */
async function getJwks(authorityUrl) {
  try {
      const { data } = await axios.get(`${authorityUrl}/.well-known/openid-configuration`);
      const jwksUri = data.jwks_uri;

      const { data: jwks } = await axios.get(jwksUri);
      return jwks.keys;
  } catch (error) {
      console.error("Error fetching JWKS:", error);
      throw new Error("Failed to fetch JWKS");
  }
}

/**
 * Validate a JWT token using the OIDC configuration.
 * @param {*} token the JWT token
 * @param {*} authorityUrl the OIDC authority URL
 * @param {*} clientID the OIDC client ID 
 * @param {*} expectedAudience the expected audience for the token
 * @returns {Promise<object>} the verified payload or an error
 */
async function validateJwt(token, authorityUrl, clientID, expectedAudience) {
  try {
      const jwks = await getJwks(authorityUrl);

      const decodedHeader = await jwt.decode(token, { complete: true });
      if (!decodedHeader || !decodedHeader.header || !decodedHeader.header.kid) {
          throw new Error("Invalid JWT: Missing key ID (kid)");
      }

      const { kid } = decodedHeader.header;
      const jwk = jwks.find((key) => key.kid === kid);
      if (!jwk) {
          throw new Error("No matching key found in JWKS");
      }

      const pubKey = jwkToPem(jwk);

      const verifiedPayload = jwt.verify(token, pubKey, {
          algorithms: ["RS256"],
          issuer: authorityUrl,
          audience: expectedAudience,
      });

      if (verifiedPayload.azp !== clientID) {
          throw new Error("JWT client ID does not match");
      }

      return { verifiedPayload };
  } catch (error) {
      const errorMessage = `JWT validation failed: ${error.message}`;
      console.error(errorMessage);
      return { error: errorMessage };
  }
}

const jwtAuthHandler = () => {
  return async (req, res, next) => {
      if (process.env.OIDC_AUTH_ENABLED !== "true") {
          return next();
      }

      if (req.isAuthenticated()) {
          console.log('request is already authenticated');
          return next();
      }

      const token = req.header("Authorization");
      if (!token) {
          return res.status(401).send("No token provided");
      }

      const clientID = process.env.OIDC_CLIENT_ID;
      const authorityUrl = process.env.OIDC_AUTHORITY;
      const expectedAudience = process.env.OIDC_AUDIENCE || clientID;

      if (!authorityUrl) {
          return res.status(500).send("OIDC authority URL is not configured");
      }

      if (!clientID) {
          return res.status(500).send("OIDC client ID is not configured");
      }

      const tokenParts = token.split(" ");
      const { verifiedPayload, error } = await validateJwt(tokenParts[1], authorityUrl, expectedAudience, clientID);
      if (error) {
          return res.status(401).send(error);
      }

      req.user = verifiedPayload;
      console.log('request authenticated through JWT')
      return next();
  }
}

module.exports = jwtAuthHandler;
