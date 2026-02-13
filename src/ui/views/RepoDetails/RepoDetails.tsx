import React, { useState, useEffect, useContext } from 'react';
import GridItem from '../../components/Grid/GridItem';
import GridContainer from '../../components/Grid/GridContainer';
import Card from '../../components/Card/Card';
import CardBody from '../../components/Card/CardBody';
import FormLabel from '@material-ui/core/FormLabel';
import Paper from '@material-ui/core/Paper';
import Button from '@material-ui/core/Button';
import Table from '@material-ui/core/Table';
import TableBody from '@material-ui/core/TableBody';
import TableCell from '@material-ui/core/TableCell';
import TableContainer from '@material-ui/core/TableContainer';
import TableHead from '@material-ui/core/TableHead';
import TableRow from '@material-ui/core/TableRow';
import Grid from '@material-ui/core/Grid';
import { getRepo, deleteUser, deleteRepo } from '../../services/repo';
import { makeStyles } from '@material-ui/core/styles';
import AddUser from './Components/AddUser';
import { Code, Delete, RemoveCircle, Visibility } from '@material-ui/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { UserContext } from '../../context';
import CodeActionButton from '../../components/CustomButtons/CodeActionButton';
import { trimTrailingDotGit } from '../../../db/helper';
import { fetchRemoteRepositoryData } from '../../utils';

import { RepoView, SCMRepositoryMetadata } from '../../types';
import { UserContextType } from '../../context';
import UserLink from '../../components/UserLink/UserLink';
import DeleteRepoDialog from './Components/DeleteRepoDialog';
import Danger from '../../components/Typography/Danger';

const useStyles = makeStyles((theme) => ({
  root: {
    '& .MuiTextField-root': {
      margin: theme.spacing(1),
      width: '100%',
    },
  },
  table: {
    minWidth: 200,
  },
}));

const RepoDetails: React.FC = () => {
  const navigate = useNavigate();
  const classes = useStyles();
  const [repo, setRepo] = useState<RepoView | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState<boolean>(false);
  const [, setAuth] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isError, setIsError] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [remoteRepoData, setRemoteRepoData] = useState<SCMRepositoryMetadata | null>(null);
  const { user } = useContext<UserContextType>(UserContext);
  const { id: repoId } = useParams<{ id: string }>();

  useEffect(() => {
    if (repoId) {
      getRepo(setIsLoading, setRepo, setAuth, setIsError, setErrorMessage, repoId);
    }
  }, [repoId]);

  useEffect(() => {
    if (repo) {
      fetchRemoteRepositoryData(repo.project, repo.name, repo.url).then(setRemoteRepoData);
    }
  }, [repo]);

  const removeUser = async (userToRemove: string, action: 'authorise' | 'push') => {
    if (!repoId) return;
    await deleteUser(userToRemove, repoId, action);
    getRepo(setIsLoading, setRepo, setAuth, setIsError, setErrorMessage, repoId);
  };

  const removeRepository = async (id: string) => {
    await deleteRepo(id);
    navigate('/dashboard/repo', { replace: true });
  };

  const refresh = () => {
    if (repoId) {
      getRepo(setIsLoading, setRepo, setAuth, setIsError, setErrorMessage, repoId);
    }
  };

  if (isLoading) return <div>Loading...</div>;
  if (isError) return <Danger>{errorMessage || 'Something went wrong ...'}</Danger>;
  if (!repo) return <div>No repository data found</div>;

  const { url: remoteUrl, proxyURL } = repo || {};
  const parsedUrl = new URL(remoteUrl);
  const cloneURL = `${proxyURL}/${parsedUrl.host}${parsedUrl.port ? `:${parsedUrl.port}` : ''}${parsedUrl.pathname}`;

  return (
    <GridContainer>
      <GridItem xs={12} sm={12} md={12}>
        <Card>
          <CardBody>
            <Grid
              spacing={2}
              container
              direction='row'
              justifyContent='flex-end'
              alignItems='center'
            >
              {user.admin && (
                <Grid item>
                  <Button
                    variant='contained'
                    color='secondary'
                    data-testid='delete-repo-button'
                    onClick={() => setConfirmDeleteOpen(true)}
                  >
                    <Delete />
                  </Button>
                </Grid>
              )}
              <Grid item>
                <CodeActionButton cloneURL={cloneURL} />
              </Grid>
            </Grid>
            <form className={classes.root} noValidate autoComplete='off'>
              <GridContainer>
                {remoteRepoData?.avatarUrl && (
                  <GridItem xs={12} sm={2} md={2}>
                    <img
                      width='75px'
                      style={{ borderRadius: '5px' }}
                      src={remoteRepoData.avatarUrl}
                      alt={`${repo.project} logo`}
                    />
                  </GridItem>
                )}

                <GridItem xs={12} sm={2} md={2}>
                  <FormLabel component='legend'>Organization</FormLabel>
                  <h4>
                    {remoteRepoData?.profileUrl && (
                      <a href={remoteRepoData.profileUrl} target='_blank' rel='noopener noreferrer'>
                        {repo.project}
                      </a>
                    )}
                    {!remoteRepoData?.profileUrl && <span>{repo.project}</span>}
                  </h4>
                </GridItem>
                <GridItem xs={12} sm={2} md={2}>
                  <FormLabel component='legend'>Name</FormLabel>
                  <h4>
                    <a
                      href={trimTrailingDotGit(repo.url)}
                      target='_blank'
                      rel='noopener noreferrer'
                    >
                      {repo.name}
                    </a>
                  </h4>
                </GridItem>
                <GridItem xs={12} sm={6} md={6}>
                  <FormLabel component='legend'>URL</FormLabel>
                  <h4>
                    <a href={repo.url} target='_blank' rel='noopener noreferrer'>
                      {trimTrailingDotGit(repo.url)}
                    </a>
                  </h4>
                </GridItem>
              </GridContainer>
            </form>
            <hr style={{ opacity: 0.2 }} />

            <GridContainer>
              <GridItem xs={12} sm={12} md={12}>
                <h3>
                  <Visibility /> Reviewers
                </h3>
                {user.admin && (
                  <div style={{ textAlign: 'right' }}>
                    <AddUser repoId={repoId || ''} type='authorise' refreshFn={refresh} />
                  </div>
                )}
                <TableContainer component={Paper}>
                  <Table className={classes.table} aria-label='simple table'>
                    <TableHead>
                      <TableRow>
                        <TableCell align='left'>Username</TableCell>
                        {user.admin && <TableCell align='right'></TableCell>}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {repo.users?.canAuthorise?.map((username) => (
                        <TableRow key={username}>
                          <TableCell align='left'>
                            <UserLink username={username} />
                          </TableCell>
                          {user.admin && (
                            <TableCell align='right' component='th' scope='row'>
                              <Button
                                variant='contained'
                                color='secondary'
                                onClick={() => removeUser(username, 'authorise')}
                              >
                                <RemoveCircle />
                              </Button>
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </GridItem>
            </GridContainer>

            <GridContainer>
              <GridItem xs={12} sm={12} md={12}>
                <h3>
                  <Code /> Contributors
                </h3>
                {user.admin && (
                  <div style={{ textAlign: 'right' }}>
                    <AddUser repoId={repoId || ''} type='push' refreshFn={refresh} />
                  </div>
                )}
                <TableContainer component={Paper}>
                  <Table className={classes.table} aria-label='contributors table'>
                    <TableHead>
                      <TableRow>
                        <TableCell align='left'>Username</TableCell>
                        {user.admin && <TableCell align='right'></TableCell>}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {repo.users?.canPush?.map((username) => (
                        <TableRow key={username}>
                          <TableCell align='left'>
                            <UserLink username={username} />
                          </TableCell>
                          {user.admin && (
                            <TableCell align='right' component='th' scope='row'>
                              <Button
                                variant='contained'
                                color='secondary'
                                onClick={() => removeUser(username, 'push')}
                              >
                                <RemoveCircle />
                              </Button>
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </GridItem>
            </GridContainer>
          </CardBody>
        </Card>
      </GridItem>

      <DeleteRepoDialog
        repoName={repo.name}
        open={confirmDeleteOpen}
        onClose={() => setConfirmDeleteOpen(false)}
        onConfirm={() => removeRepository(repo._id!)}
      />
    </GridContainer>
  );
};

export default RepoDetails;
