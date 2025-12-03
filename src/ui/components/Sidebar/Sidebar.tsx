import React from 'react';
import clsx from 'clsx';
import { NavLink } from 'react-router-dom';
import { makeStyles } from '@material-ui/core/styles';
import Drawer from '@material-ui/core/Drawer';
import Hidden from '@material-ui/core/Hidden';
import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import ListItemText from '@material-ui/core/ListItemText';
import Icon from '@material-ui/core/Icon';
import styles from '../../assets/jss/material-dashboard-react/components/sidebarStyle';
import { Route } from '../../types';

const useStyles = makeStyles(styles as any);

interface SidebarProps {
  color: 'purple' | 'blue' | 'green' | 'orange' | 'red';
  logo: string;
  routes: Route[];
  background: string;
  rtlActive?: boolean;
  handleDrawerToggle: () => void;
  open: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({
  color,
  logo,
  routes,
  background,
  rtlActive,
  open,
  handleDrawerToggle,
}) => {
  const classes = useStyles();

  const activeRoute = (routeName: string) => window.location.href.includes(routeName);

  const links = (
    <List className={classes.list}>
      {routes.map((prop, key) => {
        const activePro = ' ';
        const listItemClasses = clsx({
          [` ${classes[color]}`]: activeRoute(prop.layout + prop.path),
        });
        const whiteFontClasses = clsx({
          [` ${classes.whiteFont}`]: activeRoute(prop.layout + prop.path),
        });

        if (!prop.visible) return <div key={key} />;

        const IconComponent = prop.icon as React.ElementType;

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
                  className={clsx(classes.itemIcon, whiteFontClasses, {
                    [classes.itemIconRTL]: rtlActive,
                  })}
                >
                  {prop.icon}
                </Icon>
              ) : (
                <IconComponent
                  className={clsx(classes.itemIcon, whiteFontClasses, {
                    [classes.itemIconRTL]: rtlActive,
                  })}
                />
              )}
              <ListItemText
                primary={rtlActive ? prop.rtlName : prop.name}
                className={clsx(classes.itemText, whiteFontClasses, {
                  [classes.itemTextRTL]: rtlActive,
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
      <a style={{ textDecoration: 'none' }} href='/dashboard/repo'>
        <div style={{ textAlign: 'center' }}>
          <img
            src={logo}
            alt='logo'
            width={105}
            style={{ verticalAlign: 'middle', filter: 'brightness(0) invert(1)' }}
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
          anchor={rtlActive ? 'left' : 'right'}
          open={open}
          classes={{
            paper: clsx(classes.drawerPaper, {
              [classes.drawerPaperRTL]: rtlActive,
            }),
          }}
          onClose={handleDrawerToggle}
          ModalProps={{
            keepMounted: true,
          }}
        >
          {brand}
          <div className={classes.sidebarWrapper}>{links}</div>
          <div className={classes.background} style={{ backgroundColor: background }} />
        </Drawer>
      </Hidden>
      <Hidden smDown implementation='css'>
        <Drawer
          anchor={rtlActive ? 'right' : 'left'}
          variant='permanent'
          open
          classes={{
            paper: clsx(classes.drawerPaper, {
              [classes.drawerPaperRTL]: rtlActive,
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
};

export default Sidebar;
