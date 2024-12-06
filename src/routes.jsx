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
import LicenseList from './ui/views/LicenseList/LicenseList';
import LicenseDetails from './ui/views/LicenseDetails/LicenseDetails';

import { RepoIcon, LawIcon } from '@primer/octicons-react';

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
  {
    path: '/licenses',
    name: 'Licenses',
    icon: LawIcon,
    component: LicenseList,
    layout: '/admin',
    visible: true,
  },
  {
    path: '/license/:id',
    name: 'License',
    icon: Person,
    component: LicenseDetails,
    layout: '/admin',
    visible: false,
  },
];

export default dashboardRoutes;
