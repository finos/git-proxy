import { Options as RateLimitOptions } from 'express-rate-limit';

export interface UserSettings {
  uiRouteAuth: Record<string, unknown>;
  authorisedList: AuthorisedRepo[];
  sink: Database[];
  authentication: Authentication[];
  apiAuthentication: Authentication[];
  tempPassword?: TempPasswordConfig;
  proxyUrl: string;
  api: ThirdPartyApiConfig;
  cookieSecret: string;
  sessionMaxAgeHours: number;
  tls?: TLSConfig;
  sslCertPemPath?: string; // deprecated
  sslKeyPemPath?: string; // deprecated
  plugins: any[];
  commitConfig: Record<string, unknown>;
  attestationConfig: Record<string, unknown>;
  privateOrganizations: any[];
  urlShortener: string;
  contactEmail: string;
  csrfProtection: boolean;
  domains: Record<string, unknown>;
  rateLimit: RateLimitConfig;
  smtpHost?: string;
  smtpPort?: number;
}

export interface TLSConfig {
  enabled?: boolean;
  cert?: string;
  key?: string;
}

export interface AuthorisedRepo {
  project: string;
  name: string;
  url: string;
}

export interface Database {
  type: string;
  enabled: boolean;
  connectionString?: string;
  params?: Record<string, unknown>;
  options?: Record<string, unknown>;
}

export interface Authentication {
  type: string;
  enabled: boolean;
  options?: Record<string, unknown>;
  oidcConfig?: OidcConfig;
  adConfig?: AdConfig;
  jwtConfig?: JwtConfig;

  // Deprecated fields for backwards compatibility
  // TODO: remove in future release and keep the ones in adConfig
  userGroup?: string;
  adminGroup?: string;
  domain?: string;
}

export interface OidcConfig {
  issuer: string;
  clientID: string;
  clientSecret: string;
  callbackURL: string;
  scope: string;
}

export interface AdConfig {
  url: string;
  baseDN: string;
  searchBase: string;
  userGroup?: string;
  adminGroup?: string;
  domain?: string;
}

export interface JwtConfig {
  clientID: string;
  authorityURL: string;
  roleMapping: Record<string, unknown>;
  expectedAudience?: string;
}

export interface TempPasswordConfig {
  sendEmail: boolean;
  emailConfig: Record<string, unknown>;
}

export type RateLimitConfig = Partial<
  Pick<RateLimitOptions, 'windowMs' | 'limit' | 'message' | 'statusCode'>
>;

export interface ThirdPartyApiConfig {
  ls?: ThirdPartyApiConfigLs;
  github?: ThirdPartyApiConfigGithub;
}

export interface ThirdPartyApiConfigLs {
  userInADGroup: string;
}

export interface ThirdPartyApiConfigGithub {
  baseUrl: string;
}
