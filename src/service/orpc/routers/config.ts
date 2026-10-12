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

import { z } from 'zod';

import * as config from '../../../config';
import { getProviders } from '../../../proxy/processors/push-action/tokenIdentity';
import { pub } from '../base';
import { textBody } from '../errors';
import { docOnly, TextSchema } from '../schemas';

/** Express's `res.send(string)` sent the value as text; `res.send(undefined)` sent nothing. */
const asText = (value: string | undefined): Blob | undefined =>
  value === undefined ? undefined : textBody(value);

export const configRouter = {
  attestation: pub
    .route({ method: 'GET', path: '/attestation', summary: 'Attestation questions' })
    .output(docOnly<ReturnType<typeof config.getAttestationConfig>>(z.looseObject({})))
    .handler(() => config.getAttestationConfig()),

  urlShortener: pub
    .route({ method: 'GET', path: '/urlShortener', summary: 'URL shortener (text)' })
    .output(docOnly<Blob | undefined>(TextSchema))
    .handler(() => asText(config.getURLShortener())),

  contactEmail: pub
    .route({ method: 'GET', path: '/contactEmail', summary: 'Contact email (text)' })
    .output(docOnly<Blob | undefined>(TextSchema))
    .handler(() => asText(config.getContactEmail())),

  uiRouteAuth: pub
    .route({ method: 'GET', path: '/uiRouteAuth', summary: 'UI route authorisation rules' })
    .output(docOnly<ReturnType<typeof config.getUIRouteAuth>>(z.looseObject({})))
    .handler(() => config.getUIRouteAuth()),

  scmProviders: pub
    .route({ method: 'GET', path: '/scmProviders', summary: 'Configured SCM providers' })
    .output(
      docOnly<{ name: string; type: string; host: string }[]>(
        z.array(z.object({ name: z.string(), type: z.string(), host: z.string() })),
      ),
    )
    .handler(() => getProviders().map(({ name, type, host }) => ({ name, type, host }))),

  ssh: pub
    .route({ method: 'GET', path: '/ssh', summary: 'SSH proxy configuration' })
    .output(docOnly<ReturnType<typeof config.getSSHConfig>>(z.looseObject({})))
    .handler(() => config.getSSHConfig()),
};
