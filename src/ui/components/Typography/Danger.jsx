import React from 'react';
import PropTypes from 'prop-types';
import makeStyles from '@mui/styles/makeStyles';
import styles from '../../assets/jss/material-dashboard-react/components/typographyStyle';

const useStyles = makeStyles(styles);

export default function Danger(props) {
  const classes = useStyles();
  const { children } = props;
  return <div className={classes.defaultFontStyle + ' ' + classes.dangerText}>{children}</div>;
}

Danger.propTypes = {
  children: PropTypes.node,
};
