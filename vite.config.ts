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

import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const require = createRequire(import.meta.url);

// force ESM browser entry point for html-dom-parser 8 compatibility
const htmlDomParserBrowser = join(
  dirname(require.resolve('html-dom-parser/package.json')),
  'esm/client/html-to-dom.mjs',
);

export default defineConfig({
  build: {
    outDir: 'dist/build',
  },
  resolve: {
    alias: {
      'html-dom-parser': htmlDomParserBrowser,
    },
  },
  optimizeDeps: {
    include: ['html-react-parser', 'html-dom-parser', 'domhandler'],
  },
  server: {
    port: 3000,
    watch: {
      ignored: ['**/.data/**', '**/.remote/**', '**/.tmp/**'],
    },
  },
  plugins: [tailwindcss(), react()],
  publicDir: 'src/ui/public',
  envPrefix: 'VITE_',
});
