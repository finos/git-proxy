import React from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '../../components/Card/Card';
import CardBody from '../../components/Card/CardBody';
import GridContainer from '../../components/Grid/GridContainer';
import GridItem from '../../components/Grid/GridItem';
import { Button } from '@material-ui/core';
import ErrorOutlineIcon from '@material-ui/icons/ErrorOutline';

const NotFound = () => {
  const navigate = useNavigate();

  return (
    <GridContainer justifyContent='center' style={{ marginTop: '50px' }}>
      <GridItem xs={12} sm={8} md={6}>
        <Card>
          <CardBody style={{ textAlign: 'center', padding: '40px' }}>
            <ErrorOutlineIcon style={{ fontSize: '60px', color: 'gray' }} />
            <h2>404 - Page Not Found</h2>
            <p>The page you are looking for does not exist. It may have been moved or deleted.</p>
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

export default NotFound;
