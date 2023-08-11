/* eslint-disable max-len */
/* eslint-disable require-jsdoc */
import React, { useState, useEffect } from 'react';
import { makeStyles } from '@material-ui/core/styles';
import moment from 'moment';
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
import styles from '../../../assets/jss/material-dashboard-react/views/dashboardStyle.js';
import { getPushes } from '../../../services/git-push';

export default function PushesTable(props) {
  const useStyles = makeStyles(styles);
  const classes = useStyles();
  const [data, setData] = useState([]);
  const [auth, setAuth] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isError, setIsError] = useState(false);
  const history = useNavigate();

  const openPush = (push) => history.push(`/admin/push/${push}`);

  useEffect(() => {
    const query = {};

    for (const k in props) {
      if (!k) continue;
      query[k] = props[k];
    }
    getPushes(setIsLoading, setData, setAuth, setIsError, query);
  }, [props]);

  if (isLoading) return <div>Loading ...</div>;
  if (isError) return <div>Something went wrong ...</div>;
  if (!auth) return <Navigate to={{ pathname: '/login' }} />;

  return (
    <TableContainer component={Paper}>
      <Table className={classes.table} aria-label="simple table">
        <TableHead>
          <TableRow>
            <TableCell>Actions</TableCell>
            <TableCell align="left">Time</TableCell>
            <TableCell align="left">Repo</TableCell>
            <TableCell align="left">Branch</TableCell>
            <TableCell align="left">Commit</TableCell>
            <TableCell align="left">Last Author</TableCell>
            <TableCell align="left">Last Message</TableCell>
            <TableCell align="left">Commits</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {data.map((row) => (
            <TableRow key={row.id}>
              <TableCell component="th" scope="row">
                <Button
                  variant="contained"
                  color="primary"
                  onClick={() => openPush(row.id)}
                >
                  Open
                </Button>
              </TableCell>
              <TableCell align="left">
                {moment(row.timestamp).format('yyyy-MM-DD HH:mm')}
              </TableCell>
              <TableCell align="left">{row.repo}</TableCell>
              <TableCell align="left">
                {row.branch.replace('refs/heads/', '')}
              </TableCell>
              <TableCell align="left">
                {row.commitFrom.substring(0, 5)} -{' '}
                {row.commitTo.substring(0, 5)}
              </TableCell>
              <TableCell align="left">
                {row.commitData[row.commitData.length - 1].author}{' '}
              </TableCell>
              <TableCell align="left">
                {row.commitData[row.commitData.length - 1].message}{' '}
              </TableCell>
              <TableCell align="left">{row.commitData.length}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
