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
  warningCardHeader,
  successCardHeader,
  dangerCardHeader,
  infoCardHeader,
  primaryCardHeader,
  roseCardHeader,
  whiteColor,
} from '../../material-dashboard-react.js';

const cardHeaderStyle = {
  cardHeader: {
    padding: '0.75rem 1.25rem',
    marginBottom: '0',
    borderBottom: 'none',
    background: 'transparent',
    zIndex: '3 !important',
    '&$cardHeaderPlain,&$cardHeaderIcon,&$cardHeaderStats,&$warningCardHeader,&$successCardHeader,&$dangerCardHeader,&$infoCardHeader,&$primaryCardHeader,&$roseCardHeader':
      {
        margin: '0 15px',
        padding: '0',
        position: 'relative',
        color: whiteColor,
      },
    '&:first-child': {
      borderRadius: 'calc(.25rem - 1px) calc(.25rem - 1px) 0 0',
    },
    '&$warningCardHeader,&$successCardHeader,&$dangerCardHeader,&$infoCardHeader,&$primaryCardHeader,&$roseCardHeader':
      {
        '&:not($cardHeaderIcon)': {
          borderRadius: '3px',
          marginTop: '-20px',
          padding: '15px',
        },
      },
    '&$cardHeaderStats svg': {
      fontSize: '36px',
      lineHeight: '56px',
      textAlign: 'center',
      width: '36px',
      height: '36px',
      margin: '10px 10px 4px',
    },
    '&$cardHeaderStats i,&$cardHeaderStats .material-icons': {
      fontSize: '36px',
      lineHeight: '56px',
      width: '56px',
      height: '56px',
      textAlign: 'center',
      overflow: 'unset',
      marginBottom: '1px',
    },
    '&$cardHeaderStats$cardHeaderIcon': {
      textAlign: 'right',
    },
  },
  cardHeaderPlain: {
    marginLeft: '0px !important',
    marginRight: '0px !important',
  },
  cardHeaderStats: {
    '& $cardHeaderIcon': {
      textAlign: 'right',
    },
    '& h1,& h2,& h3,& h4,& h5,& h6': {
      margin: '0 !important',
    },
  },
  cardHeaderIcon: {
    '&$warningCardHeader,&$successCardHeader,&$dangerCardHeader,&$infoCardHeader,&$primaryCardHeader,&$roseCardHeader':
      {
        background: 'transparent',
        boxShadow: 'none',
      },
    '& i,& .material-icons': {
      width: '33px',
      height: '33px',
      textAlign: 'center',
      lineHeight: '33px',
    },
    '& svg': {
      width: '24px',
      height: '24px',
      textAlign: 'center',
      lineHeight: '33px',
      margin: '5px 4px 0px',
    },
  },
  warningCardHeader: {
    color: whiteColor,
    '&:not($cardHeaderIcon)': {
      ...warningCardHeader,
    },
  },
  successCardHeader: {
    color: whiteColor,
    '&:not($cardHeaderIcon)': {
      ...successCardHeader,
    },
  },
  dangerCardHeader: {
    color: whiteColor,
    '&:not($cardHeaderIcon)': {
      ...dangerCardHeader,
    },
  },
  infoCardHeader: {
    color: whiteColor,
    '&:not($cardHeaderIcon)': {
      ...infoCardHeader,
    },
  },
  primaryCardHeader: {
    color: whiteColor,
    '&:not($cardHeaderIcon)': {
      ...primaryCardHeader,
    },
  },
  roseCardHeader: {
    color: whiteColor,
    '&:not($cardHeaderIcon)': {
      ...roseCardHeader,
    },
  },
};

export default cardHeaderStyle;
