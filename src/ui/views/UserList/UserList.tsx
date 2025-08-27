import React from 'react';
import GridItem from '../../components/Grid/GridItem';
import GridContainer from '../../components/Grid/GridContainer';
import TabList from './Components/TabList';

const UserList: React.FC = () => {
  return (
    <GridContainer>
      <GridItem xs={12} sm={12} md={12}>
        <TabList />
      </GridItem>
    </GridContainer>
  );
};

export default UserList;
