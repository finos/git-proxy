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
  primaryColor,
  dangerColor,
  grayColor,
} from '../../material-dashboard-react.js';
import tooltipStyle from '..t/tooltipStyle.js';
import checkboxAdnRadioStyle from '../checkboxAdnRadioStyle.js';
const tasksStyle = {
  ...tooltipStyle,
  ...checkboxAdnRadioStyle,
  table: {
    marginBottom: '0',
    overflow: 'visible',
  },
  tableRow: {
    position: 'relative',
    borderBottom: '1px solid ' + grayColor[5],
  },
  tableActions: {
    display: 'flex',
    border: 'none',
    padding: '12px 8px !important',
    verticalAlign: 'middle',
  },
  tableCell: {
    ...defaultFont,
    padding: '8px',
    verticalAlign: 'middle',
    border: 'none',
    lineHeight: '1.42857143',
    fontSize: '14px',
  },
  tableCellRTL: {
    textAlign: 'right',
  },
  tableActionButton: {
    width: '27px',
    height: '27px',
    padding: '0',
  },
  tableActionButtonIcon: {
    width: '17px',
    height: '17px',
  },
  edit: {
    backgroundColor: 'transparent',
    color: primaryColor[0],
    boxShadow: 'none',
  },
  close: {
    backgroundColor: 'transparent',
    color: dangerColor[0],
    boxShadow: 'none',
  },
};
export default tasksStyle;
