import React from 'react';
import PropTypes from 'prop-types';
import clsx from 'clsx';
// @material-ui/core components
import { makeStyles } from '@material-ui/core/styles';
// core components
import styles from '../../assets/jss/material-dashboard-react/components/typographyStyle';

const useStyles = makeStyles(styles);

export default function Success(props) {
  const classes = useStyles();
  const { children } = props;
  return <div className={clsx(classes.defaultFontStyle, classes.successText)}>{children}</div>;
}

Success.propTypes = {
  children: PropTypes.node,
};
