import React, { useEffect, useState } from 'react';
import clsx from 'clsx';
import { makeStyles } from '@material-ui/core/styles';
import MenuItem from '@material-ui/core/MenuItem';
import MenuList from '@material-ui/core/MenuList';
import Grow from '@material-ui/core/Grow';
import Paper from '@material-ui/core/Paper';
import ClickAwayListener from '@material-ui/core/ClickAwayListener';
import Hidden from '@material-ui/core/Hidden';
import Popper from '@material-ui/core/Popper';
import Divider from '@material-ui/core/Divider';
import Button from '../CustomButtons/Button';
import styles from '../../assets/jss/material-dashboard-react/components/headerLinksStyle';
import { useNavigate } from 'react-router-dom';
import { AccountCircle } from '@material-ui/icons';
import { getUser } from '../../services/user';
import axios from 'axios';
import { getAxiosConfig } from '../../services/auth';
import { PublicUser } from '../../../db/types';

import { API_BASE } from '../../apiBase';

const useStyles = makeStyles(styles);

const DashboardNavbarLinks: React.FC = () => {
  const classes = useStyles();
  const navigate = useNavigate();
  const [openProfile, setOpenProfile] = useState<HTMLElement | null>(null);
  const [, setAuth] = useState<boolean>(true);
  const [, setIsLoading] = useState<boolean>(true);
  const [, setErrorMessage] = useState<string>('');
  const [user, setUser] = useState<PublicUser | null>(null);

  useEffect(() => {
    getUser(setIsLoading, setUser, setAuth, setErrorMessage);
  }, []);

  const handleClickProfile = (event: React.MouseEvent<HTMLElement>) => {
    if (openProfile && openProfile.contains(event.target as Node)) {
      setOpenProfile(null);
    } else {
      setOpenProfile(event.currentTarget);
    }
  };

  const handleCloseProfile = () => {
    setOpenProfile(null);
  };

  const showProfile = () => {
    navigate('/dashboard/profile', { replace: true });
  };

  const logout = async () => {
    try {
      const { data } = await axios.post(`${API_BASE}/api/auth/logout`, {}, getAxiosConfig());

      if (!data.isAuth && !data.user) {
        setAuth(false);
        navigate(0);
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error('Logout failed:', msg);
    }
  };

  return (
    <div>
      <div className={classes.manager}>
        <Button
          color={window.innerWidth > 959 ? 'transparent' : 'white'}
          justIcon={window.innerWidth > 959}
          simple={window.innerWidth <= 959}
          aria-owns={openProfile ? 'profile-menu-list-grow' : undefined}
          aria-haspopup='true'
          onClick={handleClickProfile}
          className={classes.buttonLink}
        >
          <AccountCircle />
          <Hidden mdUp implementation='css'>
            <p className={classes.linkText}>Profile</p>
          </Hidden>
        </Button>
        <Popper
          open={Boolean(openProfile)}
          anchorEl={openProfile}
          transition
          disablePortal
          className={clsx(classes.popperNav, { [classes.popperClose]: !openProfile })}
        >
          {({ TransitionProps, placement }) => (
            <Grow
              {...TransitionProps}
              style={{
                transformOrigin: placement === 'bottom' ? 'center top' : 'center bottom',
              }}
            >
              <Paper>
                <ClickAwayListener onClickAway={handleCloseProfile}>
                  <MenuList role='menu'>
                    <MenuItem onClick={showProfile} className={classes.dropdownItem}>
                      {user ? 'My Account' : 'Login'}
                    </MenuItem>
                    {!!user && <Divider light />}
                    {!!user && (
                      <MenuItem onClick={logout} className={classes.dropdownItem}>
                        Logout
                      </MenuItem>
                    )}
                  </MenuList>
                </ClickAwayListener>
              </Paper>
            </Grow>
          )}
        </Popper>
      </div>
    </div>
  );
};

export default DashboardNavbarLinks;
