/* eslint-disable max-len */
/* eslint-disable require-jsdoc */
import React from 'react';
import PropTypes from 'prop-types';
import {makeStyles} from '@material-ui/core/styles';
import styles from '../../assets/jss/material-dashboard-react/components/typographyStyle.js';

const useStyles = makeStyles(styles);

export default function Danger(props) {
  const classes = useStyles();
  const {children} = props;
  return (
    <div className={classes.defaultFontStyle + ' ' + classes.dangerText}>
      {children}
    </div>
  );
}

Danger.propTypes = {
  children: PropTypes.node,
};
