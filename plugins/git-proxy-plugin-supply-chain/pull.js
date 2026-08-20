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

/**
 * Loader entry point for the pull/clone scanner. GitProxy's PluginLoader takes only the
 * default export of each configured module (load-plugin's `key` defaults to 'default'),
 * so the push and pull plugins ship as separate entry files. Register both:
 *
 *   "plugins": [
 *     "./plugins/git-proxy-plugin-supply-chain/index.js",
 *     "./plugins/git-proxy-plugin-supply-chain/pull.js"
 *   ]
 */

import { pullPlugin } from './index.js';

export default pullPlugin;
