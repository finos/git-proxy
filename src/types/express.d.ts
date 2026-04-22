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

import type { ClientWithUser } from '../proxy/ssh/types';

declare module 'express-serve-static-core' {
  interface Request {
    bodyRaw?: Buffer;
    isSSH?: boolean;
    sshUser?: {
      username: string;
      email?: string;
      gitAccount?: string;
      sshKeyInfo?: {
        keyType: string;
        keyData: Buffer;
      };
    };
    sshClient?: ClientWithUser;
    authContext?: {
      cloneServiceToken?: {
        username: string;
        password: string;
      };
      sshKey?: {
        keyType?: string;
        keyData?: Buffer;
        privateKey?: Buffer;
      };
    };
  }
}
