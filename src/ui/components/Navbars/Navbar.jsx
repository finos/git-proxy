import React from 'react';
import classNames from 'classnames';
import PropTypes from 'prop-types';
import { makeStyles } from '@material-ui/core/styles';
import AppBar from '@material-ui/core/AppBar';
import Toolbar from '@material-ui/core/Toolbar';
import IconButton from '@material-ui/core/IconButton';
import Hidden from '@material-ui/core/Hidden';
import Menu from '@material-ui/icons/Menu';
import AdminNavbarLinks from './AdminNavbarLinks';
import styles from '../../assets/jss/material-dashboard-react/components/headerStyle';

const useStyles = makeStyles(styles);

export default function Header(props) {
  const classes = useStyles();
  function makeBrand() {
    let name;
    props.routes.map((prop) => {
      if (window.location.href.indexOf(prop.layout + prop.path) !== -1) {
        name = props.rtlActive ? prop.rtlName : prop.name;
      }
      return null;
    });
    return name;
  }
  const { color } = props;
  const appBarClasses = classNames({
    [' ' + classes[color]]: color,
  });
  return (
    <AppBar style={{ borderRadius: '0px', zIndex: 10 }} className={classes.appBar + appBarClasses}>
      <Toolbar className={classes.container}>
        <div className={classes.flex}>
          {/* Here we create navbar brand, based on route name */}
          <h2
            style={{ marginLeft: '15px', fontSize: '19px', fontWeight: 400 }}
            color='transparent'
            className={classes.title}
          >
            {makeBrand()}
          </h2>
        </div>
        <Hidden smDown implementation='css'>
          <AdminNavbarLinks />
        </Hidden>
        <Hidden mdUp implementation='css'>
          <IconButton color='inherit' aria-label='open drawer' onClick={props.handleDrawerToggle}>
            <Menu />
          </IconButton>
        </Hidden>
      </Toolbar>
    </AppBar>
  );
}

Header.propTypes = {
  color: PropTypes.oneOf(['primary', 'info', 'success', 'warning', 'danger']),
  rtlActive: PropTypes.bool,
  handleDrawerToggle: PropTypes.func,
  routes: PropTypes.arrayOf(PropTypes.object),
};
