/* eslint-disable max-len */
/* eslint-disable require-jsdoc */
import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
// import Icon from '@material-ui/core/Icon';
import GridItem from '../../components/Grid/GridItem';
import GridContainer from '../../components/Grid/GridContainer';
import Card from '../../components/Card/Card';
import CardBody from '../../components/Card/CardBody';
import TextField from '@material-ui/core/TextField';
import Paper from '@material-ui/core/Paper';
import Button from '@material-ui/core/Button';
import Table from '@material-ui/core/Table';
import TableBody from '@material-ui/core/TableBody';
import TableCell from '@material-ui/core/TableCell';
import TableContainer from '@material-ui/core/TableContainer';
import TableHead from '@material-ui/core/TableHead';
import TableRow from '@material-ui/core/TableRow';
import { getRepo, deleteUser } from '../../services/repo';
import { makeStyles } from '@material-ui/core/styles';
import AddUser from './Components/AddUser';

const useStyles = makeStyles((theme) => ({
  root: {
    '& .MuiTextField-root': {
      margin: theme.spacing(1),
      width: '100%',
    },
  },
}));

export default function RepoDetails(props) {
  const classes = useStyles();
  const [data, setData] = useState([]);
  const [auth, setAuth] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  // eslint-disable-next-line react/prop-types
  const repoName = props.match.params.id;

  useEffect(() => {
    // eslint-disable-next-line react/prop-types
    const id = props.match.params.id;
    getRepo(setIsLoading, setData, setAuth, setIsError, id);
  }, [props]);

  const removeUser = async (user, action) => {
    await deleteUser(user, repoName, action);
    getRepo(setIsLoading, setData, setAuth, setIsError, repoName);
  };

  const refresh = () => getRepo(setIsLoading, setData, setAuth, setIsError, repoName);

  if (isLoading) return <div>Loading ...</div>;
  if (isError) return <div>Something went wrong ...</div>;
  if (!auth) return <Navigate to={{ pathname: '/login' }} />;

  return (
    <GridContainer>
      <GridItem xs={12} sm={12} md={12}>
        <Card>
          <CardBody>
            <form className={classes.root} noValidate autoComplete='off'>
              <GridContainer>
                <GridItem xs={4} sm={4} md={4}>
                  <TextField
                    id='project'
                    label='Project'
                    InputProps={{
                      readOnly: true,
                    }}
                    variant='outlined'
                    value={data.project}
                  />
                </GridItem>
                <GridItem xs={4} sm={4} md={4}>
                  <TextField id='repoName' label='Repo Name' variant='outlined' value={data.name} />
                </GridItem>
                <GridItem xs={4} sm={4} md={4}>
                  <TextField id='gitUrl' label='Url' variant='outlined' value={data.url} />
                </GridItem>
              </GridContainer>
            </form>
            <GridContainer>
              <GridItem xs={6} sm={6} md={6}>
                <h2>Can Authorise Push</h2>
                <AddUser repoName={repoName} type='authorise' refreshFn={refresh}></AddUser>
                <br />
                <br />
                <TableContainer component={Paper}>
                  <Table className={classes.table} aria-label='simple table'>
                    <TableHead>
                      <TableRow>
                        <TableCell>Actions</TableCell>
                        <TableCell align='left'>Username</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {data.users.canAuthorise.map((row) => (
                        <TableRow key={row}>
                          <TableCell component='th' scope='row'>
                            <Button
                              variant='contained'
                              color='secondary'
                              onClick={() => removeUser(row, 'authorise')}
                            >
                              Remove
                            </Button>
                          </TableCell>
                          <TableCell align='left'>{row}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </GridItem>
              <GridItem xs={6} sm={6} md={6}>
                <h2>Can Push</h2>
                <AddUser repoName={repoName} type='push' refreshFn={refresh}></AddUser>
                <br />
                <br />
                <TableContainer component={Paper}>
                  <Table className={classes.table} aria-label='simple table'>
                    <TableHead>
                      <TableRow>
                        <TableCell>Actions</TableCell>
                        <TableCell align='left'>Username</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {data.users.canPush.map((row) => (
                        <TableRow key={row}>
                          <TableCell component='th' scope='row'>
                            <Button
                              variant='contained'
                              color='secondary'
                              onClick={() => removeUser(row, 'push')}
                            >
                              Remove
                            </Button>
                          </TableCell>
                          <TableCell align='left'>{row}</TableCell>
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
}
