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
import React, { useEffect } from 'react';
import classNames from 'classnames';
import { makeStyles } from '@material-ui/core/styles';
import MenuItem from '@material-ui/core/MenuItem';
import MenuList from '@material-ui/core/MenuList';
import Grow from '@material-ui/core/Grow';
import Paper from '@material-ui/core/Paper';
import ClickAwayListener from '@material-ui/core/ClickAwayListener';
import Hidden from '@material-ui/core/Hidden';
import Poppers from '@material-ui/core/Popper';
import Divider from '@material-ui/core/Divider';
import Button from '../CustomButtons/Button';
import styles from '../../assets/jss/material-dashboard-react/components/headerLinksStyle';
import { useNavigate } from 'react-router-dom';
import { AccountCircle } from '@material-ui/icons';
import { getUser } from '../../services/user';
import axios from 'axios';
import { getCookie } from '../../utils';

const useStyles = makeStyles(styles);

export default function AdminNavbarLinks() {
  const classes = useStyles();
  const navigate = useNavigate();
  const [openProfile, setOpenProfile] = React.useState(null);
  const [, setAuth] = React.useState(true);
  const [, setIsLoading] = React.useState(true);
  const [, setIsError] = React.useState(false);
  const [data, setData] = React.useState(false);

  useEffect(() => {
    getUser(setIsLoading, setData, setAuth, setIsError);
  }, []);

  const handleClickProfile = (event) => {
    if (openProfile && openProfile.contains(event.target)) {
      setOpenProfile(null);
    } else {
      setOpenProfile(event.currentTarget);
    }
  };
  const handleCloseProfile = () => {
    setOpenProfile(null);
  };

  const showProfile = () => {
    navigate('/admin/profile', { replace: true });
  };

  const logout = () => {
    axios
      .post(
        `${import.meta.env.VITE_API_URI}/api/auth/logout`,
        {},
        {
          withCredentials: true,
          headers: {
            'X-CSRF-TOKEN': getCookie('csrf'),
          },
        },
      )
      .then((res) => {
        if (!res.data.isAuth && !res.data.user) {
          setAuth(false);
          navigate(0);
        }
      });
  };

  return (
    <div>
      <div className={classes.manager}>
        <Button
          color={window.innerWidth > 959 ? 'transparent' : 'white'}
          justIcon={window.innerWidth > 959}
          simple={window.innerWidth <= 959}
          aria-owns={openProfile ? 'profile-menu-list-grow' : null}
          aria-haspopup='true'
          onClick={handleClickProfile}
          className={classes.buttonLink}
        >
          <AccountCircle />
          <Hidden mdUp implementation='css'>
            <p className={classes.linkText}>Profile</p>
          </Hidden>
        </Button>
        <Poppers
          open={Boolean(openProfile)}
          anchorEl={openProfile}
          transition
          disablePortal
          className={classNames({ [classes.popperClose]: !openProfile }) + ' ' + classes.popperNav}
        >
          {({ TransitionProps, placement }) => (
            <Grow
              {...TransitionProps}
              id='profile-menu-list-grow'
              style={{
                transformOrigin: placement === 'bottom' ? 'center top' : 'center bottom',
              }}
            >
              <Paper>
                <ClickAwayListener onClickAway={handleCloseProfile}>
                  <MenuList role='menu'>
                    <MenuItem onClick={showProfile} className={classes.dropdownItem}>
                      {data ? 'My Account' : 'Login'}
                    </MenuItem>
                    {!!data && <Divider light />}
                    {!!data && (
                      <MenuItem onClick={logout} className={classes.dropdownItem}>
                        Logout
                      </MenuItem>
                    )}
                  </MenuList>
                </ClickAwayListener>
              </Paper>
            </Grow>
          )}
        </Poppers>
      </div>
    </div>
  );
}
