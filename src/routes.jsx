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

import React from 'react';
import PrivateRoute from './ui/components/PrivateRoute/PrivateRoute';
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
    component: (props) => 
      <PrivateRoute
        component={RepoList}
        fullRoutePath={`/dashboard/repo`}
      />,
    layout: '/dashboard',
    visible: true,
  },
  {
    path: '/repo/:id',
    name: 'Repo Details',
    icon: Person,
    component: (props) => 
      <PrivateRoute
        component={RepoDetails}
        fullRoutePath={`/dashboard/repo/:id`}
      />,
    layout: '/dashboard',
    visible: false,
  },
  {
    path: '/push',
    name: 'Dashboard',
    icon: Dashboard,
    component: (props) =>
      <PrivateRoute
        component={OpenPushRequests}
        fullRoutePath={`/dashboard/push`}
      />,
    layout: '/dashboard',
    visible: true,
  },
  {
    path: '/push/:id',
    name: 'Open Push Requests',
    icon: Person,
    component: (props) =>
      <PrivateRoute
        component={PushDetails}
        fullRoutePath={`/dashboard/push/:id`}
      />,
    layout: '/dashboard',
    visible: false,
  },
  {
    path: '/profile',
    name: 'My Account',
    icon: AccountCircle,
    component: (props) =>
      <PrivateRoute
        component={User}
        fullRoutePath={`/dashboard/profile`}
      />,
    layout: '/dashboard',
    visible: true,
  },
  {
    path: '/admin/user',
    name: 'Users',
    icon: Group,
    component: (props) =>
      <PrivateRoute
        component={UserList}
        fullRoutePath={`/dashboard/admin/user`}
      />,
    layout: '/dashboard',
    visible: true,
  },
  {
    path: '/admin/user/:id',
    name: 'User',
    icon: Person,
    component: (props) =>
      <PrivateRoute
        component={User}
        fullRoutePath={`/dashboard/admin/user/:id`}
      />,
    layout: '/dashboard',
    visible: false,
  },
];

export default dashboardRoutes;
