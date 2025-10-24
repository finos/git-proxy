import React from 'react';
import clsx from 'clsx';
import { makeStyles } from '@material-ui/core/styles';
import Snack from '@material-ui/core/Snackbar';
import IconButton from '@material-ui/core/IconButton';
import Close from '@material-ui/icons/Close';
import styles from '../../assets/jss/material-dashboard-react/components/snackbarContentStyle';

const useStyles = makeStyles(styles);

type Color = 'info' | 'success' | 'warning' | 'danger' | 'primary';
type Placement = 'tl' | 'tr' | 'tc' | 'br' | 'bl' | 'bc';

interface SnackbarProps {
  message: React.ReactNode;
  color?: Color;
  close?: boolean;
  icon?: React.ComponentType<{ className: string }>;
  place?: Placement;
  open: boolean;
  rtlActive?: boolean;
  closeNotification: () => void;
}

const Snackbar: React.FC<SnackbarProps> = (props) => {
  const classes = useStyles();
  const { message, color = 'info', close, icon: Icon, place = 'tr', open, rtlActive } = props;

  let action: React.ReactNode[] = [];
  const messageClasses = clsx({
    [classes.iconMessage]: Icon !== undefined,
  });

  if (close) {
    action = [
      <IconButton
        className={classes.iconButton}
        key='close'
        aria-label='Close'
        color='inherit'
        onClick={props.closeNotification}
      >
        <Close className={classes.close} />
      </IconButton>,
    ];
  }

  const calculateHorizontal = (): 'left' | 'center' | 'right' => {
    if (place.includes('l')) {
      return 'left';
    } else if (place.includes('c')) {
      return 'center';
    }
    return 'right';
  };

  return (
    <Snack
      anchorOrigin={{
        vertical: place.includes('t') ? 'top' : 'bottom',
        horizontal: calculateHorizontal(),
      }}
      open={open}
      message={
        <div>
          {Icon && <Icon className={classes.icon} />}
          <span className={messageClasses}>{message}</span>
        </div>
      }
      action={action}
      ContentProps={{
        classes: {
          root: clsx(classes.root, classes[color]),
          message: classes.message,
          action: clsx({ [classes.actionRTL]: rtlActive }),
        },
      }}
    />
  );
};

export default Snackbar;
