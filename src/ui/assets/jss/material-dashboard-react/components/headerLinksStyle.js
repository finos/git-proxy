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
import { defaultFont, dangerColor, whiteColor } from '../../material-dashboard-react.js';

// eslint-disable-next-line max-len
import dropdownStyle from '../dropdownStyle.js';

const headerLinksStyle = (theme) => ({
  ...dropdownStyle(theme),
  search: {
    '& > div': {
      marginTop: '0',
    },
    [theme.breakpoints.down('sm')]: {
      margin: '10px 15px !important',
      float: 'none !important',
      paddingTop: '1px',
      paddingBottom: '1px',
      padding: '0!important',
      width: '60%',
      marginTop: '40px',
      '& input': {
        color: whiteColor,
      },
    },
  },
  linkText: {
    zIndex: '4',
    ...defaultFont,
    fontSize: '14px',
    margin: '0px',
  },
  buttonLink: {
    [theme.breakpoints.down('sm')]: {
      display: 'flex',
      margin: '10px 15px 0',
      width: '-webkit-fill-available',
      '& svg': {
        width: '24px',
        height: '30px',
        marginRight: '15px',
        marginLeft: '-15px',
      },
      '& .fab,& .fas,& .far,& .fal,& .material-icons': {
        fontSize: '24px',
        lineHeight: '30px',
        width: '24px',
        height: '30px',
        marginRight: '15px',
        marginLeft: '-15px',
      },
      '& > span': {
        justifyContent: 'flex-start',
        width: '100%',
      },
    },
  },
  searchButton: {
    [theme.breakpoints.down('sm')]: {
      top: '-50px !important',
      marginRight: '22px',
      float: 'right',
    },
  },
  margin: {
    zIndex: '4',
    margin: '0',
  },
  searchIcon: {
    width: '17px',
    zIndex: '4',
  },
  notifications: {
    zIndex: '4',
    [theme.breakpoints.up('md')]: {
      position: 'absolute',
      top: '2px',
      border: '1px solid ' + whiteColor,
      right: '4px',
      fontSize: '9px',
      background: dangerColor[0],
      color: whiteColor,
      minWidth: '16px',
      height: '16px',
      borderRadius: '10px',
      textAlign: 'center',
      lineHeight: '16px',
      verticalAlign: 'middle',
      display: 'block',
    },
    [theme.breakpoints.down('sm')]: {
      ...defaultFont,
      fontSize: '14px',
      marginRight: '8px',
    },
  },
  manager: {
    [theme.breakpoints.down('sm')]: {
      width: '100%',
    },
    display: 'inline-block',
  },
  searchWrapper: {
    [theme.breakpoints.down('sm')]: {
      width: '-webkit-fill-available',
      margin: '10px 15px 0',
    },
    display: 'inline-block',
  },
});

export default headerLinksStyle;
