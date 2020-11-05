/* eslint-disable max-len */
/* eslint-disable require-jsdoc */
import React, {useState, useEffect} from 'react';
import {Redirect} from 'react-router-dom';

import Icon from '@material-ui/core/Icon';
import GridItem from '../../components/Grid/GridItem.js';
import GridContainer from '../../components/Grid/GridContainer.js';
import Card from '../../components/Card/Card.js';
import CardIcon from '../../components/Card/CardIcon.js';
import CardBody from '../../components/Card/CardBody.js';
import CardHeader from '../../components/Card/CardHeader.js';
import Button from '../../components/CustomButtons/Button.js';
import {getUser} from '../../services/git-push.js';

export default function Dashboard(props) {
  const [data, setData] = useState([]);
  const [auth, setAuth] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    getUser(setIsLoading, setData, setAuth, setIsError);
  }, []);


  if (isLoading) return (<div>Loading ...</div>);
  if (isError) return (<div>Something went wrong ...</div>);
  if (!auth) return (<Redirect to={{pathname: '/login'}} />);

  return (
    <GridContainer>
      <GridItem xs={12} sm={12} md={12}>
        <Card>
          <CardHeader color="success" stats icon>
            <CardIcon color="success">
              <Icon>content_copy</Icon>
              <h3>User Details</h3>
            </CardIcon>
          </CardHeader>
          <CardBody>
            <GridContainer>
              <GridItem xs={2} sm={2} md={2}>
                <h3>Display Name</h3>
                <p><b>{data.user.id}</b></p>
              </GridItem>
              <GridItem xs={3} sm={3} md={3}>
                <h3>Id</h3>
                <p>{data.user.displayName}</p>
              </GridItem>
              <GridItem xs={6} sm={6} md={6}>
                <h3>Token</h3>
                <p>***********************&nbsp;&nbsp;&nbsp;&nbsp;
                  <Button>Show Token</Button>
                </p>
              </GridItem>

            </GridContainer>
          </CardBody>
        </Card>
      </GridItem>
    </GridContainer>
  );
}
