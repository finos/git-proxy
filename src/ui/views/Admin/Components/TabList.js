/* eslint-disable max-len */
/* eslint-disable require-jsdoc */
import React from 'react';
import GridItem from '../../../components/Grid/GridItem.js';
import GridContainer from '../../../components/Grid/GridContainer.js';
import CustomTabs from '../../../components/CustomTabs/CustomTabs';
import UserList from './UserList';
import Repositories from './Repositories';

export default function Dashboard() {
  return (
    <div>
      <GridContainer>
        <GridItem xs={12} sm={12} md={12}>
          <CustomTabs
            title=""
            headerColor="primary"
            tabs={[
              {
                tabName: 'Users',
                tabContent: (<UserList />),
              },
              {
                tabName: 'Repositories',
                tabContent: (<Repositories />),
              },
            ]
            } />
        </GridItem>
      </GridContainer>
    </div>
  );
}
