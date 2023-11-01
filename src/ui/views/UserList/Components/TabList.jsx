/* eslint-disable max-len */
/* eslint-disable require-jsdoc */
import React from 'react';
import GridItem from '../../../components/Grid/GridItem';
import GridContainer from '../../../components/Grid/GridContainer';
import CustomTabs from '../../../components/CustomTabs/CustomTabs';
import UserList from './UserList';

export default function Dashboard() {
  return (
    <div>
      <GridContainer>
        <GridItem xs={12} sm={12} md={12}>
          <CustomTabs
            title=''
            headerColor='primary'
            tabs={[
              {
                tabName: 'Users',
                tabContent: <UserList />,
              },
            ]}
          />
        </GridItem>
      </GridContainer>
    </div>
  );
}
