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
import { grayColor } from '../../material-dashboard-react.js';

const cardFooterStyle = {
  cardFooter: {
    padding: '0',
    paddingTop: '10px',
    margin: '0 15px 10px',
    borderRadius: '0',
    justifyContent: 'space-between',
    alignItems: 'center',
    display: 'flex',
    backgroundColor: 'transparent',
    border: '0',
  },
  cardFooterProfile: {
    marginTop: '-15px',
  },
  cardFooterPlain: {
    paddingLeft: '5px',
    paddingRight: '5px',
    backgroundColor: 'transparent',
  },
  cardFooterStats: {
    borderTop: '1px solid ' + grayColor[10],
    marginTop: '20px',
    '& svg': {
      position: 'relative',
      top: '4px',
      marginRight: '3px',
      marginLeft: '3px',
      width: '16px',
      height: '16px',
    },
    '& .fab,& .fas,& .far,& .fal,& .material-icons': {
      fontSize: '16px',
      position: 'relative',
      top: '4px',
      marginRight: '3px',
      marginLeft: '3px',
    },
  },
  cardFooterChart: {
    borderTop: '1px solid ' + grayColor[10],
  },
};

export default cardFooterStyle;
