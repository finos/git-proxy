import React from 'react';
import clsx from 'clsx';
import { makeStyles } from '@material-ui/core/styles';
import AppBar from '@material-ui/core/AppBar';
import Toolbar from '@material-ui/core/Toolbar';
import IconButton from '@material-ui/core/IconButton';
import Hidden from '@material-ui/core/Hidden';
import Menu from '@material-ui/icons/Menu';
import DashboardNavbarLinks from './DashboardNavbarLinks';
import styles from '../../assets/jss/material-dashboard-react/components/headerStyle';
import { Route } from '../../../types/models';

const useStyles = makeStyles(styles as any);

interface HeaderProps {
  color?: 'primary' | 'info' | 'success' | 'warning' | 'danger';
  rtlActive?: boolean;
  handleDrawerToggle: () => void;
  routes: Route[];
}

const Header: React.FC<HeaderProps> = (props) => {
  const classes = useStyles();

  const makeBrand = (): string => {
    let name = '';
    props.routes.forEach((prop) => {
      if (window.location.href.indexOf(prop.layout + prop.path) !== -1) {
        name = props.rtlActive ? prop.rtlName || prop.name : prop.name;
      }
    });
    return name;
  };

  const { color = 'primary' } = props;
  const appBarClasses = clsx({
    [` ${classes[color]}`]: color,
  });

  return (
    <AppBar style={{ borderRadius: '0px', zIndex: 10, backgroundColor: 'black', boxShadow: 'none' }} className={classes.appBar + appBarClasses}>
      <Toolbar className={classes.container}>
        <div className={classes.flex}>
          {/* Here we create navbar brand, based on route name */}
          <h2
            style={{ marginLeft: '15px', fontSize: '19px', fontWeight: 400 }}
            className={classes.title}
          >
            {makeBrand()}
          </h2>
        </div>
        <Hidden smDown implementation='css'>
          <DashboardNavbarLinks />
        </Hidden>
        <Hidden mdUp implementation='css'>
          <IconButton color='inherit' aria-label='open drawer' onClick={props.handleDrawerToggle}>
            <Menu />
          </IconButton>
        </Hidden>
      </Toolbar>
    </AppBar>
  );
};

export default Header;
