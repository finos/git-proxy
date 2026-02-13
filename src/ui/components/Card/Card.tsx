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
import styles from '../../assets/jss/material-dashboard-react/components/cardStyle';

const useStyles = makeStyles(styles);

interface CardProps extends React.ComponentProps<'div'> {
  className?: string;
  plain?: boolean;
  profile?: boolean;
  chart?: boolean;
  children?: React.ReactNode;
}

const Card: React.FC<CardProps> = ({
  className = '',
  children,
  plain = false,
  profile = false,
  chart = false,
  ...rest
}) => {
  const classes = useStyles();

  const cardClasses = clsx({
    [classes.card]: true,
    [classes.cardPlain]: plain,
    [classes.cardProfile]: profile,
    [classes.cardChart]: chart,
    [className]: className,
  });

  return (
    <div className={cardClasses} {...rest}>
      {children}
    </div>
  );
};

export default Card;
