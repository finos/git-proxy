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
export type RoleMapping = Record<string, Record<string, string>>;

export type AD = {
  isUserMemberOf: (
    username: string,
    groupName: string,
    callback: (err: Error | null, isMember: boolean) => void
  ) => void;
}

/**
 * The UserInfoResponse type from openid-client (to fix some type errors)
 */
export type UserInfoResponse = {
  readonly sub: string;
  readonly name?: string;
  readonly given_name?: string;
  readonly family_name?: string;
  readonly middle_name?: string;
  readonly nickname?: string;
  readonly preferred_username?: string;
  readonly profile?: string;
  readonly picture?: string;
  readonly website?: string;
  readonly email?: string;
  readonly email_verified?: boolean;
  readonly gender?: string;
  readonly birthdate?: string;
  readonly zoneinfo?: string;
  readonly locale?: string;
  readonly phone_number?: string;
  readonly updated_at?: number;
  readonly address?: any;
  readonly [claim: string]: any;
}
