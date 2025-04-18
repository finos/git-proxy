import React, { ReactNode } from 'react';
import { makeStyles, Theme } from '@material-ui/core/styles';
import Grid, { GridProps } from '@material-ui/core/Grid';

const useStyles = makeStyles((theme: Theme) => ({
  grid: {
    padding: '0 15px !important',
  },
}));

export interface GridItemProps extends GridProps {
  children?: ReactNode;
}

const GridItem: React.FC<GridItemProps> = ({ children, ...rest }) => {
  const classes = useStyles();
  return (
    <Grid item {...rest} className={classes.grid}>
      {children}
    </Grid>
  );
};

export default GridItem;
