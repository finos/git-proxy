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
import {
  defaultFont,
  primaryBoxShadow,
  infoBoxShadow,
  successBoxShadow,
  warningBoxShadow,
  dangerBoxShadow,
  roseBoxShadow,
  whiteColor,
  blackColor,
  grayColor,
  infoColor,
  successColor,
  dangerColor,
  roseColor,
  primaryColor,
  warningColor,
  hexToRgb,
} from '../../material-dashboard-react.js';

const snackbarContentStyle = {
  root: {
    ...defaultFont,
    flexWrap: 'unset',
    position: 'relative',
    padding: '20px 15px',
    lineHeight: '20px',
    marginBottom: '20px',
    fontSize: '14px',
    backgroundColor: whiteColor,
    color: grayColor[7],
    borderRadius: '3px',
    minWidth: 'unset',
    maxWidth: 'unset',
    boxShadow:
      '0 12px 20px -10px rgba(' +
      hexToRgb(whiteColor) +
      ', 0.28), 0 4px 20px 0px rgba(' +
      hexToRgb(blackColor) +
      ', 0.12), 0 7px 8px -5px rgba(' +
      hexToRgb(whiteColor) +
      ', 0.2)',
  },
  top20: {
    top: '20px',
  },
  top40: {
    top: '40px',
  },
  info: {
    backgroundColor: infoColor[3],
    color: whiteColor,
    ...infoBoxShadow,
  },
  success: {
    backgroundColor: successColor[3],
    color: whiteColor,
    ...successBoxShadow,
  },
  warning: {
    backgroundColor: warningColor[3],
    color: whiteColor,
    ...warningBoxShadow,
  },
  danger: {
    backgroundColor: dangerColor[3],
    color: whiteColor,
    ...dangerBoxShadow,
  },
  primary: {
    backgroundColor: primaryColor[3],
    color: whiteColor,
    ...primaryBoxShadow,
  },
  rose: {
    backgroundColor: roseColor[3],
    color: whiteColor,
    ...roseBoxShadow,
  },
  message: {
    padding: '0',
    display: 'block',
    maxWidth: '89%',
  },
  close: {
    width: '11px',
    height: '11px',
  },
  iconButton: {
    width: '24px',
    height: '24px',
    padding: '0px',
  },
  icon: {
    display: 'block',
    left: '15px',
    position: 'absolute',
    top: '50%',
    marginTop: '-15px',
    width: '30px',
    height: '30px',
  },
  infoIcon: {
    color: infoColor[3],
  },
  successIcon: {
    color: successColor[3],
  },
  warningIcon: {
    color: warningColor[3],
  },
  dangerIcon: {
    color: dangerColor[3],
  },
  primaryIcon: {
    color: primaryColor[3],
  },
  roseIcon: {
    color: roseColor[3],
  },
  iconMessage: {
    paddingLeft: '50px',
    display: 'block',
  },
  actionRTL: {
    marginLeft: '-8px',
    marginRight: 'auto',
  },
};

export default snackbarContentStyle;
