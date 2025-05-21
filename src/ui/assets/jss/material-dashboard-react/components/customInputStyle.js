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
  primaryColor,
  dangerColor,
  successColor,
  grayColor,
  defaultFont,
} from '../../material-dashboard-react.js';

const customInputStyle = {
  disabled: {
    '&:before': {
      backgroundColor: 'transparent !important',
    },
  },
  underline: {
    '&:hover:not($disabled):before,&:before': {
      borderColor: grayColor[4] + ' !important',
      borderWidth: '1px !important',
    },
    '&:after': {
      borderColor: primaryColor[0],
    },
  },
  underlineError: {
    '&:after': {
      borderColor: dangerColor[0],
    },
  },
  underlineSuccess: {
    '&:after': {
      borderColor: successColor[0],
    },
  },
  labelRoot: {
    ...defaultFont,
    color: grayColor[3] + ' !important',
    fontWeight: '400',
    fontSize: '14px',
    lineHeight: '1.42857',
    letterSpacing: 'unset',
  },
  labelRootError: {
    color: dangerColor[0],
  },
  labelRootSuccess: {
    color: successColor[0],
  },
  feedback: {
    position: 'absolute',
    top: '18px',
    right: '0',
    zIndex: '2',
    display: 'block',
    width: '24px',
    height: '24px',
    textAlign: 'center',
    pointerEvents: 'none',
  },
  marginTop: {
    marginTop: '16px',
  },
  formControl: {
    paddingBottom: '10px',
    margin: '27px 0 0 0',
    position: 'relative',
    verticalAlign: 'unset',
  },
};

export default customInputStyle;
