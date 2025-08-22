import React from 'react';
import PropTypes from 'prop-types';
import clsx from 'clsx';
import { makeStyles } from '@material-ui/core/styles';
import styles from '../../assets/jss/material-dashboard-react/components/typographyStyle';

const useStyles = makeStyles(styles);

export default function Danger(props) {
  const classes = useStyles();
  const { children } = props;
  return <div className={clsx(classes.primaryText, classes.dangerText)}>{children}</div>;
}

Danger.propTypes = {
  children: PropTypes.node,
};
