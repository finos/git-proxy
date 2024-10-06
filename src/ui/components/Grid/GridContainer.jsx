import React from 'react';
import PropTypes from 'prop-types';
import makeStyles from '@mui/styles/makeStyles';
import Grid from '@mui/material/Grid';
import { increaseSpecificity } from '../../assets/jss/material-dashboard-react';

const styles = {
  grid: increaseSpecificity({
    margin: '0 -15px !important',
    width: 'unset',
  }),
};

const useStyles = makeStyles(styles);

export default function GridContainer(props) {
  const classes = useStyles();
  const { children, ...rest } = props;
  return (
    <Grid container {...rest} className={classes.grid}>
      {children}
    </Grid>
  );
}

GridContainer.propTypes = {
  children: PropTypes.node,
};
