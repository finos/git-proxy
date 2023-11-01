import React, { useState, useEffect } from 'react';
import { makeStyles } from '@material-ui/core/styles';
import GridItem from '../../../components/Grid/GridItem';
import GridContainer from '../../../components/Grid/GridContainer';
import { useNavigate } from 'react-router-dom';
import Button from '@material-ui/core/Button';
import Table from '@material-ui/core/Table';
import TableBody from '@material-ui/core/TableBody';
import TableCell from '@material-ui/core/TableCell';
import TableContainer from '@material-ui/core/TableContainer';
import TableHead from '@material-ui/core/TableHead';
import TableRow from '@material-ui/core/TableRow';
import Paper from '@material-ui/core/Paper';
import { Navigate } from 'react-router-dom';
import styles from '../../../assets/jss/material-dashboard-react/views/dashboardStyle';
import { getUsers } from '../../../services/user';
import NewUser from './NewUser';

export default function UserList(props) {
  const useStyles = makeStyles(styles);
  const classes = useStyles();
  const [data, setData] = useState([]);
  const [auth, setAuth] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isError, setIsError] = useState(false);
  const history = useNavigate();

  const openUser = (username) => history.push(`/admin/user/${username}`);

  useEffect(() => {
    const query = {};

    for (const k in props) {
      if (!k) continue;
      query[k] = props[k];
    }
    getUsers(setIsLoading, setData, setAuth, setIsError, query);
  }, [props]);

  if (isLoading) return <div>Loading ...</div>;
  if (isError) return <div>Something went wrong ...</div>;
  if (!auth) return <Navigate to={{ pathname: '/login' }} />;

  return (
    <GridContainer>
      <GridItem xs={12} sm={12} md={12}>
        <NewUser />
      </GridItem>
      <GridItem xs={12} sm={12} md={12}>
        <TableContainer component={Paper}>
          <Table className={classes.table} aria-label='simple table'>
            <TableHead>
              <TableRow>
                <TableCell>Actions</TableCell>
                <TableCell align='left'>Username</TableCell>
                <TableCell align='left'>email</TableCell>
                <TableCell align='left'>Git Account</TableCell>
                <TableCell align='left'>Admin</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.map((row) => (
                <TableRow key={row.username}>
                  <TableCell component='th' scope='row'>
                    <Button
                      variant='contained'
                      color='primary'
                      onClick={() => openUser(row.username)}
                    >
                      Open
                    </Button>
                  </TableCell>
                  <TableCell align='left'>{row.username}</TableCell>
                  <TableCell align='left'>{row.email}</TableCell>
                  <TableCell align='left'>{row.gitAccount}</TableCell>
                  <TableCell align='left'>{row.admin.toString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </GridItem>
    </GridContainer>
  );
}
