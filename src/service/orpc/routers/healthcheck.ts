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

import { pub } from '../base';
import { MessageBody } from '../errors';
import { docOnly } from '../schemas';

export const healthcheckRouter = {
  check: pub
    .route({ method: 'GET', path: '/', summary: 'Liveness probe' })
    .output(docOnly<{ message: string }>(MessageBody))
    .handler(() => ({ message: 'ok' })),
};
