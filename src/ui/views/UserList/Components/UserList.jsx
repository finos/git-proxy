import React, { useState, useEffect } from 'react';
import makeStyles from '@mui/styles/makeStyles';
import GridItem from '../../../components/Grid/GridItem';
import GridContainer from '../../../components/Grid/GridContainer';
import { useNavigate } from 'react-router-dom';
import Button from '@mui/material/Button';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';
import styles from '../../../assets/jss/material-dashboard-react/views/dashboardStyle';
import { getUsers } from '../../../services/user';

import { CloseRounded, Check, KeyboardArrowRight } from '@mui/icons-material';

export default function UserList(props) {
  const useStyles = makeStyles(styles);
  const classes = useStyles();
  const [data, setData] = useState([]);
  const [, setAuth] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isError, setIsError] = useState(false);
  const navigate = useNavigate();

  const openUser = (username) => navigate(`/admin/user/${username}`, { replace: true });

  useEffect(() => {
    const query = {};

    for (const k in props) {
      if (!k) continue;
      query[k] = props[k];
    }
    getUsers(setIsLoading, setData, setAuth, setIsError, query);
  }, [props]);

  if (isLoading) return <div>Loading...</div>;
  if (isError) return <div>Something went wrong...</div>;

  return (
    <GridContainer>
      <GridItem xs={12} sm={12} md={12}>
        <TableContainer component={Paper}>
          <Table className={classes.table} aria-label='simple table'>
            <TableHead>
              <TableRow>
                <TableCell align='left'>Name</TableCell>
                <TableCell align='left'>Role</TableCell>
                <TableCell align='left'>E-mail</TableCell>
                <TableCell align='left'>GitHub Username</TableCell>
                <TableCell align='left'>Administrator</TableCell>
                <TableCell align='left'></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.map((row) => (
                <TableRow key={row.username}>
                  <TableCell align='left'>{row.displayName}</TableCell>
                  <TableCell align='left'>{row.title}</TableCell>
                  <TableCell align='left'>
                    <a href={`mailto:${row.email}`}>{row.email}</a>
                  </TableCell>
                  <TableCell align='left'>
                    <a
                      href={`https://github.com/${row.gitAccount}`}
                      rel='noreferrer'
                      target='_blank'
                    >
                      {row.gitAccount}
                    </a>
                  </TableCell>
                  <TableCell align='left'>
                    {row.admin ? (
                      <span style={{ color: 'green' }}>
                        <Check fontSize='small' />
                      </span>
                    ) : (
                      <CloseRounded color='error' />
                    )}
                  </TableCell>
                  <TableCell component='th' scope='row'>
                    <Button
                      variant='contained'
                      color='primary'
                      onClick={() => openUser(row.username)}
                    >
                      <KeyboardArrowRight />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </GridItem>
    </GridContainer>
  );
}
