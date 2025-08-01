import React from 'react';
import GridItem from '../../../components/Grid/GridItem';
import GridContainer from '../../../components/Grid/GridContainer';
import Repositories from './Repositories';

export default function Dashboard(): React.ReactElement {
  return (
    <div data-testid="repo-list-view">
      <GridContainer>
        <GridItem xs={12} sm={12} md={12}>
          <Repositories />
        </GridItem>
      </GridContainer>
    </div>
  );
}