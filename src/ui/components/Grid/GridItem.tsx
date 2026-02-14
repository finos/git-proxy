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
