import React, { useState, useEffect } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import GridItem from '../../components/Grid/GridItem';
import GridContainer from '../../components/Grid/GridContainer';
import Card from '../../components/Card/Card';
import CardBody from '../../components/Card/CardBody';
import Button from '../../components/CustomButtons/Button';
import FormLabel from '@mui/material/FormLabel';
import { getUser, updateUser, getUserLoggedIn } from '../../services/user';
import makeStyles from '@mui/styles/makeStyles';

import { LogoGithubIcon } from '@primer/octicons-react';
import { Check, Save, CloseRounded } from '@mui/icons-material';
import { TextField } from '@mui/material';

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
  const [isProfile, setIsProfile] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [gitAccount, setGitAccount] = useState('');
  const navigate = useNavigate();
  const { id } = useParams();

  useEffect(() => {
    if (id == null) {
      setIsProfile(true);
    }

    if (id) {
      getUser(setIsLoading, setData, setAuth, setIsError, id);
      getUserLoggedIn(setIsLoading, setIsAdmin, setIsError, setAuth);
    } else {
      console.log('getting user data');
      setIsProfile(true);
      getUser(setIsLoading, setData, setAuth, setIsError);
    }
  }, []);

  if (isLoading) return <div>Loading...</div>;
  if (isError) return <div>Something went wrong ...</div>;
  if (!auth && window.location.pathname === '/admin/profile') {
    return <Navigate to='/login' />;
  }

  const updateProfile = async () => {
    try {
      data.gitAccount = escapeHTML(gitAccount);
      await updateUser(data);
      navigate(`/admin/user/${data.username}`);
    } catch {
      setIsError(true);
    }
  };

  const UpdateButton = () => (
    <Button variant='outlined' color='success' onClick={updateProfile}>
      <Save></Save>Update
    </Button>
  );

  const escapeHTML = (str) => {
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
                {data.gitAccount && (
                  <GridItem xs={1} sm={1} md={1}>
                    <img
                      width={'75px'}
                      style={{ borderRadius: '5px' }}
                      src={`https://github.com/${data.gitAccount}.png`}
                    ></img>
                  </GridItem>
                )}
                <GridItem xs={2} sm={2} md={2}>
                  <FormLabel component='legend'>Name</FormLabel>
                  {data.displayName}
                </GridItem>
                <GridItem xs={2} sm={2} md={2}>
                  <FormLabel component='legend'>Role</FormLabel>
                  {data.title}
                </GridItem>
                <GridItem xs={2} sm={2} md={2}>
                  <FormLabel component='legend'>E-mail</FormLabel>
                  <a href={`mailto:${data.email}`}>{data.email}</a>
                </GridItem>
                {data.gitAccount && (
                  <GridItem xs={2} sm={2} md={2}>
                    <FormLabel component='legend'>GitHub Username</FormLabel>
                    <a
                      href={`https://github.com/${data.gitAccount}`}
                      rel='noreferrer'
                      target='_blank'
                    >
                      {data.gitAccount}
                    </a>
                  </GridItem>
                )}
                <GridItem xs={2} sm={2} md={2}>
                  <FormLabel component='legend'>Administrator</FormLabel>
                  {data.admin ? (
                    <span style={{ color: 'green' }}>
                      <Check fontSize='small' />
                    </span>
                  ) : (
                    <CloseRounded color='error'></CloseRounded>
                  )}
                </GridItem>
              </GridContainer>
              {isProfile || isAdmin ? (
                <div style={{ marginTop: '50px' }}>
                  <hr style={{ opacity: 0.2 }} />
                  <div style={{ marginTop: '25px' }}>
                    <FormLabel component='legend'>
                      What is your <LogoGithubIcon></LogoGithubIcon> username?
                    </FormLabel>
                    <div style={{ textAlign: 'right' }}>
                      <TextField
                        id='gitAccount'
                        aria-describedby='gitAccount-helper-text'
                        variant='outlined'
                        placeholder='Enter a new GitHub username...'
                        value={gitAccount}
                        onChange={(e) => setGitAccount(e.target.value)}
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
