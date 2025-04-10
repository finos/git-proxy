import React from 'react';
import classNames from 'classnames';
import { makeStyles } from '@material-ui/core/styles';
import MuiSnackbarContent from '@material-ui/core/SnackbarContent';
import IconButton from '@material-ui/core/IconButton';
import Close from '@material-ui/icons/Close';
import styles from '../../assets/jss/material-dashboard-react/components/snackbarContentStyle';

const useStyles = makeStyles(styles);

type Color = 'info' | 'success' | 'warning' | 'danger' | 'primary';

interface SnackbarContentProps {
  message: React.ReactNode;
  color?: Color;
  close?: boolean;
  icon?: React.ComponentType<{ className: string }>;
  rtlActive?: boolean;
}

const SnackbarContent: React.FC<SnackbarContentProps> = (props) => {
  const classes = useStyles();
  const { message, color = 'info', close, icon: Icon, rtlActive } = props;

  let action: React.ReactNode[] = [];
  const messageClasses = classNames({
    [classes.iconMessage]: Icon !== undefined,
  });

  if (close) {
    action = [
      <IconButton className={classes.iconButton} key='close' aria-label='Close' color='inherit'>
        <Close className={classes.close} />
      </IconButton>,
    ];
  }

  return (
    <MuiSnackbarContent
      message={
        <div>
          {Icon && <Icon className={classes.icon} />}
          <span className={messageClasses}>{message}</span>
        </div>
      }
      classes={{
        root: `${classes.root} ${classes[color]}`,
        message: classes.message,
        action: classNames({ [classes.actionRTL]: rtlActive }),
      }}
      action={action}
    />
  );
};

export default SnackbarContent;
