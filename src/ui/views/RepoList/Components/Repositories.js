/* eslint-disable max-len */
/* eslint-disable require-jsdoc */
import React, {useState, useEffect, useContext} from 'react';
import {makeStyles} from '@material-ui/core/styles';
import {useHistory} from 'react-router-dom';
import Button from '@material-ui/core/Button';
import Table from '@material-ui/core/Table';
import TableBody from '@material-ui/core/TableBody';
import TableCell from '@material-ui/core/TableCell';
import TableContainer from '@material-ui/core/TableContainer';
import TableHead from '@material-ui/core/TableHead';
import TableRow from '@material-ui/core/TableRow';
import Paper from '@material-ui/core/Paper';
import {Redirect} from 'react-router-dom';
import styles from '../../../assets/jss/material-dashboard-react/views/dashboardStyle.js';
import {getRepos} from '../../../services/repo';
import GridContainer from '../../../components/Grid/GridContainer.js';
import GridItem from '../../../components/Grid/GridItem.js';
import NewRepo from './NewRepo';
import {UserContext} from '../../../../context.js';
import PropTypes from 'prop-types';

export default function Repositories(props) {
  const useStyles = makeStyles(styles);
  const classes = useStyles();
  const [data, setData] = useState([]);
  const [auth, setAuth] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isError, setIsError] = useState(false);
  const history = useHistory();
  const openRepo = (repo) => history.push(`/admin/repo/${repo}`);
  const {user} = useContext(UserContext);

  useEffect(() => {
    const query = {};
    for (const k in props) {
      if (!k) continue;
      query[k] = props[k];
    }
    getRepos(setIsLoading, setData, setAuth, setIsError, query);
  }, [props]);

  const refresh=async (repo)=>{
    console.log('refresh:', repo);
    setData([...data, repo]);
  };

  if (isLoading) return (<div>Loading ...</div>);
  if (isError) return (<div>Something went wrong ...</div>);
  if (!auth) return (<Redirect to={{pathname: '/login'}} />);

  const addrepoButton = user.admin? <GridItem><NewRepo onSuccess={refresh} /></GridItem> : <GridItem/>;

  return <GetGridContainerLayOut key="x" classes={classes} openRepo={openRepo} data={data} repoButton={addrepoButton} />;
}

GetGridContainerLayOut.propTypes = {
  classes: PropTypes.object,
  openRepo: PropTypes.func.isRequired,
  data: PropTypes.array,
  repoButton: PropTypes.object,
};

function GetGridContainerLayOut(props) {
  return (
    <GridContainer>
      <GridItem>{props.repoButton}</GridItem>
      <GridItem lg={12}>
        <TableContainer component={Paper}>
          <Table className={props.classes.table} aria-label="simple table">
            <TableHead>
              <TableRow>
                <TableCell>Actions</TableCell>
                <TableCell align="left">Project</TableCell>
                <TableCell align="left">Name</TableCell>
                <TableCell align="left">Url</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {props.data.map((row) => (
                <TableRow key={row._id}>
                  <TableCell component="th" scope="row">
                    <Button variant="contained" color="primary" onClick={() => props.openRepo(row.name)}>
                      Open
                    </Button>
                  </TableCell>
                  <TableCell align="left">{row.project}</TableCell>
                  <TableCell align="left">{row.name}</TableCell>
                  <TableCell align="left">{row.url}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </GridItem>
    </GridContainer>
  );
}

