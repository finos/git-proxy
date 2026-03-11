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
import Person from '@material-ui/icons/Person';
import PushRequests from './ui/views/PushRequests/PushRequests';
import PushDetails from './ui/views/PushDetails/PushDetails';
import User from './ui/views/User/UserProfile';
import UserList from './ui/views/UserList/UserList';
import RepoDetails from './ui/views/RepoDetails/RepoDetails';
import RepoList from './ui/views/RepoList/RepoList';
import SettingsView from './ui/views/Settings/Settings';

import { RepoIcon } from '@primer/octicons-react';
import { AccountCircle, Dashboard, Group, Settings } from '@material-ui/icons';

import { Route } from './ui/types';

const dashboardRoutes: Route[] = [
  {
    path: '/repo',
    name: 'Repositories',
    icon: RepoIcon,
    component: (props) => <RouteGuard component={RepoList} fullRoutePath={`/dashboard/repo`} />,
    layout: '/dashboard',
    visible: true,
  },
  {
    path: '/repo/:id',
    name: 'Repo Details',
    icon: Person,
    component: (props) => (
      <RouteGuard component={RepoDetails} fullRoutePath={`/dashboard/repo/:id`} />
    ),
    layout: '/dashboard',
    visible: false,
  },
  {
    path: '/push',
    name: 'Dashboard',
    icon: Dashboard,
    component: (props) => <RouteGuard component={PushRequests} fullRoutePath={`/dashboard/push`} />,
    layout: '/dashboard',
    visible: true,
  },
  {
    path: '/push/:id',
    name: 'Open Push Requests',
    icon: Person,
    component: (props) => (
      <RouteGuard component={PushDetails} fullRoutePath={`/dashboard/push/:id`} />
    ),
    layout: '/dashboard',
    visible: false,
  },
  {
    path: '/profile',
    name: 'My Account',
    icon: AccountCircle,
    component: (props) => <RouteGuard component={User} fullRoutePath={`/dashboard/profile`} />,
    layout: '/dashboard',
    visible: true,
  },
  {
    path: '/admin/user',
    name: 'Users',
    icon: Group,
    component: (props) => (
      <RouteGuard component={UserList} fullRoutePath={`/dashboard/admin/user`} />
    ),
    layout: '/dashboard',
    visible: true,
  },
  {
    path: '/user/:id',
    name: 'User',
    icon: Person,
    component: (props) => <RouteGuard component={User} fullRoutePath={`/dashboard/user/:id`} />,
    layout: '/dashboard',
    visible: false,
  },
  {
    path: '/admin/settings',
    name: 'Settings',
    icon: Settings,
    component: (props) => (
      <RouteGuard component={SettingsView} fullRoutePath={`/dashboard/admin/settings`} />
    ),
    layout: '/dashboard',
    visible: true,
  },
];

export default dashboardRoutes;
