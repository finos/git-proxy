import React from 'react';
import classNames from 'classnames';
import { NavLink } from 'react-router-dom';
import { makeStyles } from '@material-ui/core/styles';
import Drawer from '@material-ui/core/Drawer';
import Hidden from '@material-ui/core/Hidden';
import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import ListItemText from '@material-ui/core/ListItemText';
import Icon from '@material-ui/core/Icon';
import styles from '../../assets/jss/material-dashboard-react/components/sidebarStyle';

const useStyles = makeStyles(styles as any);

interface Route {
  path: string;
  layout: string;
  name: string;
  icon: string | React.ComponentType;
  visible?: boolean;
  rtlName?: string;
  component: React.ComponentType;
}

interface SidebarProps {
  color: 'purple' | 'blue' | 'green' | 'orange' | 'red';
  logo: string;
  routes: Route[];
  background: string;
  rtlActive?: boolean;
  handleDrawerToggle: () => void;
  open: boolean;
}

const Sidebar: React.FC<SidebarProps> = (props) => {
  const classes = useStyles();

  const activeRoute = (routeName: string): boolean => {
    return window.location.href.indexOf(routeName) > -1;
  };

  const { color, logo, routes, background, rtlActive, open, handleDrawerToggle } = props;

  const links = (
    <List className={classes.list}>
      {routes.map((prop, key) => {
        const activePro = ' ';
        const listItemClasses = classNames({
          [` ${classes[color]}`]: activeRoute(prop.layout + prop.path),
        });

        const whiteFontClasses = classNames({
          [` ${classes.whiteFont}`]: activeRoute(prop.layout + prop.path),
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
                    [classes.itemIconRTL]: rtlActive,
                  })}
                >
                  {prop.icon}
                </Icon>
              ) : (
                <prop.icon
                  className={classNames(classes.itemIcon, whiteFontClasses, {
                    [classes.itemIconRTL]: rtlActive,
                  })}
                />
              )}
              <ListItemText
                primary={rtlActive ? prop.rtlName : prop.name}
                className={classNames(classes.itemText, whiteFontClasses, {
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
          anchor={rtlActive ? 'left' : 'right'}
          open={open}
          classes={{
            paper: classNames(classes.drawerPaper, {
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
            paper: classNames(classes.drawerPaper, {
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
