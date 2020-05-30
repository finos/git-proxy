import React, { useEffect, useState } from 'react';
import Link from '@material-ui/core/Link';
import { makeStyles } from '@material-ui/core/styles';
import Table from '@material-ui/core/Table';
import TableBody from '@material-ui/core/TableBody';
import TableCell from '@material-ui/core/TableCell';
import TableHead from '@material-ui/core/TableHead';
import TableRow from '@material-ui/core/TableRow';
import Title from './Title';


function preventDefault(event) {
  event.preventDefault();
}

const useStyles = makeStyles((theme) => ({
  seeMore: {
    marginTop: theme.spacing(3),
  },
}));


export default function OpenPushes() {
  const classes = useStyles();

  const [hasError, setErrors] = useState(false);
  const [pushes, setPushes] = useState([]);

  async function fetchData() {
    const url = "http://localhost:8080/api/v1/pushes";
    await fetch(url)
      .then(res => res.json())
      .then(res => {
        console.log(res)
        setPushes(res)
      })
      .catch(err => setErrors(err));
  }
  
  useEffect(() => {
    fetchData();
  }, []);
    
  return (
    <React.Fragment>
      <Title>Git Pushes waiting authorization</Title>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Id</TableCell>
            <TableCell>Repo</TableCell>
            <TableCell>Branch</TableCell>
            <TableCell>Commit From</TableCell>
            <TableCell>Commit To</TableCell>
            <TableCell align="right">Contents</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {pushes.map((row) => (
            <TableRow key={row.id}>              
              <TableCell><a href={`/pushes/${row.id}`}>{row.id}</a></TableCell>
              <TableCell>{row.repoName}</TableCell>
              <TableCell>{row.branch.replace('refs/heads/', '')}</TableCell>              
              <TableCell>{row.commitFrom.substring(0, 8)}...</TableCell>
              <TableCell>{row.commitTo.substring(0, 8)}...</TableCell>              
              <TableCell align="right">{row.contentsCount}/</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <div className={classes.seeMore}>
        <Link color="primary" href="#" onClick={preventDefault}>
          More...
        </Link>
      </div>
    </React.Fragment>
  );
}
