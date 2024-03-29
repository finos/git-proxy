/* eslint-disable max-len */
/* eslint-disable require-jsdoc */

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
import Dashboard from '@material-ui/icons/Dashboard';
import Person from '@material-ui/icons/Person';
import DashboardPage from './ui/views/Dashboard/Dashboard.jsx';
import OpenPushRequests from './ui/views/OpenPushRequests/OpenPushRequests.jsx';
import PushDetails from './ui/views/PushDetails/PushDetails.jsx';
import User from './ui/views/User/User.jsx';
import UserList from './ui/views/UserList/UserList.jsx';
import RepoDetails from './ui/views/RepoDetails/RepoDetails.jsx';
import RepoList from './ui/views/RepoList/RepoList.jsx';

const dashboardRoutes = [
  {
    path: '/dashboard',
    name: 'Dashboard',
    icon: Dashboard,
    component: DashboardPage,
    layout: '/admin',
    visible: true,
  },
  {
    path: '/push',
    name: 'Open Push Requests',
    icon: Person,
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
    name: 'My Profile',
    icon: Person,
    component: User,
    layout: '/admin',
    visible: true,
  },
  {
    path: '/user/:id',
    name: 'User Details',
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
    path: '/repo',
    name: 'Repositories',
    icon: Person,
    component: RepoList,
    layout: '/admin',
    visible: true,
  },
  {
    path: '/user',
    name: 'User List',
    icon: Person,
    component: UserList,
    layout: '/admin',
    visible: true,
  },
];

export default dashboardRoutes;
