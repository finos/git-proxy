/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.    
 */
import { Options as RateLimitOptions } from 'express-rate-limit';

export interface UserSettings {
  authorisedList: AuthorisedRepo[];
  sink: Database[];
  authentication: Authentication[];
  tempPassword?: TempPasswordConfig;
  proxyUrl: string;
  api: Record<string, any>;
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
}

export interface TempPasswordConfig {
  sendEmail: boolean;
  emailConfig: Record<string, unknown>;
}

export type RateLimitConfig = Partial<
  Pick<RateLimitOptions, 'windowMs' | 'limit' | 'message' | 'statusCode'>
>;
