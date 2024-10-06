import React from 'react';
import GridItem from '../../components/Grid/GridItem';
import GridContainer from '../../components/Grid/GridContainer';
import PushesTable from './components/PushesTable';
import CustomTabs from '../../components/CustomTabs/CustomTabs';

import { Visibility, CheckCircle, Cancel, Block } from '@mui/icons-material';

export default function Dashboard() {
  return (
    <div>
      <GridContainer>
        <GridItem xs={12} sm={12} md={12}>
          <CustomTabs
            headerColor='primary'
            tabs={[
              {
                tabName: 'Pending',
                tabIcon: Visibility,
                tabContent: (
                  <PushesTable
                    blocked={true}
                    authorised={false}
                    rejected={false}
                    canceled={false}
                  />
                ),
              },
              {
                tabName: 'Approved',
                tabIcon: CheckCircle,
                tabContent: <PushesTable authorised={true} />,
              },
              {
                tabName: 'Canceled',
                tabIcon: Cancel,
                tabContent: <PushesTable authorised={false} rejected={false} canceled={true} />,
              },
              {
                tabName: 'Rejected',
                tabIcon: Block,
                tabContent: <PushesTable authorised={false} rejected={true} canceled={false} />,
              },
            ]}
          />
        </GridItem>
      </GridContainer>
    </div>
  );
}
