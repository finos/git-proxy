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

import { Theme } from '@material-ui/core/styles';
import { createStyles } from '@material-ui/styles';
import { defaultFont, container, primaryColor, grayColor } from '../../material-dashboard-react';

const footerStyle = (theme: Theme) =>
  createStyles({
    block: {
      color: 'inherit',
      padding: '15px',
      textTransform: 'uppercase',
      borderRadius: '3px',
      textDecoration: 'none',
      position: 'relative',
      display: 'block',
      ...defaultFont,
      fontWeight: 500,
      fontSize: '12px',
    },
    left: {
      float: 'left !important' as 'left',
      display: 'block',
    },
    right: {
      padding: '15px 0',
      margin: '0',
      fontSize: '14px',
      float: 'right !important' as 'right',
    },
    footer: {
      bottom: '0',
      borderTop: `1px solid ${grayColor[11]}`,
      padding: '15px 0',
      ...defaultFont,
    },
    container: {
      ...container,
    },
    a: {
      color: primaryColor[0],
      textDecoration: 'none',
      backgroundColor: 'transparent',
    },
    list: {
      marginBottom: '0',
      padding: '0',
      marginTop: '0',
    },
    inlineBlock: {
      display: 'inline-block',
      padding: '0px',
      width: 'auto',
    },
  });

export default footerStyle;
