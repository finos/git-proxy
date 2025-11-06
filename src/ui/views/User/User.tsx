import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import GridItem from '../../components/Grid/GridItem';
import GridContainer from '../../components/Grid/GridContainer';
import Card from '../../components/Card/Card';
import CardBody from '../../components/Card/CardBody';
import Button from '../../components/CustomButtons/Button';
import FormLabel from '@material-ui/core/FormLabel';
import { getUser, updateUser, getUserLoggedIn } from '../../services/user';

import { UserData } from '../../../types/models';
import { makeStyles } from '@material-ui/core/styles';

import { LogoGithubIcon, KeyIcon, TrashIcon } from '@primer/octicons-react';
import CloseRounded from '@material-ui/icons/CloseRounded';
import { Check, Save, Add } from '@material-ui/icons';
import {
  TextField,
  Theme,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@material-ui/core';
import { getSSHKeys, addSSHKey, deleteSSHKey, SSHKey } from '../../services/ssh';
import Snackbar from '../../components/Snackbar/Snackbar';

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
  const [data, setData] = useState<UserData | null>(null);
  const [auth, setAuth] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isError, setIsError] = useState<boolean>(false);
  const [isProfile, setIsProfile] = useState<boolean>(false);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [gitAccount, setGitAccount] = useState<string>('');
  const [sshKeys, setSshKeys] = useState<SSHKey[]>([]);
  const [snackbarOpen, setSnackbarOpen] = useState<boolean>(false);
  const [snackbarMessage, setSnackbarMessage] = useState<string>('');
  const [snackbarColor, setSnackbarColor] = useState<'success' | 'danger'>('success');
  const [openSSHModal, setOpenSSHModal] = useState<boolean>(false);
  const sshKeyNameRef = useRef<HTMLInputElement>(null);
  const sshKeyRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();

  useEffect(() => {
    if (id == null) {
      setIsProfile(true);
    }

    if (id) {
      getUser(
        setIsLoading,
        (userData: UserData) => {
          setData(userData);
          setGitAccount(userData.gitAccount || '');
        },
        setAuth,
        setIsError,
        id,
      );
      getUserLoggedIn(setIsLoading, setIsAdmin, setIsError, setAuth);
    } else {
      console.log('getting user data');
      setIsProfile(true);
      getUser(
        setIsLoading,
        (userData: UserData) => {
          setData(userData);
          setGitAccount(userData.gitAccount || '');
        },
        setAuth,
        setIsError,
      );
    }
  }, [id]);

  const loadSSHKeys = useCallback(async (): Promise<void> => {
    if (!data) return;
    try {
      const keys = await getSSHKeys(data.username);
      setSshKeys(keys);
    } catch (error) {
      console.error('Error loading SSH keys:', error);
    }
  }, [data]);

  // Load SSH keys when data is available
  useEffect(() => {
    if (data && (isProfile || isAdmin)) {
      loadSSHKeys();
    }
  }, [data, isProfile, isAdmin, loadSSHKeys]);

  const showSnackbar = (message: string, color: 'success' | 'danger') => {
    setSnackbarMessage(message);
    setSnackbarColor(color);
    setSnackbarOpen(true);
    // Auto-close after 3 seconds
    setTimeout(() => {
      setSnackbarOpen(false);
    }, 3000);
  };

  const handleAddSSHKey = async (): Promise<void> => {
    if (!data) return;

    const keyValue = sshKeyRef.current?.value.trim() || '';
    const nameValue = sshKeyNameRef.current?.value.trim() || 'Unnamed Key';

    if (!keyValue) {
      showSnackbar('Please enter an SSH key', 'danger');
      return;
    }

    try {
      await addSSHKey(data.username, keyValue, nameValue);
      showSnackbar('SSH key added successfully', 'success');
      setOpenSSHModal(false);
      if (sshKeyNameRef.current) sshKeyNameRef.current.value = '';
      if (sshKeyRef.current) sshKeyRef.current.value = '';
      await loadSSHKeys();
    } catch (error: any) {
      const errorMsg =
        error.response?.data?.error || 'Failed to add SSH key. Please check the key format.';
      showSnackbar(errorMsg, 'danger');
    }
  };

  const handleCloseSSHModal = useCallback(() => {
    setOpenSSHModal(false);
    if (sshKeyNameRef.current) sshKeyNameRef.current.value = '';
    if (sshKeyRef.current) sshKeyRef.current.value = '';
  }, []);

  const handleDeleteSSHKey = async (fingerprint: string): Promise<void> => {
    if (!data) return;
    try {
      await deleteSSHKey(data.username, fingerprint);
      showSnackbar('SSH key removed successfully', 'success');
      await loadSSHKeys();
    } catch (error) {
      showSnackbar('Failed to remove SSH key', 'danger');
    }
  };

  if (isLoading) return <div>Loading...</div>;
  if (isError) return <div>Something went wrong ...</div>;

  if (!auth && window.location.pathname === '/dashboard/profile') {
    return <Navigate to='/login' />;
  }
  if (!data) return <div>No user data available</div>;

  const updateProfile = async (): Promise<void> => {
    try {
      const updatedData = {
        ...data,
        gitAccount: escapeHTML(gitAccount),
      };
      await updateUser(updatedData);
      setData(updatedData);
      navigate(`/dashboard/profile`);
    } catch {
      setIsError(true);
    }
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
    <>
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
                        alt={`${data.displayName}'s GitHub avatar`}
                      />
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
                      <CloseRounded color='error' />
                    )}
                  </GridItem>
                </GridContainer>
                {isProfile || isAdmin ? (
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

                    {/* SSH Keys Section */}
                    <div style={{ marginTop: '50px' }}>
                      <hr style={{ opacity: 0.2 }} />
                      <div style={{ marginTop: '25px' }}>
                        <FormLabel component='legend'>
                          <KeyIcon size={16} /> SSH Keys
                        </FormLabel>
                        <div style={{ marginTop: '15px' }}>
                          {sshKeys.length === 0 ? (
                            <p style={{ color: '#999', fontSize: '14px' }}>
                              No SSH keys configured. Add one below to use SSH for git operations.
                            </p>
                          ) : (
                            <div>
                              {sshKeys.map((key) => (
                                <div
                                  key={key.fingerprint}
                                  style={{
                                    padding: '12px',
                                    border: '1px solid #ddd',
                                    borderRadius: '5px',
                                    marginBottom: '10px',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                  }}
                                >
                                  <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 'bold', fontSize: '14px' }}>
                                      {key.name}
                                    </div>
                                    <div
                                      style={{
                                        fontSize: '12px',
                                        color: '#666',
                                        fontFamily: 'monospace',
                                        marginTop: '4px',
                                      }}
                                    >
                                      {key.fingerprint}
                                    </div>
                                    <div
                                      style={{ fontSize: '11px', color: '#999', marginTop: '4px' }}
                                    >
                                      Added: {new Date(key.addedAt).toLocaleDateString()}
                                    </div>
                                  </div>
                                  <Tooltip title='Delete SSH key'>
                                    <IconButton
                                      size='small'
                                      onClick={() => handleDeleteSSHKey(key.fingerprint)}
                                      style={{ color: '#f44336' }}
                                    >
                                      <TrashIcon size={16} />
                                    </IconButton>
                                  </Tooltip>
                                </div>
                              ))}
                            </div>
                          )}

                          <div style={{ marginTop: '20px' }}>
                            <Button
                              variant='contained'
                              color='primary'
                              onClick={() => setOpenSSHModal(true)}
                              startIcon={<Add />}
                            >
                              Add SSH Key
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}
              </CardBody>
            </Card>
          </GridItem>
        </GridContainer>
        <Snackbar
          place='br'
          color={snackbarColor}
          message={snackbarMessage}
          open={snackbarOpen}
          closeNotification={() => setSnackbarOpen(false)}
          close
        />
      </form>

      {/* SSH Key Modal */}
      <Dialog open={openSSHModal} onClose={handleCloseSSHModal} maxWidth='md' fullWidth>
        <DialogTitle>
          <KeyIcon size={16} /> Add New SSH Key
        </DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            autoFocus
            inputRef={sshKeyNameRef}
            id='sshKeyName'
            label='Key name'
            variant='outlined'
            placeholder='e.g., My Laptop, Work Computer'
            defaultValue=''
            margin='normal'
          />
          <TextField
            fullWidth
            inputRef={sshKeyRef}
            id='newSSHKey'
            label='Public key'
            variant='outlined'
            placeholder='ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQC...'
            defaultValue=''
            multiline
            rows={6}
            helperText='Paste your SSH public key here (e.g., from ~/.ssh/id_rsa.pub)'
            margin='normal'
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseSSHModal}>Cancel</Button>
          <Button onClick={handleAddSSHKey} color='success'>
            Add Key
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
