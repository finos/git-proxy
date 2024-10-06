import React, { useState, useEffect, useContext } from 'react';
import makeStyles from '@mui/styles/makeStyles';
import { useNavigate } from 'react-router-dom';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableContainer from '@mui/material/TableContainer';
import styles from '../../../assets/jss/material-dashboard-react/views/dashboardStyle';
import { getRepos } from '../../../services/repo';
import GridContainer from '../../../components/Grid/GridContainer';
import GridItem from '../../../components/Grid/GridItem';
import NewRepo from './NewRepo';
import RepoOverview from './RepoOverview';
import { UserContext } from '../../../../context';
import PropTypes from 'prop-types';

export default function Repositories(props) {
  const useStyles = makeStyles(styles);
  const classes = useStyles();
  const [data, setData] = useState([]);
  const [, setAuth] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isError, setIsError] = useState(false);
  const navigate = useNavigate();
  const openRepo = (repo) => navigate(`/admin/repo/${repo}`, { replace: true });
  const { user } = useContext(UserContext);

  useEffect(() => {
    const query = {};
    for (const k in props) {
      if (!k) continue;
      query[k] = props[k];
    }
    getRepos(setIsLoading, setData, setAuth, setIsError, query);
  }, [props]);

  const refresh = async (repo) => {
    console.log('refresh:', repo);
    setData([...data, repo]);
  };

  if (isLoading) return <div>Loading...</div>;
  if (isError) return <div>Something went wrong ...</div>;

  const addrepoButton = user.admin ? (
    <GridItem>
      <NewRepo onSuccess={refresh} />
    </GridItem>
  ) : (
    <GridItem />
  );

  return (
    <GetGridContainerLayOut
      key='x'
      classes={classes}
      openRepo={openRepo}
      data={data}
      repoButton={addrepoButton}
    />
  );
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
      {props.repoButton}
      <GridItem xs={12} sm={12} md={12}>
        <TableContainer
          style={{ background: 'transparent', borderRadius: '5px', border: '1px solid #d0d7de' }}
        >
          <Table className={props.classes.table} aria-label='simple table'>
            <TableBody>
              {props.data.map((row) => {
                if (row.project && row.name) {
                  return <RepoOverview data={row} key={row._id} />;
                }
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </GridItem>
    </GridContainer>
  );
}
