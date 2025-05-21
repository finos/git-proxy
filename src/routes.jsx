/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
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
/* !

=========================================================
* Material Dashboard React - v1.9.0
=========================================================

* Product Page: https://www.creative-tim.com/product/material-dashboard-react
* Copyright 2020 Creative Tim (https://www.creative-tim.com)
* Licensed under MIT (https://github.com/creativetimofficial/material-dashboard-react/blob/master/LICENSE.md)

* Coded by Creative Tim

=========================================================

* The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

*/

import Person from '@material-ui/icons/Person';
import OpenPushRequests from './ui/views/OpenPushRequests/OpenPushRequests';
import PushDetails from './ui/views/PushDetails/PushDetails';
import User from './ui/views/User/User';
import UserList from './ui/views/UserList/UserList';
import RepoDetails from './ui/views/RepoDetails/RepoDetails';
import RepoList from './ui/views/RepoList/RepoList';

import { RepoIcon } from '@primer/octicons-react';

import { Group, AccountCircle, Dashboard } from '@material-ui/icons';

const dashboardRoutes = [
  {
    path: '/repo',
    name: 'Repositories',
    icon: RepoIcon,
    component: RepoList,
    layout: '/admin',
    visible: true,
  },
  {
    path: '/push',
    name: 'Dashboard',
    icon: Dashboard,
    component: OpenPushRequests,
    layout: '/admin',
    visible: true,
  },
  {
    path: '/push/:id',
    name: 'Open Push Requests',
    icon: Person,
    component: PushDetails,
    layout: '/admin',
    visible: false,
  },
  {
    path: '/profile',
    name: 'My Account',
    icon: AccountCircle,
    component: User,
    layout: '/admin',
    visible: true,
  },
  {
    path: '/user/:id',
    name: 'User',
    icon: Person,
    component: User,
    layout: '/admin',
    visible: false,
  },
  {
    path: '/repo/:id',
    name: 'Repo Details',
    icon: Person,
    component: RepoDetails,
    layout: '/admin',
    visible: false,
  },
  {
    path: '/user',
    name: 'Users',
    icon: Group,
    component: UserList,
    layout: '/admin',
    visible: true,
  },
];

export default dashboardRoutes;
