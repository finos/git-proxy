import React from 'react';
import GridItem from '../../components/Grid/GridItem';
import GridContainer from '../../components/Grid/GridContainer';
import PushesTable from './components/PushesTable';
import CustomTabs from '../../components/CustomTabs/CustomTabs';
import { Visibility, CheckCircle, Cancel, Block } from '@material-ui/icons';
import { SvgIconProps } from '@material-ui/core';

interface TabConfig {
  tabName: string;
  tabIcon: React.ComponentType<SvgIconProps>;
  tabContent: React.ReactNode;
}

const Dashboard: React.FC = () => {
  const tabs: TabConfig[] = [
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
  ];

  return (
    <div>
      <GridContainer>
        <GridItem xs={12} sm={12} md={12}>
          <CustomTabs headerColor='primary' tabs={tabs} />
        </GridItem>
      </GridContainer>
    </div>
  );
};

export default Dashboard;
