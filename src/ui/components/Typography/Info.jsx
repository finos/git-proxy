import React from 'react';
import PropTypes from 'prop-types';
import clsx from 'clsx';
import { makeStyles } from '@material-ui/core/styles';
import styles from '../../assets/jss/material-dashboard-react/components/typographyStyle';

const useStyles = makeStyles(styles);

export default function Info(props) {
  const classes = useStyles();
  const { children } = props;
  return <div className={clsx(classes.defaultFontStyle, classes.infoText)}>{children}</div>;
}

Info.propTypes = {
  children: PropTypes.node,
};
