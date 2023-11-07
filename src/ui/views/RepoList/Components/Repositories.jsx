import React, { useState, useEffect } from 'react';
import { makeStyles } from '@material-ui/core/styles';
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
import { getRepos } from '../../../services/repo';

export default function Repositories(props) {
  const useStyles = makeStyles(styles);
  const classes = useStyles();
  const [data, setData] = useState([]);
  const [auth, setAuth] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isError, setIsError] = useState(false);
  const navigate = useNavigate();

  const openRepo = (repo) => navigate(`/admin/repo/${repo}`, { replace: true });

  useEffect(() => {
    const query = {};

    for (const k in props) {
      if (!k) continue;
      query[k] = props[k];
    }
    getRepos(setIsLoading, setData, setAuth, setIsError, query);
  }, [props]);

  if (isLoading) return <div>Loading ...</div>;
  if (isError) return <div>Something went wrong ...</div>;
  if (!auth) return <Navigate to={{ pathname: '/login' }} />;

  return (
    <TableContainer component={Paper}>
      <Table className={classes.table} aria-label='simple table'>
        <TableHead>
          <TableRow>
            <TableCell>Actions</TableCell>
            <TableCell align='left'>Project</TableCell>
            <TableCell align='left'>Name</TableCell>
            <TableCell align='left'>Url</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {data.map((row) => (
            <TableRow key={row.id}>
              <TableCell component='th' scope='row'>
                <Button variant='contained' color='primary' onClick={() => openRepo(row.name)}>
                  Open
                </Button>
              </TableCell>
              <TableCell align='left'>{row.project}</TableCell>
              <TableCell align='left'>{row.name}</TableCell>
              <TableCell align='left'>{row.url}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
