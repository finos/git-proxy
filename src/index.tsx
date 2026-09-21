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

import React from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router';
import { ThemeProvider as PrimerThemeProvider, BaseStyles } from '@primer/react';
import '@primer/primitives/dist/css/functional/themes/light.css';

// Styles
import 'diff2html/bundles/css/diff2html.min.css';

// Auth provider
import { AuthProvider } from './ui/auth/AuthProvider';
import { createAppQueryClient } from './ui/query/queryClient';

// Core components
import App from './ui/layouts/App';
import Login from './ui/views/Login/Login';
import './ui/assets/css/material-dashboard-react.css';
import './tailwind.css';
import NotAuthorized from './ui/views/Extras/NotAuthorized';
import NotFound from './ui/views/Extras/NotFound';

const queryClient = createAppQueryClient();

const container = document.getElementById('root');
if (!container) {
  throw new Error('Root element #root not found');
}
const root = createRoot(container);
root.render(
  <PrimerThemeProvider colorMode='day'>
    <BaseStyles>
      <AuthProvider>
        <Router>
          <QueryClientProvider client={queryClient}>
            <Routes>
              <Route path='/dashboard'>
                <Route path='*' element={<App />} />
              </Route>
              <Route path='/login' element={<Login />} />
              <Route path='/not-authorized' element={<NotAuthorized />} />
              <Route path='/' element={<Navigate to='/dashboard/repo' />} />
              <Route path='*' element={<NotFound />} />
            </Routes>
          </QueryClientProvider>
        </Router>
      </AuthProvider>
    </BaseStyles>
  </PrimerThemeProvider>,
);
