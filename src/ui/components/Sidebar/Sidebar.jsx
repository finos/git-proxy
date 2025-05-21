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
import React from 'react';
import classNames from 'classnames';
import PropTypes from 'prop-types';
import { NavLink } from 'react-router-dom';
import { makeStyles } from '@material-ui/core/styles';
import Drawer from '@material-ui/core/Drawer';
import Hidden from '@material-ui/core/Hidden';
import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import ListItemText from '@material-ui/core/ListItemText';
import Icon from '@material-ui/core/Icon';
import styles from '../../assets/jss/material-dashboard-react/components/sidebarStyle';

const useStyles = makeStyles(styles);

export default function Sidebar(props) {
  const classes = useStyles();
  // verifies if routeName is the one active (in browser input)
  function activeRoute(routeName) {
    return window.location.href.indexOf(routeName) > -1 ? true : false;
  }
  const { color, logo, routes, background } = props;
  const links = (
    <List className={classes.list}>
      {routes.map((prop, key) => {
        const activePro = ' ';
        const listItemClasses = classNames({
          [' ' + classes[color]]: activeRoute(prop.layout + prop.path),
        });

        const whiteFontClasses = classNames({
          [' ' + classes.whiteFont]: activeRoute(prop.layout + prop.path),
        });

        if (!prop.visible) {
          return <div key={key}></div>;
        }
        return (
          <NavLink
            to={prop.layout + prop.path}
            className={activePro + classes.item}
            key={key}
            style={{ textDecoration: 'none' }}
          >
            <ListItem button className={classes.itemLink + listItemClasses}>
              {typeof prop.icon === 'string' ? (
                <Icon
                  className={classNames(classes.itemIcon, whiteFontClasses, {
                    [classes.itemIconRTL]: props.rtlActive,
                  })}
                >
                  {prop.icon}
                </Icon>
              ) : (
                <prop.icon
                  className={classNames(classes.itemIcon, whiteFontClasses, {
                    [classes.itemIconRTL]: props.rtlActive,
                  })}
                />
              )}
              <ListItemText
                primary={props.rtlActive ? prop.rtlName : prop.name}
                className={classNames(classes.itemText, whiteFontClasses, {
                  [classes.itemTextRTL]: props.rtlActive,
                })}
                disableTypography={true}
              />
            </ListItem>
          </NavLink>
        );
      })}
    </List>
  );
  const brand = (
    <div className={classes.logo}>
      <a style={{ textDecoration: 'none' }} href='/admin/repo'>
        <div style={{ textAlign: 'center' }}>
          <img
            style={{ verticalAlign: 'middle', filter: 'brightness(0) invert(1)' }}
            width={'105px'}
            src={logo}
            alt='logo'
          />
        </div>
      </a>
    </div>
  );
  return (
    <div style={{ borderRight: '1px solid #d3d3d3' }}>
      <Hidden mdUp implementation='css'>
        <Drawer
          variant='temporary'
          anchor={props.rtlActive ? 'left' : 'right'}
          open={props.open}
          classes={{
            paper: classNames(classes.drawerPaper, {
              [classes.drawerPaperRTL]: props.rtlActive,
            }),
          }}
          onClose={props.handleDrawerToggle}
          ModalProps={{
            keepMounted: true, // Better open performance on mobile.
          }}
        >
          {brand}
          <div className={classes.sidebarWrapper}>{links}</div>
          <div className={classes.background} style={{ backgroundColor: background }} />
        </Drawer>
      </Hidden>
      <Hidden smDown implementation='css'>
        <Drawer
          anchor={props.rtlActive ? 'right' : 'left'}
          variant='permanent'
          open
          classes={{
            paper: classNames(classes.drawerPaper, {
              [classes.drawerPaperRTL]: props.rtlActive,
            }),
          }}
        >
          {brand}
          <div className={classes.sidebarWrapper}>{links}</div>
          <div className={classes.background} style={{ backgroundColor: background }} />
        </Drawer>
      </Hidden>
    </div>
  );
}

Sidebar.propTypes = {
  rtlActive: PropTypes.bool,
  handleDrawerToggle: PropTypes.func,
  bgColor: PropTypes.oneOf(['purple', 'blue', 'green', 'orange', 'red']),
  logo: PropTypes.string,
  image: PropTypes.string,
  routes: PropTypes.arrayOf(PropTypes.object),
  open: PropTypes.bool,
};
