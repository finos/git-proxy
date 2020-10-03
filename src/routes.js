/*!

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
// @material-ui/icons
import Dashboard from "@material-ui/icons/Dashboard";
import Person from "@material-ui/icons/Person";

import DashboardPage from "ui/views/Dashboard/Dashboard.js";
import OpenPushRequests from "ui/views/OpenPushRequests/OpenPushRequests.js";
import Login from "ui/views/Login/Login.js";

// import LibraryBooks from "@material-ui/icons/LibraryBooks";
// import BubbleChart from "@material-ui/icons/BubbleChart";
// import LocationOn from "@material-ui/icons/LocationOn";
// import Notifications from "@material-ui/icons/Notifications";
// import Unarchive from "@material-ui/icons/Unarchive";
// import Language from "@material-ui/icons/Language";
// core components/views for Admin layout
// import UserProfile from "ui/views/UserProfile/UserProfile.js";


const dashboardRoutes = [
  {
    path: "/dashboard",
    name: "Dashboard",    
    icon: Dashboard,
    component: DashboardPage,
    layout: "/admin"
  },
  {
    path: "/open-pushges",
    name: "Open Push Requests",    
    icon: Person,
    component: OpenPushRequests,
    layout: "/admin"
  },
  {
    path: "/login",
    name: "Login",    
    icon: Person,
    component: Login,
    layout: "/admin"
  },  
];

export default dashboardRoutes;
