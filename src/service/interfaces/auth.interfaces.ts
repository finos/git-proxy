/**
 * Copyright 2026 GitProxy Contributors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { PublicUser } from '../../db/types';

export interface AuthResources {
  login: { action: 'post'; uri: string };
  profile: { action: 'get'; uri: string };
  logout: { action: 'post'; uri: string };
}

export interface AuthConfigResponse {
  usernamePasswordMethod: string | null;
  otherMethods: string[];
}

export interface LoginResponse {
  message: 'success';
  user: PublicUser;
}

export interface LogoutResponse {
  isAuth: boolean;
  user: Express.User | undefined;
}

export interface CreateUserResponse {
  message: string;
  username: string;
}

export interface GitAccountBody {
  username?: string;
  id?: string;
  gitAccount: string;
}

export interface CreateUserBody {
  username: string;
  password: string;
  email: string;
  gitAccount: string;
  admin?: boolean;
}
