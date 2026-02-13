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

import React, { useState } from 'react';
import GridItem from '../../components/Grid/GridItem';
import GridContainer from '../../components/Grid/GridContainer';
import PushesTable from './components/PushesTable';
import CustomTabs from '../../components/CustomTabs/CustomTabs';
import Danger from '../../components/Typography/Danger';
import { Visibility, CheckCircle, Cancel, Block, Error, List } from '@material-ui/icons';
import { TabItem } from '../../components/CustomTabs/CustomTabs';

const Dashboard: React.FC = () => {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handlePushTableError = (errorMessage: string) => {
    setErrorMessage(errorMessage);
  };

  const tabs: TabItem[] = [
    {
      tabName: 'All',
      tabIcon: List,
      tabContent: <PushesTable handleError={handlePushTableError} />,
    },
    {
      tabName: 'Pending',
      tabIcon: Visibility,
      tabContent: (
        <PushesTable blocked={true} authorised={false} rejected={false} canceled={false} />
      ),
    },
    {
      tabName: 'Approved',
      tabIcon: CheckCircle,
      tabContent: <PushesTable authorised={true} handleError={handlePushTableError} />,
    },
    {
      tabName: 'Canceled',
      tabIcon: Cancel,
      tabContent: (
        <PushesTable
          authorised={false}
          rejected={false}
          canceled={true}
          handleError={handlePushTableError}
        />
      ),
    },
    {
      tabName: 'Rejected',
      tabIcon: Block,
      tabContent: (
        <PushesTable
          authorised={false}
          rejected={true}
          canceled={false}
          handleError={handlePushTableError}
        />
      ),
    },
    {
      tabName: 'Error',
      tabIcon: Error,
      tabContent: <PushesTable error={true} handleError={handlePushTableError} />,
    },
  ];

  return (
    <div>
      {errorMessage && <Danger>{errorMessage}</Danger>}
      {!errorMessage && (
        <GridContainer>
          <GridItem xs={12} sm={12} md={12}>
            <CustomTabs headerColor='primary' tabs={tabs} defaultTab={1} />
          </GridItem>
        </GridContainer>
      )}
    </div>
  );
};

export default Dashboard;
