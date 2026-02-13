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
import styles from '../../assets/jss/material-dashboard-react/components/cardFooterStyle';

const useStyles = makeStyles(styles);

interface CardFooterProps extends React.ComponentProps<'div'> {
  className?: string;
  plain?: boolean;
  profile?: boolean;
  stats?: boolean;
  chart?: boolean;
  children?: React.ReactNode;
}

const CardFooter: React.FC<CardFooterProps> = ({
  className,
  children,
  plain,
  profile,
  stats,
  chart,
  ...rest
}) => {
  const classes = useStyles();

  const cardFooterClasses = clsx({
    [classes.cardFooter]: true,
    [classes.cardFooterPlain]: plain,
    [classes.cardFooterProfile]: profile,
    [classes.cardFooterStats]: stats,
    [classes.cardFooterChart]: chart,
    [className || '']: className !== undefined,
  });

  return (
    <div className={cardFooterClasses} {...rest}>
      {children}
    </div>
  );
};

export default CardFooter;
