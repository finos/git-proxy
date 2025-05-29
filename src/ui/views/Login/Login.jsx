import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
// @material-ui/core components
import FormControl from '@material-ui/core/FormControl';
import InputLabel from '@material-ui/core/InputLabel';
// core components
import GridItem from '../../components/Grid/GridItem';
import GridContainer from '../../components/Grid/GridContainer';
import Input from '@material-ui/core/Input';
import Button from '../../components/CustomButtons/Button';
import Card from '../../components/Card/Card';
import CardHeader from '../../components/Card/CardHeader';
import CardBody from '../../components/Card/CardBody';
import CardFooter from '../../components/Card/CardFooter';
import axios from 'axios';
import logo from '../../assets/img/git-proxy.png';
import { Badge, CircularProgress, Snackbar } from '@material-ui/core';
import { getCookie } from '../../utils';
import { useAuth } from '../../auth/AuthProvider';

const loginUrl = `${import.meta.env.VITE_API_URI}/api/auth/login`;

export default function UserProfile() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [, setGitAccountError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const navigate = useNavigate();
  const { refreshUser } = useAuth();

  function validateForm() {
    return (
      username.length > 0 && username.length < 100 && password.length > 0 && password.length < 200
    );
  }

  function handleOIDCLogin() {
    window.location.href = `${import.meta.env.VITE_API_URI}/api/auth/oidc`;
  }

  function handleSubmit(event) {
    setIsLoading(true);
    axios
      .post(
        loginUrl,
        {
          username: username,
          password: password,
        },
        {
          withCredentials: true,
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-TOKEN': getCookie('csrf'),
          },
        },
      )
      .then(function () {
        window.sessionStorage.setItem('git.proxy.login', 'success');
        setMessage('Success!');
        setIsLoading(false);
        refreshUser().then(() => navigate('/dashboard/repo'));
      })
      .catch(function (error) {
        if (error.response.status === 307) {
          window.sessionStorage.setItem('git.proxy.login', 'success');
          setGitAccountError(true);
        } else if (error.response.status === 403) {
          setMessage('You do not have the correct access permissions...');
        } else {
          setMessage('You entered an invalid username or password...');
        }
        setIsLoading(false);
      });

    event.preventDefault();
  }

  return (
    <form onSubmit={handleSubmit}>
      <Snackbar
        open={!!message}
        message={message}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        autoHideDuration={5000}
        onClose={() => setMessage('')}
      />
      <GridContainer justifyContent='center' style={{ minHeight: '100vh' }} alignItems='center'>
        <GridItem xs={12} sm={10} md={6} lg={4} xl={3}>
          <Card>
            <CardHeader color='primary'>
              <div
                style={{
                  textAlign: 'center',
                  marginRight: '10px',
                  marginTop: '12px',
                  marginBottom: '12px',
                }}
              >
                <img
                  style={{ verticalAlign: 'middle', filter: 'brightness(0) invert(1)' }}
                  width={'150px'}
                  src={logo}
                  alt='logo'
                  data-test='git-proxy-logo'
                />
              </div>
            </CardHeader>
            <CardBody>
              <GridContainer>
                <GridItem xs={6} sm={6} md={6}>
                  <FormControl>
                    <InputLabel>Username</InputLabel>
                    <Input
                      id='username'
                      type='username'
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      autoFocus={true}
                      data-test='username'
                    />
                  </FormControl>
                </GridItem>
              </GridContainer>
              <GridContainer>
                <GridItem xs={6} sm={6} md={6}>
                  <FormControl>
                    <InputLabel>Password</InputLabel>
                    <Input
                      id='password'
                      type='password'
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      data-test='password'
                    />
                  </FormControl>
                </GridItem>
              </GridContainer>
            </CardBody>
            <CardFooter>
              {!isLoading ? (
                <>
                  <Button
                    color='success'
                    block
                    disabled={!validateForm()}
                    type='submit'
                    data-test='login'
                  >
                    Login
                  </Button>
                  <Button color='warning' block onClick={handleOIDCLogin} data-test='oidc-login'>
                    Login with OIDC
                  </Button>
                </>
              ) : (
                <div style={{ textAlign: 'center', width: '100%', opacity: 0.5, color: 'green' }}>
                  <CircularProgress color='inherit' />
                </div>
              )}
            </CardFooter>
          </Card>
          <div style={{ textAlign: 'center', opacity: 0.9, fontSize: '12px' }}>
            <Badge overlap='rectangular' color='error' badgeContent={'NEW'} />{' '}
            <span style={{ paddingLeft: '20px' }}>
              View our <a href='/dashboard/push'>open source activity feed</a> or{' '}
              <a href='/dashboard/repo'>scroll through projects</a> we contribute to
            </span>
          </div>
        </GridItem>
      </GridContainer>
    </form>
  );
}
