import React, { useState, useEffect } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import Icon from '@material-ui/core/Icon';
import GridItem from '../../components/Grid/GridItem';
import GridContainer from '../../components/Grid/GridContainer';
import Card from '../../components/Card/Card';
import CardIcon from '../../components/Card/CardIcon';
import CardBody from '../../components/Card/CardBody';
import CardHeader from '../../components/Card/CardHeader';
// import Button from '../../components/CustomButtons/Button.js';
// import PropTypes from 'prop-types';
import TextField from '@material-ui/core/TextField';
import Checkbox from '@material-ui/core/Checkbox';
// import FormControlLabel from '@material-ui/core/FormControlLabel';
// import FormControl from '@material-ui/core/FormControl';
import FormLabel from '@material-ui/core/FormLabel';
import { getUser } from '../../services/user';
import { makeStyles } from '@material-ui/core/styles';

const useStyles = makeStyles((theme) => ({
  root: {
    '& .MuiTextField-root': {
      margin: theme.spacing(1),
      width: '100%',
    },
  },
}));

export default function Dashboard() {
  const classes = useStyles();
  const [data, setData] = useState([]);
  const [auth, setAuth] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const { id } = useParams();

  useEffect(() => {
    // eslint-disable-next-line react/prop-types
    if (id) {
      getUser(setIsLoading, setData, setAuth, setIsError, id);
    } else {
      console.log('getting user data');
      getUser(setIsLoading, setData, setAuth, setIsError);
    }
  }, [id]);

  if (isLoading) return <div>Loading ...</div>;
  if (isError) return <div>Something went wrong ...</div>;
  if (!auth) return <Navigate to={{ pathname: '/login' }} />;

  console.log(data);

  return (
    <form className={classes.root} noValidate autoComplete='off'>
      <GridContainer>
        <GridItem xs={12} sm={12} md={12}>
          <Card>
            <CardHeader color='success' stats icon>
              <CardIcon color='success'>
                <Icon>content_copy</Icon>
                <h3>User Details</h3>
              </CardIcon>
            </CardHeader>
            <br />
            <br />
            <CardBody>
              <GridContainer>
                <GridItem xs={4} sm={4} md={4}>
                  <TextField
                    id='username'
                    label='Username'
                    aria-describedby='username-helper-text'
                    InputProps={{
                      readOnly: true,
                    }}
                    variant='outlined'
                    value={data.username}
                  />
                </GridItem>
                <GridItem xs={4} sm={4} md={4}>
                  <TextField
                    id='gitAccount'
                    label='Git Account'
                    aria-describedby='gitAccount-helper-text'
                    variant='outlined'
                    value={data.gitAccount}
                  />
                </GridItem>
                <GridItem xs={4} sm={4} md={4}>
                  <FormLabel component='legend'>Admin</FormLabel>
                  <Checkbox id='admin' variant='outlined' value={data.admin} />
                </GridItem>
                <GridItem xs={4} sm={4} md={4}>
                  <TextField
                    id='email'
                    label='Email Address'
                    aria-describedby='email-helper-text'
                    variant='outlined'
                    value={data.email}
                  />
                </GridItem>
              </GridContainer>
            </CardBody>
          </Card>
        </GridItem>
      </GridContainer>
    </form>
  );
}
