/* eslint-disable max-len */
/* eslint-disable require-jsdoc */
import React from 'react';
import Icon from '@material-ui/core/Icon';
import GridItem from '../../components/Grid/GridItem.js';
import GridContainer from '../../components/Grid/GridContainer.js';
import Card from '../../components/Card/Card.js';
import CardIcon from '../../components/Card/CardIcon.js';
import CardBody from '../../components/Card/CardBody.js';
import CardHeader from '../../components/Card/CardHeader.js';
import TabList from './Components/TabList';

export default function RepoList(props) {
  return (
    <GridContainer>
      <GridItem xs={12} sm={12} md={12}>
        <Card>
          <CardHeader color="success" stats icon>
            <CardIcon color="success">
              <Icon>content_copy</Icon>
              <h3>Remote Repositories</h3>
            </CardIcon>
          </CardHeader>
          <CardBody>
            <TabList />
          </CardBody>
        </Card>
      </GridItem>
    </GridContainer>
  );
}
