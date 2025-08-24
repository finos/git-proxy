import { assignRoles, validateJwt } from './jwtUtils';
import { Request, Response, NextFunction } from 'express';
import { getAPIAuthMethods } from '../../config';
import { JwtConfig, Authentication } from '../../config/types';
import { RoleMapping } from './types';

export const jwtAuthHandler = (overrideConfig: JwtConfig | null = null) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const apiAuthMethods: Authentication[] = overrideConfig
      ? [{ type: 'jwt', enabled: true, jwtConfig: overrideConfig }]
      : getAPIAuthMethods();

    const jwtAuthMethod = apiAuthMethods.find(
      (method) => method.type.toLowerCase() === 'jwt'
    );

    if (!overrideConfig && (!jwtAuthMethod || !jwtAuthMethod.enabled)) {
      return next();
    }

    if (req.isAuthenticated?.()) {
      return next();
    }

    const token = req.header('Authorization');
    if (!token) {
      res.status(401).send('No token provided\n');
      return;
    }

    const config = jwtAuthMethod!.jwtConfig!;
    const { clientID, authorityURL, expectedAudience, roleMapping } = config;
    const audience = expectedAudience || clientID;

    if (!authorityURL) {
      res.status(500).send({
        message: 'OIDC authority URL is not configured\n'
      });
      return;
    }

    if (!clientID) {
      res.status(500).send({
        message: 'OIDC client ID is not configured\n'
      });
      return;
    }

    const tokenParts = token.split(' ');
    const accessToken = tokenParts.length === 2 ? tokenParts[1] : tokenParts[0];

    const { verifiedPayload, error } = await validateJwt(
      accessToken,
      authorityURL,
      audience,
      clientID
    );

    if (error || !verifiedPayload) {
      res.status(401).send(error || 'JWT validation failed\n');
      return;
    }

    req.user = verifiedPayload;
    assignRoles(roleMapping as RoleMapping, verifiedPayload, req.user);

    next();
  };
};
