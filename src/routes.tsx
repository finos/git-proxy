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
import RouteGuard from './ui/components/RouteGuard/RouteGuard';
import PushRequests from './ui/views/PushRequests/PushRequests';
import PushDetails from './ui/views/PushDetails/PushDetails';
import User from './ui/views/User/UserProfile';
import UserList from './ui/views/UserList/UserList';
import RepoDetails from './ui/views/RepoDetails/RepoDetails';
import RepoList from './ui/views/RepoList/RepoList';

import { Route } from './ui/types';

const dashboardRoutes: Route[] = [
  {
    path: '/repo',
    name: 'Repositories',
    component: () => <RouteGuard component={RepoList} />,
    layout: '/dashboard',
    visible: true,
  },
  {
    path: '/repo/:id',
    name: 'Repo Details',
    component: () => <RouteGuard component={RepoDetails} />,
    layout: '/dashboard',
    visible: false,
  },
  {
    path: '/push',
    name: 'Activity',
    component: () => <RouteGuard component={PushRequests} />,
    layout: '/dashboard',
    visible: true,
  },
  {
    path: '/push/:id',
    name: 'Open Push Requests',
    component: () => <RouteGuard component={PushDetails} />,
    layout: '/dashboard',
    visible: false,
  },
  {
    path: '/profile',
    name: 'My Account',
    component: () => <RouteGuard component={User} />,
    layout: '/dashboard',
    visible: false,
  },
  {
    path: '/admin/user',
    name: 'Users',
    component: () => <RouteGuard component={UserList} />,
    layout: '/dashboard',
    visible: true,
  },
  {
    path: '/user/:id',
    name: 'User',
    component: () => <RouteGuard component={User} />,
    layout: '/dashboard',
    visible: false,
  },
];

export default dashboardRoutes;
