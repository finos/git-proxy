/**
 * @license
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License. You may obtain a copy of the License at
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
import clsx from 'clsx';
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
  const messageClasses = clsx({
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
        root: clsx(classes.root, classes[color]),
        message: classes.message,
        action: clsx({ [classes.actionRTL]: rtlActive }),
      }}
      action={action}
    />
  );
};

export default SnackbarContent;
