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
import Box from '@material-ui/core/Box';
import { getRepo, deleteUser, deleteRepo } from '../../services/repo';
import { makeStyles } from '@material-ui/core/styles';
import AddUser from './Components/AddUser';
import { Code, Delete, RemoveCircle, Visibility } from '@material-ui/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { UserContext } from '../../../context';
import CodeActionButton from '../../components/CustomButtons/CodeActionButton';
import { trimTrailingDotGit } from '../../../db/helper';
import { fetchRemoteRepositoryData } from '../../utils';
import { SCMRepositoryMetadata } from '../../../types/models';

interface RepoData {
  _id: string;
  project: string;
  name: string;
  proxyURL: string;
  url: string;
  users: {
    canAuthorise: string[];
    canPush: string[];
  };
}

export interface UserContextType {
  user: {
    admin: boolean;
  };
}

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
  const [data, setData] = useState<RepoData | null>(null);
  const [, setAuth] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [remoteRepoData, setRemoteRepoData] = React.useState<SCMRepositoryMetadata | null>(null);
  const { user } = useContext<UserContextType>(UserContext);
  const { id: repoId } = useParams<{ id: string }>();

  useEffect(() => {
    if (repoId) {
      getRepo(setIsLoading, setData, setAuth, setIsError, repoId);
    }
  }, [repoId]);

  useEffect(() => {
    if (data) {
      fetchRemoteRepositoryData(data.project, data.name, data.url).then(setRemoteRepoData);
    }
  }, [data]);

  const removeUser = async (userToRemove: string, action: 'authorise' | 'push') => {
    if (!repoId) return;
    await deleteUser(userToRemove, repoId, action);
    getRepo(setIsLoading, setData, setAuth, setIsError, repoId);
  };

  const removeRepository = async (id: string) => {
    await deleteRepo(id);
    navigate('/dashboard/repo', { replace: true });
  };

  const refresh = () => {
    if (repoId) {
      getRepo(setIsLoading, setData, setAuth, setIsError, repoId);
    }
  };

  if (isLoading) return <div>Loading...</div>;
  if (isError) return <div>Something went wrong ...</div>;
  if (!data) return <div>No repository data found</div>;

  const { url: remoteUrl, proxyURL } = data || {};
  const parsedUrl = new URL(remoteUrl);
  const cloneURL = `${proxyURL}/${parsedUrl.host}${parsedUrl.port ? `:${parsedUrl.port}` : ''}${parsedUrl.pathname}`;

  return (
    <GridContainer>
      <GridItem xs={12} sm={12} md={12}>
        <Card>
          <CardBody>
            <Box mb={2} sx={{ display: 'flex', justifyContent: 'flex-end' }}>
              {user.admin && (
                <Box mx={1} sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <Button
                    variant='contained'
                    color='secondary'
                    onClick={() => removeRepository(data._id)}
                  >
                    <Delete />
                  </Button>
                </Box>
              )}

              <CodeActionButton cloneURL={cloneURL} />
            </Box>
            <form className={classes.root} noValidate autoComplete='off'>
              <GridContainer>
                {remoteRepoData?.avatarUrl && (
                  <GridItem xs={12} sm={2} md={2}>
                    <img
                      width='75px'
                      style={{ borderRadius: '5px' }}
                      src={remoteRepoData.avatarUrl}
                      alt={`${data.project} logo`}
                    />
                  </GridItem>
                )}

                <GridItem xs={12} sm={2} md={2}>
                  <FormLabel component='legend'>Organization</FormLabel>
                  <h4>
                    {remoteRepoData?.profileUrl && (
                      <a href={remoteRepoData.profileUrl} target='_blank' rel='noopener noreferrer'>
                        {data.project}
                      </a>
                    )}
                    {!remoteRepoData?.profileUrl && <span>{data.project}</span>}
                  </h4>
                </GridItem>
                <GridItem xs={12} sm={2} md={2}>
                  <FormLabel component='legend'>Name</FormLabel>
                  <h4>
                    <a
                      href={trimTrailingDotGit(data.url)}
                      target='_blank'
                      rel='noopener noreferrer'
                    >
                      {data.name}
                    </a>
                  </h4>
                </GridItem>
                <GridItem xs={12} sm={6} md={6}>
                  <FormLabel component='legend'>URL</FormLabel>
                  <h4>
                    <a href={data.url} target='_blank' rel='noopener noreferrer'>
                      {trimTrailingDotGit(data.url)}
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
                      {data.users.canAuthorise.map((row) => (
                        <TableRow key={row}>
                          <TableCell align='left'>
                            <a href={`/dashboard/user/${row}`}>{row}</a>
                          </TableCell>
                          {user.admin && (
                            <TableCell align='right' component='th' scope='row'>
                              <Button
                                variant='contained'
                                color='secondary'
                                onClick={() => removeUser(row, 'authorise')}
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
                      {data.users.canPush.map((row) => (
                        <TableRow key={row}>
                          <TableCell align='left'>
                            <a href={`/dashboard/user/${row}`}>{row}</a>
                          </TableCell>
                          {user.admin && (
                            <TableCell align='right' component='th' scope='row'>
                              <Button
                                variant='contained'
                                color='secondary'
                                onClick={() => removeUser(row, 'push')}
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
    </GridContainer>
  );
};

export default RepoDetails;
