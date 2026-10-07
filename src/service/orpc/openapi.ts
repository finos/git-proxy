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

import fs from 'fs';
import path from 'path';
import { OpenAPIReferencePlugin } from '@orpc/openapi/plugins';

import { findPackageRoot } from '../urls';
import type { ServiceContext } from './context';
import { customErrorResponseBodySchema } from './errors';
import { schemaConverters } from './schemas';

export const DOCS_PATH = '/api/docs';
export const SPEC_PATH = '/api/openapi.json';

const readPackageVersion = (): string => {
  try {
    const pkg = fs.readFileSync(path.join(findPackageRoot(), 'package.json'), 'utf8');
    return JSON.parse(pkg).version;
  } catch {
    return 'unknown';
  }
};

export const specGenerateOptions = {
  info: {
    title: 'GitProxy Service API',
    version: readPackageVersion(),
    description:
      'Management API behind the GitProxy UI and CLI: push review, repository ' +
      'registration, users and authentication.',
  },
  customErrorResponseBodySchema,
};

/**
 * Serves the API reference at {@link DOCS_PATH} and the OpenAPI document at
 * {@link SPEC_PATH}.
 * @return {OpenAPIReferencePlugin} the configured plugin
 */
export const createReferencePlugin = (): OpenAPIReferencePlugin<ServiceContext> =>
  new OpenAPIReferencePlugin<ServiceContext>({
    schemaConverters,
    docsPath: DOCS_PATH,
    specPath: SPEC_PATH,
    docsTitle: 'GitProxy API Reference',
    specGenerateOptions,
  });
