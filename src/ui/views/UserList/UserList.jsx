import React from 'react';
import Icon from '@material-ui/core/Icon';
import GridItem from '../../components/Grid/GridItem.jsx';
import GridContainer from '../../components/Grid/GridContainer.jsx';
import Card from '../../components/Card/Card.jsx';
import CardIcon from '../../components/Card/CardIcon.jsx';
import CardBody from '../../components/Card/CardBody.jsx';
import CardHeader from '../../components/Card/CardHeader.jsx';
import TabList from './Components/TabList';

export default function UserList(props) {
  return (
    <GridContainer>
      <GridItem xs={12} sm={12} md={12}>
        <Card>
          <CardHeader color="success" stats icon>
            <CardIcon color="success">
              <Icon>content_copy</Icon>
              <h3>Admin</h3>
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
