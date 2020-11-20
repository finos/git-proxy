/* eslint-disable max-len */
/* eslint-disable require-jsdoc */
import React from 'react';
import GridItem from '../../components/Grid/GridItem.js';
import GridContainer from '../../components/Grid/GridContainer.js';
import PushesTable from './components/PushesTable';
import CustomTabs from '../../components/CustomTabs/CustomTabs';

export default function Dashboard() {
  return (
    <div>
      <GridContainer>
        <GridItem xs={12} sm={12} md={12}>
          <CustomTabs
            title="Push Requests"
            headerColor="primary"
            tabs={[
              {
                tabName: 'Open',
                tabContent: (<PushesTable blocked={true} authorised={false} rejected={false} canceled={false} />),
              },
              {
                tabName: 'Approved',
                tabContent: (<PushesTable authorised={true} />),
              },
              {
                tabName: 'Canceled',

                tabContent: (<PushesTable authorised={false} rejected={false} canceled={true} />),
              },
              {
                tabName: 'Rejected',
                // tabIcon: Code,
                tabContent: (<PushesTable authorised={false} rejected={true} canceled={false} />),
              },
            ]
            } />
        </GridItem>
      </GridContainer>
    </div>
  );
}
