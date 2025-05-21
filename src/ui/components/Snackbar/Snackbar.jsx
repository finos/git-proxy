/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.    
 */
import React from 'react';
import classNames from 'classnames';
import PropTypes from 'prop-types';
import { makeStyles } from '@material-ui/core/styles';
import Snack from '@material-ui/core/Snackbar';
import IconButton from '@material-ui/core/IconButton';
import Close from '@material-ui/icons/Close';
import styles from '../../assets/jss/material-dashboard-react/components/snackbarContentStyle';

const useStyles = makeStyles(styles);

export default function Snackbar(props) {
  const classes = useStyles();
  const { message, color, close, icon, place, open, rtlActive } = props;
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
        onClick={() => props.closeNotification()}
      >
        <Close className={classes.close} />
      </IconButton>,
    ];
  }

  const calculateHorizontal = () => {
    if (place.indexOf('l') !== -1) {
      return 'left';
    } else if (place.indexOf('c') !== -1) {
      return 'center';
    }
    return 'right';
  };

  return (
    <Snack
      anchorOrigin={{
        vertical: place.indexOf('t') === -1 ? 'bottom' : 'top',
        horizontal: calculateHorizontal(),
      }}
      open={open}
      message={
        <div>
          {icon !== undefined ? <props.icon className={classes.icon} /> : null}
          <span className={messageClasses}>{message}</span>
        </div>
      }
      action={action}
      ContentProps={{
        classes: {
          root: classes.root + ' ' + classes[color],
          message: classes.message,
          action: classNames({ [classes.actionRTL]: rtlActive }),
        },
      }}
    />
  );
}

Snackbar.propTypes = {
  message: PropTypes.node.isRequired,
  color: PropTypes.oneOf(['info', 'success', 'warning', 'danger', 'primary']),
  close: PropTypes.bool,
  icon: PropTypes.object,
  place: PropTypes.oneOf(['tl', 'tr', 'tc', 'br', 'bl', 'bc']),
  open: PropTypes.bool,
  rtlActive: PropTypes.bool,
  closeNotification: PropTypes.func,
};
