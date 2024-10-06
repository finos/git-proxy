import React, { useState } from 'react';
import { Routes, Route, Navigate, useParams } from 'react-router-dom';
import PerfectScrollbar from 'perfect-scrollbar';
import 'perfect-scrollbar/css/perfect-scrollbar.css';
import makeStyles from '@mui/styles/makeStyles';
import Navbar from '../components/Navbars/Navbar';
import Footer from '../components/Footer/Footer';
import Sidebar from '../components/Sidebar/Sidebar';
import routes from '../../routes';
import styles from '../assets/jss/material-dashboard-react/layouts/adminStyle';
import logo from '../assets/img/git-proxy.png';
import { UserContext } from '../../context';
import { getUser } from '../services/user';

let ps;
let refresh = false;

const switchRoutes = (
  <Routes>
    {routes.map((prop, key) => {
      if (prop.layout === '/admin') {
        return <Route exact path={prop.path} element={<prop.component />} key={key} />;
      }
      return null;
    })}
    <Route exact path='/admin' element={<Navigate to='/admin/repo' />} />
  </Routes>
);

const useStyles = makeStyles(styles);

export default function Admin({ ...rest }) {
  // styles
  const classes = useStyles();
  // ref to help us initialize PerfectScrollbar on windows devices
  const mainPanel = React.createRef();
  // states and functions
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

  const { id } = useParams();
  React.useEffect(() => {
    async function loadUser() {
      if (navigator.platform.indexOf('Win') > -1) {
        ps = new PerfectScrollbar(mainPanel.current, {
          suppressScrollX: true,
          suppressScrollY: false,
        });
        document.body.style.overflow = 'hidden';
        if (!refresh) {
          refresh = true;
          await getUser(null, setUser, null, null, null);
        }
      }
      window.addEventListener('resize', resizeFunction);
      if (!refresh) {
        refresh = true;
        await getUser(null, setUser, null, null, null);
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
  }, [id]);
  return (
    <UserContext.Provider value={{ user, setUser }}>
      <div className={classes.wrapper}>
        <Sidebar
          background='#1a1a1a'
          routes={routes}
          logo={logo}
          handleDrawerToggle={handleDrawerToggle}
          open={mobileOpen}
          color={color}
          {...rest}
        />
        <div className={classes.mainPanel} ref={mainPanel}>
          <Navbar routes={routes} handleDrawerToggle={handleDrawerToggle} {...rest} />
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
