import { JwtPayload } from "jsonwebtoken";

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
}

/**
 * The JWT role mapping configuration.
 * 
 * The key is the in-app role name (e.g. "admin").
 * The value is a pair of claim name and expected value.
 * 
 * For example, the following role mapping will assign the "admin" role to users whose "name" claim is "John Doe":
 * 
 * {
 *   "admin": {
 *     "name": "John Doe"
 *   }
 * }
 */
export type RoleMapping = Record<
  string, // role name like "admin"
  Record<string, string> // e.g. { "name": "John Doe" }
>;
