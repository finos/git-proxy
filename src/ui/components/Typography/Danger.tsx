import React from 'react';
import clsx from 'clsx';
import { makeStyles } from '@material-ui/core/styles';
import styles from '../../assets/jss/material-dashboard-react/components/typographyStyle';

const useStyles = makeStyles(styles);

interface DangerProps {
  children?: React.ReactNode;
}

const Danger: React.FC<DangerProps> = ({ children }) => {
  const classes = useStyles();
  return <div className={clsx(classes.primaryText, classes.dangerText)}>{children}</div>;
};

export default Danger;
