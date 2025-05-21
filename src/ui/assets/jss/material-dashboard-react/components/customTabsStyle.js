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
import { hexToRgb, whiteColor } from '../../material-dashboard-react.js';

const customTabsStyle = {
  cardTitle: {
    float: 'left',
    padding: '10px 10px 10px 0px',
    lineHeight: '24px',
  },
  cardTitleRTL: {
    float: 'right',
    padding: '10px 0px 10px 10px !important',
  },
  displayNone: {
    display: 'none !important',
  },
  tabsRoot: {
    minHeight: 'unset !important',
    overflowX: 'visible',
    '& $tabRootButton': {
      fontSize: '0.875rem',
    },
  },
  tabRootButton: {
    minHeight: 'unset !important',
    minWidth: 'unset !important',
    width: 'unset !important',
    height: 'unset !important',
    maxWidth: 'unset !important',
    maxHeight: 'unset !important',
    padding: '10px 15px',
    borderRadius: '3px',
    lineHeight: '24px',
    border: '0 !important',
    color: whiteColor + ' !important',
    marginLeft: '4px',
    '&:last-child': {
      marginLeft: '0px',
    },
  },
  tabSelected: {
    backgroundColor: 'rgba(' + hexToRgb(whiteColor) + ', 0.2)',
    transition: '0.2s background-color 0.1s',
  },
  tabWrapper: {
    display: 'inline-block',
    minHeight: 'unset !important',
    minWidth: 'unset !important',
    width: 'unset !important',
    height: 'unset !important',
    maxWidth: 'unset !important',
    maxHeight: 'unset !important',
    fontWeight: '500',
    fontSize: '12px',
    marginTop: '1px',
    '& > svg,& > .material-icons': {
      verticalAlign: 'middle',
      margin: '-1px 5px 0 0 !important',
    },
  },
};

export default customTabsStyle;
