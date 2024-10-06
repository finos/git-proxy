import React from 'react';
import classNames from 'classnames';
import PropTypes from 'prop-types';
import { NavLink } from 'react-router-dom';
import makeStyles from '@mui/styles/makeStyles';
import Drawer from '@mui/material/Drawer';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Icon from '@mui/material/Icon';
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
      <Drawer
        sx={{ display: { md: 'none', xs: 'block' } }}
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

      <Drawer
        sx={{ display: { xs: 'none', md: 'block' } }}
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
