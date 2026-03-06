import { JwtPayload } from 'jsonwebtoken';

export type JwkKey = {
  kty: string;
  kid: string;
  use: string;
  n?: string;
  e?: string;
  x5c?: string[];
  [key: string]: any;
};

export type JwksResponse = {
  keys: JwkKey[];
};

export type JwtValidationResult = {
  verifiedPayload: JwtPayload | null;
  error: string | null;
};

export type ADProfile = {
  id?: string;
  username?: string;
  email?: string;
  displayName?: string;
  admin?: boolean;
  _json: ADProfileJson;
};

export type ADProfileJson = {
  sAMAccountName?: string;
  mail?: string;
  title?: string;
  userPrincipalName?: string;
  [key: string]: any;
};

export type ADVerifyCallback = (err: Error | null, user: ADProfile | null) => void;
