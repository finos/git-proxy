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
import styles from '../../assets/jss/material-dashboard-react/components/cardIconStyle';

const useStyles = makeStyles(styles);

type CardIconColor = 'warning' | 'success' | 'danger' | 'info' | 'primary' | 'rose';

interface CardIconProps {
  className?: string;
  color?: CardIconColor;
  children?: React.ReactNode;
  [key: string]: any;
}

const CardIcon: React.FC<CardIconProps> = (props) => {
  const classes = useStyles();
  const { className, children, color, ...rest } = props;

  const cardIconClasses = clsx({
    [classes.cardIcon]: true,
    [color ? classes[`${color}CardHeader`] : '']: color,
    [className || '']: className !== undefined,
  });

  return (
    <div className={cardIconClasses} {...rest}>
      {children}
    </div>
  );
};

export default CardIcon;
