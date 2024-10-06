import React from 'react';
import classNames from 'classnames';
import PropTypes from 'prop-types';
import makeStyles from '@mui/styles/makeStyles';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import IconButton from '@mui/material/IconButton';
import Hidden from '@mui/material/Hidden';
import { Menu } from '@mui/icons-material';
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
    (<AppBar style={{ borderRadius: '0px', zIndex: 10 }} className={classes.appBar + appBarClasses}>
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
        <Hidden mdDown implementation='css'>
          <AdminNavbarLinks />
        </Hidden>
        <Hidden mdUp implementation='css'>
          <IconButton
            color='inherit'
            aria-label='open drawer'
            onClick={props.handleDrawerToggle}
            size="large">
            <Menu />
          </IconButton>
        </Hidden>
      </Toolbar>
    </AppBar>)
  );
}

Header.propTypes = {
  color: PropTypes.oneOf(['primary', 'info', 'success', 'warning', 'danger']),
  rtlActive: PropTypes.bool,
  handleDrawerToggle: PropTypes.func,
  routes: PropTypes.arrayOf(PropTypes.object),
};
