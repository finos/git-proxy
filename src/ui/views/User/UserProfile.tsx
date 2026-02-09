import React, { useState, useEffect, useContext } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import GridItem from '../../components/Grid/GridItem';
import GridContainer from '../../components/Grid/GridContainer';
import Card from '../../components/Card/Card';
import CardBody from '../../components/Card/CardBody';
import Button from '../../components/CustomButtons/Button';
import FormLabel from '@material-ui/core/FormLabel';
import { getUser, updateUser } from '../../services/user';
import { UserContext, UserContextType } from '../../context';

import { PublicUser } from '../../../db/types';
import { makeStyles } from '@material-ui/core/styles';

import { LogoGithubIcon } from '@primer/octicons-react';
import CloseRounded from '@material-ui/icons/CloseRounded';
import { Check, Save } from '@material-ui/icons';
import { TextField, Theme } from '@material-ui/core';
import Danger from '../../components/Typography/Danger';

const useStyles = makeStyles((theme: Theme) => ({
  root: {
    '& .MuiTextField-root': {
      margin: theme.spacing(1),
      width: '100%',
    },
  },
}));

export default function UserProfile(): React.ReactElement {
  const classes = useStyles();
  const [user, setUser] = useState<PublicUser | null>(null);
  const [auth, setAuth] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [gitAccount, setGitAccount] = useState<string>('');
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const { user: loggedInUser } = useContext<UserContextType>(UserContext);
  const isOwnProfile = !id;

  useEffect(() => {
    getUser(
      setIsLoading,
      (user: PublicUser) => {
        setUser(user);
        setGitAccount(user.gitAccount || '');
      },
      setAuth,
      setErrorMessage,
      id,
    );
  }, [id]);

  if (isLoading) return <div>Loading...</div>;

  if (!auth && window.location.pathname === '/dashboard/profile') {
    return <Navigate to='/login' />;
  }

  if (errorMessage) return <Danger>{errorMessage}</Danger>;

  if (!user) return <div>No user data available</div>;

  const updateProfile = async (): Promise<void> => {
    const updatedData = {
      ...user,
      gitAccount: escapeHTML(gitAccount),
    };

    // Does not reject and will display any errors that occur
    await updateUser(updatedData, setErrorMessage, setIsLoading);
    setUser(updatedData);
    navigate(`/dashboard/profile`);
  };

  const UpdateButton = (): React.ReactElement => (
    <Button variant='outlined' color='success' onClick={updateProfile}>
      <Save />
      Update
    </Button>
  );

  const escapeHTML = (str: string): string => {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')
      .replace(/\\/g, '&#39;')
      .replace(/\//g, '&#x2F;');
  };

  return (
    <form className={classes.root} noValidate autoComplete='off'>
      <GridContainer>
        <GridItem xs={12} sm={12} md={12}>
          <Card>
            <CardBody
              style={{
                padding: '20px',
              }}
            >
              <GridContainer
                style={{
                  paddingTop: '10px',
                }}
              >
                {user.gitAccount && (
                  <GridItem xs={1} sm={1} md={1}>
                    <img
                      width={'75px'}
                      style={{ borderRadius: '5px' }}
                      src={`https://github.com/${user.gitAccount}.png`}
                      alt={`${user.displayName}'s GitHub avatar`}
                    />
                  </GridItem>
                )}
                <GridItem xs={2} sm={2} md={2}>
                  <FormLabel component='legend'>Name</FormLabel>
                  {user.displayName}
                </GridItem>
                <GridItem xs={2} sm={2} md={2}>
                  <FormLabel component='legend'>Role</FormLabel>
                  {user.title}
                </GridItem>
                <GridItem xs={2} sm={2} md={2}>
                  <FormLabel component='legend'>E-mail</FormLabel>
                  <a href={`mailto:${user.email}`}>{user.email}</a>
                </GridItem>
                {user.gitAccount && (
                  <GridItem xs={2} sm={2} md={2}>
                    <FormLabel component='legend'>GitHub Username</FormLabel>
                    <a
                      href={`https://github.com/${user.gitAccount}`}
                      rel='noreferrer'
                      target='_blank'
                    >
                      {user.gitAccount}
                    </a>
                  </GridItem>
                )}
                <GridItem xs={2} sm={2} md={2}>
                  <FormLabel component='legend'>Administrator</FormLabel>
                  {user?.admin ? (
                    <span style={{ color: 'green' }}>
                      <Check fontSize='small' />
                    </span>
                  ) : (
                    <CloseRounded color='error' />
                  )}
                </GridItem>
              </GridContainer>
              {isOwnProfile || loggedInUser.admin ? (
                <div style={{ marginTop: '50px' }}>
                  <hr style={{ opacity: 0.2 }} />
                  <div style={{ marginTop: '25px' }}>
                    <FormLabel component='legend'>
                      What is your <LogoGithubIcon /> username?
                    </FormLabel>
                    <div style={{ textAlign: 'right' }}>
                      <TextField
                        id='gitAccount'
                        aria-describedby='gitAccount-helper-text'
                        variant='outlined'
                        placeholder='Enter a new GitHub username...'
                        value={gitAccount}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          setGitAccount(e.target.value)
                        }
                      />
                      <UpdateButton />
                    </div>
                  </div>
                </div>
              ) : null}
            </CardBody>
          </Card>
        </GridItem>
      </GridContainer>
    </form>
  );
}
