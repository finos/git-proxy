import React from 'react';
import GridItem from '../../../components/Grid/GridItem';
import GridContainer from '../../../components/Grid/GridContainer';
import UserList from './UserList';

export default function Dashboard() {
  return (
    <div>
      <GridContainer>
        <GridItem xs={12} sm={12} md={12}>
          <UserList />
        </GridItem>
      </GridContainer>
    </div>
  );
}
