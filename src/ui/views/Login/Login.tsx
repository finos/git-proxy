import React, { useState, FormEvent, useEffect } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import FormControl from '@material-ui/core/FormControl';
import InputLabel from '@material-ui/core/InputLabel';
import GridItem from '../../components/Grid/GridItem';
import GridContainer from '../../components/Grid/GridContainer';
import Input from '@material-ui/core/Input';
import Button from '../../components/CustomButtons/Button';
import Card from '../../components/Card/Card';
import CardHeader from '../../components/Card/CardHeader';
import CardBody from '../../components/Card/CardBody';
import CardFooter from '../../components/Card/CardFooter';
import axios, { AxiosError } from 'axios';
import logo from '../../assets/img/git-proxy.png';
import { Badge, CircularProgress, FormLabel, Snackbar } from '@material-ui/core';
import { useAuth } from '../../auth/AuthProvider';
import { API_BASE } from '../../apiBase';
import { getAxiosConfig, processAuthError } from '../../services/auth';

interface LoginResponse {
  username: string;
  password: string;
}

const loginUrl = `${API_BASE}/api/auth/login`;

const Login: React.FC = () => {
  const navigate = useNavigate();
  const authContext = useAuth();

  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [message, setMessage] = useState<string>('');
  const [success, setSuccess] = useState<boolean>(false);
  const [gitAccountError, setGitAccountError] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [authMethods, setAuthMethods] = useState<string[]>([]);
  const [usernamePasswordMethod, setUsernamePasswordMethod] = useState<string>('');

  useEffect(() => {
    axios.get(`${API_BASE}/api/auth/config`).then((response) => {
      const authMethods = response.data.allLoginMethods;
      const usernamePasswordMethod = response.data.usernamePasswordMethod;
      const nonUsernamePasswordMethods = authMethods.filter((am) => am !== usernamePasswordMethod);

      setAuthMethods(nonUsernamePasswordMethods);
      setUsernamePasswordMethod(usernamePasswordMethod);
    });
  }, []);

  function validateForm(): boolean {
    return (
      username.length > 0 && username.length < 100 && password.length > 0 && password.length < 200
    );
  }

  function handleAuthMethodLogin(authMethod: string): void {
    window.location.href = `${API_BASE}/api/auth/${authMethod}`;
  }

  function handleSubmit(event: FormEvent): void {
    event.preventDefault();
    setIsLoading(true);

    axios
      .post<LoginResponse>(loginUrl, { username, password }, getAxiosConfig())
      .then(() => {
        window.sessionStorage.setItem('git.proxy.login', 'success');
        setMessage('Success!');
        setSuccess(true);
        authContext.refreshUser().then(() => navigate(0));
      })
      .catch((error: AxiosError) => {
        if (error.response?.status === 307) {
          window.sessionStorage.setItem('git.proxy.login', 'success');
          setGitAccountError(true);
        } else if (error.response?.status === 403) {
          setMessage(processAuthError(error, false));
        } else {
          setMessage('You entered an invalid username or password...');
        }
      })
      .finally(() => {
        setIsLoading(false);
      });
  }

  if (gitAccountError) {
    return <Navigate to='/dashboard/profile' />;
  }

  if (success) {
    return <Navigate to='/dashboard/repo' />;
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
              <div style={{ textAlign: 'center', margin: '12px 10px' }}>
                <img
                  src={logo}
                  alt='logo'
                  width={150}
                  style={{ verticalAlign: 'middle', filter: 'brightness(0) invert(1)' }}
                  data-test='git-proxy-logo'
                />
              </div>
            </CardHeader>
            {usernamePasswordMethod ? (
              <CardBody>
                <GridContainer>
                  <GridItem xs={12} sm={12} md={12}>
                    <FormLabel component='legend' style={{ fontSize: '1.2rem', marginTop: 10 }}>
                      {usernamePasswordMethod.charAt(0).toUpperCase() +
                        usernamePasswordMethod.slice(1)}{' '}
                      Authentication
                    </FormLabel>
                    <FormControl fullWidth>
                      <InputLabel htmlFor='username'>Username</InputLabel>
                      <Input
                        id='username'
                        type='text'
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        autoFocus
                        data-test='username'
                      />
                    </FormControl>
                  </GridItem>
                </GridContainer>
                <GridContainer>
                  <GridItem xs={12} sm={12} md={12}>
                    <FormControl fullWidth>
                      <InputLabel htmlFor='password'>Password</InputLabel>
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
            ) : (
              <CardBody>
                <FormLabel
                  component='legend'
                  style={{ fontSize: '1rem', marginTop: 10, marginBottom: 0 }}
                >
                  No username/password authentication method is configured. Please contact an
                  administrator to enable this feature.
                </FormLabel>
              </CardBody>
            )}
            {/* Show login buttons if available (one on top of the other) */}
            <CardFooter style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {!isLoading ? (
                <>
                  {usernamePasswordMethod && (
                    <Button
                      color='success'
                      block
                      disabled={!validateForm()}
                      type='submit'
                      data-test='login'
                    >
                      Login
                    </Button>
                  )}
                  {authMethods.map((am) => (
                    <Button
                      color='success'
                      block
                      onClick={() => handleAuthMethodLogin(am)}
                      data-test={`${am}-login`}
                      key={am}
                    >
                      Login with {am.toUpperCase()}
                    </Button>
                  ))}
                </>
              ) : (
                <div style={{ textAlign: 'center', width: '100%', opacity: 0.5, color: 'green' }}>
                  <CircularProgress color='inherit' />
                </div>
              )}
            </CardFooter>
          </Card>
          <div style={{ textAlign: 'center', opacity: 0.9, fontSize: 12, marginTop: 20 }}>
            <Badge
              overlap='rectangular'
              color='error'
              badgeContent='NEW'
              style={{ marginRight: 20 }}
            />
            <span style={{ paddingLeft: 20 }}>
              View our <a href='/dashboard/push'>open source activity feed</a> or{' '}
              <a href='/dashboard/repo'>scroll through projects</a> we contribute to
            </span>
          </div>
        </GridItem>
      </GridContainer>
    </form>
  );
};

export default Login;
