import { Options as RateLimitOptions } from 'express-rate-limit';

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
}

export interface TempPasswordConfig {
  sendEmail: boolean;
  emailConfig: Record<string, unknown>;
}

export type RateLimitConfig = Partial<
  Pick<RateLimitOptions, 'windowMs' | 'limit' | 'message' | 'statusCode'>
>;
