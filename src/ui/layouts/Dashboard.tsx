import React, { useState, useEffect, useRef } from 'react';
import { Routes, Route, Navigate, useParams } from 'react-router-dom';
import PerfectScrollbar from 'perfect-scrollbar';
import 'perfect-scrollbar/css/perfect-scrollbar.css';
import { makeStyles } from '@material-ui/core/styles';
import Navbar from '../components/Navbars/Navbar';
import Footer from '../components/Footer/Footer';
import Sidebar from '../components/Sidebar/Sidebar';
import routes from '../../routes';
import styles from '../assets/jss/material-dashboard-react/layouts/dashboardStyle';
import logo from '../assets/img/git-proxy.png';
import { UserContext } from '../context';
import { getUser } from '../services/user';
import { Route as RouteType } from '../types';
import { PublicUser } from '../../db/types';

interface DashboardProps {
  [key: string]: any;
}

let ps: PerfectScrollbar | undefined;
let refresh = false;

const useStyles = makeStyles(styles as any);

const Dashboard: React.FC<DashboardProps> = ({ ...rest }) => {
  const classes = useStyles();
  const mainPanel = useRef<HTMLDivElement>(null);
  const [color] = useState<'purple' | 'blue' | 'green' | 'orange' | 'red'>('blue');
  const [mobileOpen, setMobileOpen] = useState<boolean>(false);
  const [user, setUser] = useState<PublicUser>({} as PublicUser);
  const { id } = useParams<{ id?: string }>();

  const handleDrawerToggle = () => setMobileOpen((prev) => !prev);
  const isMapRoute = () => window.location.pathname === '/dashboard/maps';

  const resizeFunction = () => {
    if (window.innerWidth >= 960) {
      setMobileOpen(false);
    }
  };

  const switchRoutes = (
    <Routes>
      {routes.map((prop: RouteType, key: number) => {
        if (prop.layout === '/dashboard') {
          const Component = prop.component;
          return <Route path={prop.path} element={<Component />} key={key} />;
        }
        return null;
      })}
      <Route path='/dashboard' element={<Navigate to='/dashboard/repo' />} />
    </Routes>
  );

  useEffect(() => {
    async function loadUser() {
      if (navigator.platform.indexOf('Win') > -1 && mainPanel.current) {
        ps = new PerfectScrollbar(mainPanel.current, {
          suppressScrollX: true,
          suppressScrollY: false,
        });
        document.body.style.overflow = 'hidden';
      }

      if (!refresh) {
        refresh = true;
        await getUser(undefined, setUser);
      }

      window.addEventListener('resize', resizeFunction);
    }

    loadUser();

    return () => {
      if (navigator.platform.indexOf('Win') > -1 && ps) {
        ps.destroy();
      }
      window.removeEventListener('resize', resizeFunction);
    };
  }, [id]);

  return (
    <UserContext.Provider value={{ user, setUser } as any}>
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
          {isMapRoute() ? (
            <div className={classes.map}>{switchRoutes}</div>
          ) : (
            <>
              <div className={classes.content}>
                <div className={classes.container}>{switchRoutes}</div>
              </div>
              <Footer />
            </>
          )}
        </div>
      </div>
    </UserContext.Provider>
  );
};

export default Dashboard;
