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

import { createStyles } from '@material-ui/core/styles';
import { blackColor, whiteColor, hexToRgb } from '../../material-dashboard-react';

const cardStyle = createStyles({
  card: {
    border: '0',
    marginBottom: '30px',
    marginTop: '30px',
    borderRadius: '6px',
    color: `rgba(${hexToRgb(blackColor)}, 0.87)`,
    background: whiteColor,
    width: '100%',
    boxShadow: `0 1px 4px 0 rgba(${hexToRgb(blackColor)}, 0.14)`,
    position: 'relative' as const,
    display: 'flex' as const,
    flexDirection: 'column' as const,
    minWidth: '0',
    wordWrap: 'break-word' as const,
    fontSize: '.875rem',
  },
  cardPlain: {
    background: 'transparent',
    boxShadow: 'none',
  },
  cardProfile: {
    marginTop: '30px',
    textAlign: 'center' as const,
  },
  cardChart: {
    '& p': {
      marginTop: '0px',
      paddingTop: '0px',
    },
  },
});

export default cardStyle;
