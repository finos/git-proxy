/**
 * @license
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License. You may obtain a copy of the License at
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

import React from 'react';
import ReactDOM from 'react-dom';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';

// Styles
import 'font-awesome/css/font-awesome.min.css';
import '@fontsource/roboto/300.css';
import '@fontsource/roboto/400.css';
import '@fontsource/roboto/500.css';
import '@fontsource/roboto/700.css';
import 'material-design-icons/iconfont/material-icons.css';
import 'diff2html/bundles/css/diff2html.min.css';

// Auth provider
import { AuthProvider } from './ui/auth/AuthProvider';

// Core components
import Dashboard from './ui/layouts/Dashboard';
import Login from './ui/views/Login/Login';
import './ui/assets/css/material-dashboard-react.css';
import NotAuthorized from './ui/views/Extras/NotAuthorized';
import NotFound from './ui/views/Extras/NotFound';

ReactDOM.render(
  <AuthProvider>
    <Router>
      <Routes>
        <Route path='/dashboard/*' element={<Dashboard />} />
        <Route path='/login' element={<Login />} />
        <Route path='/not-authorized' element={<NotAuthorized />} />
        <Route path='/' element={<Navigate to='/dashboard/repo' />} />
        <Route path='*' element={<NotFound />} />
      </Routes>
    </Router>
  </AuthProvider>,
  document.getElementById('root'),
);
