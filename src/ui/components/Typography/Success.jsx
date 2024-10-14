import React from 'react';
import PropTypes from 'prop-types';
import makeStyles from '@mui/styles/makeStyles';
// core components
import styles from '../../assets/jss/material-dashboard-react/components/typographyStyle';

const useStyles = makeStyles(styles);

export default function Success(props) {
  const classes = useStyles();
  const { children } = props;
  return <div className={classes.defaultFontStyle + ' ' + classes.successText}>{children}</div>;
}

Success.propTypes = {
  children: PropTypes.node,
};
