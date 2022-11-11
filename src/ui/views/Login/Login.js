/* eslint-disable max-len */
/* eslint-disable require-jsdoc */
import React, {useState} from 'react';
// @material-ui/core components
import {makeStyles} from '@material-ui/core/styles';
import FormControl from '@material-ui/core/FormControl';
import InputLabel from '@material-ui/core/InputLabel';
// core components
import GridItem from '../../components/Grid/GridItem.js';
import GridContainer from '../../components/Grid/GridContainer.js';
import Input from '@material-ui/core/Input';
import Button from '../../components/CustomButtons/Button.js';
import Card from '../../components/Card/Card.js';
import CardHeader from '../../components/Card/CardHeader.js';
import CardBody from '../../components/Card/CardBody.js';
import CardFooter from '../../components/Card/CardFooter.js';
import axios from 'axios';
import {Redirect} from 'react-router-dom';

const loginUrl = `${process.env.REACT_APP_API_URI}/api/auth/login`;

const styles = {
  cardCategoryWhite: {
    color: 'rgba(255,255,255,.62)',
    margin: '0',
    fontSize: '14px',
    marginTop: '0',
    marginBottom: '0',
  },
  cardTitleWhite: {
    color: '#FFFFFF',
    marginTop: '0px',
    minHeight: 'auto',
    fontWeight: '300',
    fontFamily: '\'Roboto\', \'Helvetica\', \'Arial\', sans-serif',
    marginBottom: '3px',
    textDecoration: 'none',
  },
};

const useStyles = makeStyles(styles);
export default function UserProfile() {
  const classes = useStyles();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [success, setSuccess] = useState(false);
  const [gitAccountError, setGitAccountError] = useState(false);

  function validateForm() {
    return username.length > 0 && username.length < 100 && password.length > 0 && password.length < 200;
  }
  function handleSubmit(event) {
    axios.post(loginUrl, {
      username: username,
      password: password,
    }, {
      withCredentials: true,
      headers: {'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json'},
    })
        .then(function(response) {
          window.sessionStorage.setItem('git.proxy.login', 'success');
          setMessage('Success!');
          setSuccess(true);
        })
        .catch(function(error) {
          if (error.response.status == 307) {
            window.sessionStorage.setItem('git.proxy.login', 'success');
            setGitAccountError(true);
          } else if (error.response.status == 403) {
            setMessage('User is not part of Admin/User group');
          } else {
            setMessage('Invalid username or password');
          }
        });

    event.preventDefault();
  }

  if (gitAccountError) {
    return (
      <Redirect to={{pathname: 'admin/profile'}} />
    );
  }
  if (success) {
    return (
      <Redirect to={{pathname: '/', state: {authed: true}}} />
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <GridContainer>
        <GridItem xs={12} sm={6} md={4}>
          <Card>
            <CardHeader color="primary">
              <h4 className={classes.cardTitleWhite}>Login</h4>
              <p>{message}</p>
            </CardHeader>
            <CardBody>
              <GridContainer>
                <GridItem xs={6} sm={6} md={6}>
                  <FormControl>
                    <InputLabel>
                      Username
                    </InputLabel>
                    <Input
                      id="username"
                      type="username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                    />
                  </FormControl>
                </GridItem>
              </GridContainer>
              <GridContainer>
                <GridItem xs={6} sm={6} md={6}>
                  <FormControl>
                    <InputLabel>
                      Password
                    </InputLabel>
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </FormControl>
                </GridItem>
              </GridContainer>
            </CardBody>
            <CardFooter>
              <Button block disabled={!validateForm()} type="submit">
                Login
              </Button>
            </CardFooter>
          </Card>
        </GridItem>
      </GridContainer>
    </form>
  );
}
