import React from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '../../components/Card/Card';
import CardBody from '../../components/Card/CardBody';
import GridContainer from '../../components/Grid/GridContainer';
import GridItem from '../../components/Grid/GridItem';
import { Button } from '@material-ui/core';
import LockIcon from '@material-ui/icons/Lock';

const NotAuthorized = () => {
  const navigate = useNavigate();

  return (
    <GridContainer justifyContent='center' style={{ marginTop: '50px' }}>
      <GridItem xs={12} sm={8} md={6}>
        <Card>
          <CardBody style={{ textAlign: 'center', padding: '40px' }}>
            <LockIcon style={{ fontSize: '60px', color: 'red' }} />
            <h2>403 - Not Authorized</h2>
            <p>
              You do not have permission to access this page. Contact your administrator for more
              information, or try logging in with a different account.
            </p>
            <Button
              variant='contained'
              color='primary'
              onClick={() => navigate('/')}
              style={{ marginTop: '20px' }}
            >
              Go to Home
            </Button>
          </CardBody>
        </Card>
      </GridItem>
    </GridContainer>
  );
};

export default NotAuthorized;
