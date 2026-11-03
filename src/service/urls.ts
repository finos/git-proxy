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

import { Request } from 'express';
import path from 'path';
import fs from 'fs';

import * as config from '../config';

const normaliseProtocol = (protocol: string): string => {
  if (protocol === 'ssh') return 'https';
  return protocol || 'https';
};

export const getProxyURL = (req: Request): string => {
  return (
    config.getDomains().proxy ??
    `${normaliseProtocol(req?.protocol)}://${req.headers.host}`.replace(
      `:${config.getUIPort()}`,
      `:${config.getServerPort()}`,
    )
  );
};

export const getServiceUIURL = (req: Request): string => {
  return (
    config.getDomains().service ??
    `${normaliseProtocol(req?.protocol)}://${req.headers.host}`.replace(
      `:${config.getServerPort()}`,
      `:${config.getUIPort()}`,
    )
  );
};

function findPackageRoot(from: string = __dirname): string {
  let dir = from;
  for (;;) {
    if (fs.existsSync(path.join(dir, 'package.json'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) throw new Error('Could not locate GitProxy package root');
    dir = parent;
  }
}

export const UI_BUILD_PATH = path.join(findPackageRoot(), 'dist', 'build');
