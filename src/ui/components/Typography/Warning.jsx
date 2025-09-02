import React from 'react';
import PropTypes from 'prop-types';
import clsx from 'clsx';
// @material-ui/core components
import { makeStyles } from '@material-ui/core/styles';
// core components
import styles from 'ui/assets/jss/material-dashboard-react/components/typographyStyle';

const useStyles = makeStyles(styles);

export default function Warning(props) {
  const classes = useStyles();
  const { children } = props;
  return <div className={clsx(classes.defaultFontStyle, classes.warningText)}>{children}</div>;
}

Warning.propTypes = {
  children: PropTypes.node,
};
