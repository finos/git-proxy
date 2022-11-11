/* eslint-disable max-len */
/* eslint-disable require-jsdoc */
import React, {useState} from 'react';
import {Switch, Route, Redirect} from 'react-router-dom';
import PerfectScrollbar from 'perfect-scrollbar';
import 'perfect-scrollbar/css/perfect-scrollbar.css';
import {makeStyles} from '@material-ui/core/styles';
import Navbar from '../components/Navbars/Navbar.js';
import Footer from '../components/Footer/Footer.js';
import Sidebar from '../components/Sidebar/Sidebar.js';
import routes from '../../routes.js';
import styles from '../assets/jss/material-dashboard-react/layouts/adminStyle.js';
import bgImage from '../assets/img/sidebar-2.jpg';
import logo from '../assets/img/reactlogo.png';
import {UserContext} from '../../context.js';
import {getUser} from '../services/user.js';

let ps;
let refresh = false;

const switchRoutes = (
  <Switch>
    {routes.map((prop, key) => {
      if (prop.layout === '/admin') {
        return (
          <Route
            exact path={prop.layout + prop.path}
            component={prop.component}
            key={key}
          />
        );
      }
      return null;
    })}
    <Redirect from="/admin" to="/admin/dashboard" />
  </Switch>
);

const useStyles = makeStyles(styles);

export default function Admin({...rest}) {
  // styles
  const classes = useStyles();
  // ref to help us initialize PerfectScrollbar on windows devices
  const mainPanel = React.createRef();
  // states and functions
  const [image] = React.useState(bgImage);
  const [color] = React.useState('blue');
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [user, setUser] = useState({});


  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };
  const getRoute = () => {
    return window.location.pathname !== '/admin/maps';
  };
  const resizeFunction = () => {
    if (window.innerWidth >= 960) {
      setMobileOpen(false);
    }
  };
  // initialize and destroy the PerfectScrollbar plugin
  React.useEffect( () => {
    async function loadUser() {
      if (navigator.platform.indexOf('Win') > -1) {
        ps = new PerfectScrollbar(mainPanel.current, {
          suppressScrollX: true,
          suppressScrollY: false,
        });
        document.body.style.overflow = 'hidden';
  if (!refresh) {
    refresh = true;
  await getUser((isloading)=>{}, setUser, (auth)=>{}, null, null);
  }
      }
      window.addEventListener('resize', resizeFunction);
       if (!refresh) {
         refresh = true;
          await getUser((isError)=>{}, setUser, ()=>{}, null, null);
       }
    }
    loadUser();

     // Specify how to clean up after this effect:
    return function cleanup() {
      if (navigator.platform.indexOf('Win') > -1) {
        ps && ps.destroy();
      }
      window.removeEventListener('resize', resizeFunction);
    };
  }, [mainPanel]);
  return (
    <UserContext.Provider value={{user, setUser}}>
      <div className={classes.wrapper}>
        <Sidebar
          routes={routes}
          logoText={'Git Proxy'}
          logo={logo}
          image={image}
          handleDrawerToggle={handleDrawerToggle}
          open={mobileOpen}
          color={color}
          {...rest}
        />
        <div className={classes.mainPanel} ref={mainPanel}>
          <Navbar
            routes={routes}
            handleDrawerToggle={handleDrawerToggle}
            {...rest}
          />
          {/* On the /maps route we want the map to be on full screen - this is not possible if the content and conatiner classes are present because they have some paddings which would make the map smaller */}
          {getRoute() ? (
            <div className={classes.content}>
              <div className={classes.container}>{switchRoutes}</div>
            </div>
          ) : (
            <div className={classes.map}>{switchRoutes}</div>
          )}
          {getRoute() ? <Footer /> : null}
        </div>
      </div>
    </UserContext.Provider>
  );
}
