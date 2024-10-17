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

const useStyles = makeStyles((theme) => ({
  root: {
    '& .MuiTextField-root': {
      margin: theme.spacing(1),
      width: '100%',
    },
  },
}));

export default function RepoDetails() {
  const navigate = useNavigate();
  const classes = useStyles();
  const [data, setData] = useState([]);
  const [, setAuth] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const { user } = useContext(UserContext);
  const { id: repoName } = useParams();

  useEffect(() => {
    getRepo(setIsLoading, setData, setAuth, setIsError, repoName);
  }, []);

  const removeUser = async (userToRemove, action) => {
    await deleteUser(userToRemove, repoName, action);
    getRepo(setIsLoading, setData, setAuth, setIsError, repoName);
  };

  const removeRepository = async (name) => {
    await deleteRepo(name);
    navigate('/admin/repo', { replace: true });
  };

  const refresh = () => getRepo(setIsLoading, setData, setAuth, setIsError, repoName);

  if (isLoading) return <div>Loading...</div>;
  if (isError) return <div>Something went wrong ...</div>;

  const { project: org, name, proxyURL } = data || {};
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
                  <Delete></Delete>
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
                    width={'75px'}
                    style={{ borderRadius: '5px' }}
                    src={`https://github.com/${data.project}.png`}
                  ></img>
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
                  <Visibility></Visibility> Reviewers
                </h3>
                {user.admin && (
                  <div style={{ textAlign: 'right' }}>
                    <AddUser repoName={repoName} type='authorise' refreshFn={refresh}></AddUser>
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
                      {data.users.canAuthorise.map((row) => {
                        if (row)
                          return (
                            <TableRow key={row}>
                              <TableCell align='left'>
                                <a href={`/admin/user/${row}`}>{row}</a>
                              </TableCell>
                              {user.admin && (
                                <TableCell align='right' component='th' scope='row'>
                                  <Button
                                    variant='contained'
                                    color='secondary'
                                    onClick={() => removeUser(row, 'authorise')}
                                  >
                                    <RemoveCircle></RemoveCircle>
                                  </Button>
                                </TableCell>
                              )}
                            </TableRow>
                          );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              </GridItem>
            </GridContainer>
            <GridContainer>
              <GridItem xs={12} sm={12} md={12}>
                <h3>
                  <Code></Code> Contributors
                </h3>
                {user.admin && (
                  <div style={{ textAlign: 'right' }}>
                    <AddUser repoName={repoName} type='push' refreshFn={refresh} />
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
                      {data.users.canPush.map((row) => {
                        if (row) {
                          return (
                            <TableRow key={row}>
                              <TableCell align='left'>
                                <a href={`/admin/user/${row}`}>{row}</a>
                              </TableCell>
                              {user.admin && (
                                <TableCell align='right' component='th' scope='row'>
                                  <Button
                                    variant='contained'
                                    color='secondary'
                                    onClick={() => removeUser(row, 'push')}
                                  >
                                    <RemoveCircle></RemoveCircle>
                                  </Button>
                                </TableCell>
                              )}
                            </TableRow>
                          );
                        }
                      })}
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
}
