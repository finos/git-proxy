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
import { primaryColor, blackColor, hexToRgb } from '../material-dashboard-react.js';

const checkboxAdnRadioStyle = {
  root: {
    padding: '13px',
    '&:hover': {
      backgroundColor: 'unset',
    },
  },
  labelRoot: {
    marginLeft: '-14px',
  },
  checked: {
    color: primaryColor[0] + '!important',
  },
  checkedIcon: {
    width: '20px',
    height: '20px',
    border: '1px solid rgba(' + hexToRgb(blackColor) + ', .54)',
    borderRadius: '3px',
  },
  uncheckedIcon: {
    width: '0px',
    height: '0px',
    padding: '10px',
    border: '1px solid rgba(' + hexToRgb(blackColor) + ', .54)',
    borderRadius: '3px',
  },
  radio: {
    color: primaryColor[0] + '!important',
  },
  radioChecked: {
    width: '20px',
    height: '20px',
    border: '1px solid ' + primaryColor[0],
    borderRadius: '50%',
  },
  radioUnchecked: {
    width: '0px',
    height: '0px',
    padding: '10px',
    border: '1px solid rgba(' + hexToRgb(blackColor) + ', .54)',
    borderRadius: '50%',
  },
};

export default checkboxAdnRadioStyle;
