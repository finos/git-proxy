import React, { useState } from 'react';
import GridItem from '../../components/Grid/GridItem';
import GridContainer from '../../components/Grid/GridContainer';
import PushesTable from './components/PushesTable';
import CustomTabs from '../../components/CustomTabs/CustomTabs';
import Danger from '../../components/Typography/Danger';
import { Visibility, CheckCircle, Cancel, Block } from '@material-ui/icons';

export default function Dashboard() {
  const [errorMessage, setErrorMessage] = useState('');

  const handlePushTableError = (errorMessage) => {
    setErrorMessage(errorMessage);
  };

  return (
    <div>
      {errorMessage && <Danger>{errorMessage}</Danger>}
      {!errorMessage && (
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
                    handlePushTableError={handlePushTableError}
                  />
                ),
              },
              {
                tabName: 'Approved',
                tabIcon: CheckCircle,
                tabContent: (
                  <PushesTable
                    authorised={true}
                    handlePushTableError={handlePushTableError}
                  />
                ),
              },
              {
                tabName: 'Canceled',
                tabIcon: Cancel,
                tabContent: (
                  <PushesTable
                    authorised={false}
                    rejected={false}
                    canceled={true}
                    handlePushTableError={handlePushTableError}
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
                    handlePushTableError={handlePushTableError}
                  />
                ),
              },
            ]}
          />
        </GridItem>
      </GridContainer>
      )}
    </div>
  );
}
