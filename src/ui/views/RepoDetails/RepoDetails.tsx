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
import { getRepo, deleteUser, deleteRepo } from '../../services/repo';
import { makeStyles } from '@material-ui/core/styles';
import AddUser from './Components/AddUser';
import { Code, Delete, RemoveCircle, Visibility } from '@material-ui/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { UserContext } from '../../../context';
import CodeActionButton from '../../components/CustomButtons/CodeActionButton';
import { Box } from '@material-ui/core';

interface RepoData {
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
    minWidth: 650,
  },
}));

const RepoDetails: React.FC = () => {
  const navigate = useNavigate();
  const classes = useStyles();
  const [data, setData] = useState<RepoData | null>(null);
  const [, setAuth] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const { user } = useContext<UserContextType>(UserContext);
  const { id: repoName } = useParams<{ id: string }>();

  useEffect(() => {
    if (repoName) {
      getRepo(setIsLoading, setData, setAuth, setIsError, repoName);
    }
  }, [repoName]);

  const removeUser = async (userToRemove: string, action: 'authorise' | 'push') => {
    if (!repoName) return;
    await deleteUser(userToRemove, repoName, action);
    getRepo(setIsLoading, setData, setAuth, setIsError, repoName);
  };

  const removeRepository = async (name: string) => {
    await deleteRepo(name);
    navigate('/dashboard/repo', { replace: true });
  };

  const refresh = () => {
    if (repoName) {
      getRepo(setIsLoading, setData, setAuth, setIsError, repoName);
    }
  };

  if (isLoading) return <div>Loading...</div>;
  if (isError) return <div>Something went wrong ...</div>;
  if (!data) return <div>No repository data found</div>;

  const { project: org, name, proxyURL } = data;
  const cloneURL = `${proxyURL}/${org}/${name}.git`;

  return (
    <GridContainer>
      <GridItem xs={12} sm={12} md={12}>
        <Card>
          <CardBody>
            {user.admin && (
              <div style={{ textAlign: 'right' }}>
                <Button
                  variant='contained'
                  color='secondary'
                  onClick={() => removeRepository(data.name)}
                >
                  <Delete />
                </Button>
              </div>
            )}

            <Box mb={2} sx={{ display: 'flex', justifyContent: 'flex-end' }}>
              <CodeActionButton cloneURL={cloneURL} />
            </Box>
            <form className={classes.root} noValidate autoComplete='off'>
              <GridContainer>
                <GridItem xs={1} sm={1} md={1}>
                  <img
                    width='75px'
                    style={{ borderRadius: '5px' }}
                    src={`https://github.com/${data.project}.png`}
                    alt={`${data.project} logo`}
                  />
                </GridItem>
                <GridItem xs={2} sm={2} md={2}>
                  <FormLabel component='legend'>Organization</FormLabel>
                  <h4>
                    <a
                      href={`https://github.com/${data.project}`}
                      target='_blank'
                      rel='noopener noreferrer'
                    >
                      {data.project}
                    </a>
                  </h4>
                </GridItem>
                <GridItem xs={2} sm={2} md={2}>
                  <FormLabel component='legend'>Name</FormLabel>
                  <h4>
                    <a
                      href={`https://github.com/${data.project}/${data.name}`}
                      target='_blank'
                      rel='noopener noreferrer'
                    >
                      {data.name}
                    </a>
                  </h4>
                </GridItem>
                <GridItem xs={3} sm={3} md={3}>
                  <FormLabel component='legend'>URL</FormLabel>
                  <h4>
                    <a href={data.url} target='_blank' rel='noopener noreferrer'>
                      {data.url.replace('.git', '')}
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
                    <AddUser repoName={repoName || ''} type='authorise' refreshFn={refresh} />
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
                    <AddUser repoName={repoName || ''} type='push' refreshFn={refresh} />
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
