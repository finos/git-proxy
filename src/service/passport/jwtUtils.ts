import axios from 'axios';
import jwt, { JwtPayload } from 'jsonwebtoken';
import jwkToPem from 'jwk-to-pem';

import { JwkKey, JwksResponse, JwtValidationResult, RoleMapping } from './types';

/**
 * Obtain the JSON Web Key Set (JWKS) from the OIDC authority.
 * @param {string} authorityUrl the OIDC authority URL. e.g. https://login.microsoftonline.com/{tenantId}
 * @return {Promise<JwkKey[]>} the JWKS keys
 */
export async function getJwks(authorityUrl: string): Promise<JwkKey[]> {
  try {
    const { data } = await axios.get(`${authorityUrl}/.well-known/openid-configuration`);
    const jwksUri: string = data.jwks_uri;

    const { data: jwks }: { data: JwksResponse } = await axios.get(jwksUri);
    return jwks.keys;
  } catch (error) {
    console.error('Error fetching JWKS:', error);
    throw new Error('Failed to fetch JWKS');
  }
}

/**
 * Validate a JWT token using the OIDC configuration.
 * @param {string} token the JWT token
 * @param {string} authorityUrl the OIDC authority URL
 * @param {string} clientID the OIDC client ID 
 * @param {string} expectedAudience the expected audience for the token
 * @param {Function} getJwksInject the getJwks function to use (for dependency injection). Defaults to the built-in getJwks function.
 * @return {Promise<JwtValidationResult>} the verified payload or an error
 */
export async function validateJwt(
  token: string,
  authorityUrl: string,
  expectedAudience: string,
  clientID: string,
  getJwksInject: (authorityUrl: string) => Promise<JwkKey[]> = getJwks
): Promise<JwtValidationResult> {
  try {
    const jwks = await getJwksInject(authorityUrl);

    const decoded = jwt.decode(token, { complete: true });
    if (!decoded || typeof decoded !== 'object' || !decoded.header?.kid) {
      throw new Error('Invalid JWT: Missing key ID (kid)');
    }

    const { kid } = decoded.header;
    const jwk = jwks.find((key) => key.kid === kid);
    if (!jwk) {
      throw new Error('No matching key found in JWKS');
    }

    const pubKey = jwkToPem(jwk as any);

    const verifiedPayload = jwt.verify(token, pubKey, {
      algorithms: ['RS256'],
      issuer: authorityUrl,
      audience: expectedAudience,
    }) as JwtPayload;

    if (verifiedPayload.azp && verifiedPayload.azp !== clientID) {
      throw new Error('JWT client ID does not match');
    }

    return { verifiedPayload, error: null };
  } catch (error: any) {
    const errorMessage = `JWT validation failed: ${error.message}\n`;
    console.error(errorMessage);
    return { error: errorMessage, verifiedPayload: null };
  }
}

/**
 * Assign roles to the user based on the role mappings provided in the jwtConfig.
 * 
 * If no role mapping is provided, the user will not have any roles assigned (i.e. user.admin = false).
 * @param {RoleMapping} roleMapping the role mapping configuration
 * @param {JwtPayload} payload the JWT payload
 * @param {Record<string, any>} user the req.user object to assign roles to
 */
export function assignRoles(
  roleMapping: RoleMapping | undefined,
  payload: JwtPayload,
  user: Record<string, any>
): void {
  if (!roleMapping) return;

  for (const role of Object.keys(roleMapping)) {
    const claimMap = roleMapping[role];
    const claim = Object.keys(claimMap)[0];
    const value = claimMap[claim];

    if (payload[claim] && payload[claim] === value) {
      user[role] = true;
    }
  }
}
