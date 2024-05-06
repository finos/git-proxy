import React from 'react';
import GridItem from '../../components/Grid/GridItem';
import GridContainer from '../../components/Grid/GridContainer';
import TabList from './Components/TabList';

export default function RepoList(props) {
  return (
    <GridContainer>
      <GridItem xs={12} sm={12} md={12}>
        <TabList />
      </GridItem>
    </GridContainer>
  );
}
