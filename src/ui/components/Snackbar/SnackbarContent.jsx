import React from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import makeStyles from '@mui/styles/makeStyles';
import Snack from '@mui/material/SnackbarContent';
import IconButton from '@mui/material/IconButton';
import { Close } from '@mui/icons-material';
import styles from '../../assets/jss/material-dashboard-react/components/snackbarContentStyle';

const useStyles = makeStyles(styles);

export default function SnackbarContent(props) {
  const classes = useStyles();
  const { message, color, close, icon, rtlActive } = props;
  let action = [];
  const messageClasses = classNames({
    [classes.iconMessage]: icon !== undefined,
  });
  if (close !== undefined) {
    action = [
      <IconButton
        className={classes.iconButton}
        key='close'
        aria-label='Close'
        color='inherit'
        size="large">
        <Close className={classes.close} />
      </IconButton>,
    ];
  }
  return (
    <Snack
      message={
        <div>
          {icon !== undefined ? <props.icon className={classes.icon} /> : null}
          <span className={messageClasses}>{message}</span>
        </div>
      }
      classes={{
        root: classes.root + ' ' + classes[color],
        message: classes.message,
        action: classNames({ [classes.actionRTL]: rtlActive }),
      }}
      action={action}
    />
  );
}

SnackbarContent.propTypes = {
  message: PropTypes.node.isRequired,
  color: PropTypes.oneOf(['info', 'success', 'warning', 'danger', 'primary']),
  close: PropTypes.bool,
  icon: PropTypes.object,
  rtlActive: PropTypes.bool,
};
