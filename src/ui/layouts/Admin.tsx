import React, { useState, useEffect, useRef } from 'react';
import { Routes, Route, Navigate, useParams } from 'react-router-dom';
import PerfectScrollbar from 'perfect-scrollbar';
import 'perfect-scrollbar/css/perfect-scrollbar.css';
import { makeStyles } from '@material-ui/core/styles';
import Navbar from '../components/Navbars/Navbar';
import Footer from '../components/Footer/Footer';
import Sidebar from '../components/Sidebar/Sidebar';
import routes from '../../routes';
import styles from '../assets/jss/material-dashboard-react/layouts/adminStyle';
import logo from '../assets/img/git-proxy.png';
import { UserContext } from '../../context';
import { getUser } from '../services/user';

interface RouteType {
  layout: string;
  path: string;
  component: React.ComponentType;
}

interface AdminProps {
  [key: string]: any;
}

interface UserType {
  id?: string;
  name?: string;
  email?: string;
}

let ps: PerfectScrollbar | undefined;
let refresh = false;

const useStyles = makeStyles(styles as any);

const Admin: React.FC<AdminProps> = ({ ...rest }) => {
  const classes = useStyles();
  const mainPanel = useRef<HTMLDivElement>(null);
  const [color] = useState<'purple' | 'blue' | 'green' | 'orange' | 'red'>('blue');
  const [mobileOpen, setMobileOpen] = useState<boolean>(false);
  const [user, setUser] = useState<UserType>({});
  const { id } = useParams();

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const getRoute = (): boolean => {
    return window.location.pathname !== '/admin/maps';
  };

  const resizeFunction = () => {
    if (window.innerWidth >= 960) {
      setMobileOpen(false);
    }
  };

  const switchRoutes = (
    <Routes>
      {routes.map((prop: RouteType, key: number) => {
        if (prop.layout === '/admin') {
          const Component = prop.component;
          return <Route path={prop.path} element={<Component />} key={key} />;
        }
        return null;
      })}
      <Route path='/admin' element={<Navigate to='/admin/repo' />} />
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
        await getUser(null, setUser, null, null, null);
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
};

export default Admin;
