import React, { useState, useEffect } from 'react';
import { makeStyles } from "@material-ui/core/styles";
import Card from "ui/components/Card/Card.js";
import CardHeader from "ui/components/Card/CardHeader.js";
import CardBody from "ui/components/Card/CardBody.js";
import moment from "moment";
import { useHistory } from "react-router-dom";
import Button from '@material-ui/core/Button';
import Table from '@material-ui/core/Table';
import TableBody from '@material-ui/core/TableBody';
import TableCell from '@material-ui/core/TableCell';
import TableContainer from '@material-ui/core/TableContainer';
import TableHead from '@material-ui/core/TableHead';
import TableRow from '@material-ui/core/TableRow';
import Paper from '@material-ui/core/Paper';
import { Redirect } from "react-router-dom";
import styles from "ui/assets/jss/material-dashboard-react/views/dashboardStyle.js";
import { getPushes } from "../../../services/git-push";

export default function PushesTable(props) {
  const useStyles = makeStyles(styles);
  const classes = useStyles();
  const [data, setData] = useState([]);  
  const [auth, setAuth] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isError, setIsError] = useState(false);
  const history = useHistory();

  const query = {}

  for (const k in props) {
    query[k] = props[k];
  }

  const openPush = (push) => history.push(`/admin/push/${push}`);
 
  useEffect(() => { 
    getPushes(setIsLoading, setData, setAuth, setIsError, query);
  }, []);
 
  if (isLoading) return(<div>Loading ...</div>);
  if (isError) return(<div>Something went wrong ...</div>);
  if (!auth) return(<Redirect to={{pathname: '/login'}} />);
    
  return (
    <TableContainer component={Paper}>
      <Table className={classes.table} aria-label="simple table">
        <TableHead>
          <TableRow>
            <TableCell>Actions</TableCell>
            <TableCell align="right">Time</TableCell>
            <TableCell align="right">Repo</TableCell>
            <TableCell align="right">Branch</TableCell>
            <TableCell align="right">Commit</TableCell>
            <TableCell align="right">Git Author</TableCell>
            <TableCell align="right">Internal Id</TableCell>
            <TableCell align="right">Message</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {data.map((row) => (
            <TableRow key={row.id}>
              <TableCell component="th" scope="row">
                <Button variant="contained" color="primary" onClick={() => openPush(row.id)}>
                  Open
                </Button>
              </TableCell>
              <TableCell align="right" >
                {moment(row.timestamp).format("yyyy-MM-DD HH:mm")}
              </TableCell>
              <TableCell align="right">{row.repo}</TableCell>
              <TableCell align="right">{row.branch.replace('refs/heads/', '')}</TableCell>
              <TableCell align="right">{row.commitFrom.substring(0,7)} - {row.commitTo.substring(0,7)}</TableCell>
              <TableCell align="right">{row.gitAuthor}</TableCell>
              <TableCell align="right">{row.internalAuthor}</TableCell>
              <TableCell align="right">{row.message}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
