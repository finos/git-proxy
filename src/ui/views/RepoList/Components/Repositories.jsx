import React, { useState, useEffect, useContext } from 'react';
import { makeStyles } from '@material-ui/core/styles';
import { useNavigate } from 'react-router-dom';
import Table from '@material-ui/core/Table';
import TableBody from '@material-ui/core/TableBody';
import TableContainer from '@material-ui/core/TableContainer';
import styles from '../../../assets/jss/material-dashboard-react/views/dashboardStyle';
import { getRepos } from '../../../services/repo';
import GridContainer from '../../../components/Grid/GridContainer';
import GridItem from '../../../components/Grid/GridItem';
import NewRepo from './NewRepo';
import RepoOverview from './RepoOverview';
import { UserContext } from '../../../../context';
import PropTypes from 'prop-types';
import Search from '../../../components/Search/Search';
import Pagination from '../../../components/Pagination/Pagination'; 


export default function Repositories(props) {
  const useStyles = makeStyles(styles);
  const classes = useStyles();
  const [data, setData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [, setAuth] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isError, setIsError] = useState(false);
  const [currentPage, setCurrentPage] = useState(1); // Pagination state
  const itemsPerPage = 5; // Set items per page
  const navigate = useNavigate();
  const { user } = useContext(UserContext);

  const openRepo = (repo) => navigate(`/admin/repo/${repo}`, { replace: true });

  useEffect(() => {
    const query = {};
    for (const k in props) {
      if (!k) continue;
      query[k] = props[k];
    }
    getRepos(setIsLoading, (data) => {
      setData(data);
      setFilteredData(data); // Set both data and filteredData
    }, setAuth, setIsError, query);
  }, [props]);

  const refresh = async (repo) => {
    const updatedData = [...data, repo];
    setData(updatedData);
    setFilteredData(updatedData);
  };

  const handleSearch = (query) => {
    setCurrentPage(1); // Reset to page 1 on new search
    if (!query) {
      setFilteredData(data);
    } else {
      const lowercasedQuery = query.toLowerCase();
      setFilteredData(
        data.filter(repo =>
          repo.name.toLowerCase().includes(lowercasedQuery) ||
          repo.project.toLowerCase().includes(lowercasedQuery)
        )
      );
    }
  };
  const handlePageChange = (page) => setCurrentPage(page); // Update current page


  // Calculate items for the current page
  const startIdx = (currentPage - 1) * itemsPerPage;
  const paginatedData = filteredData.slice(startIdx, startIdx + itemsPerPage);

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
      data={paginatedData} // Use filteredData here
      repoButton={addrepoButton}
      onSearch={handleSearch} // Pass handleSearch
      currentPage={currentPage} // Pass current page
      totalItems={filteredData.length} // Pass total items for pagination
      itemsPerPage={itemsPerPage} // Pass items per page
      onPageChange={handlePageChange} // Pass page change handler
    />
  );
}

GetGridContainerLayOut.propTypes = {
  classes: PropTypes.object,
  openRepo: PropTypes.func.isRequired,
  data: PropTypes.array,
  repoButton: PropTypes.object,
  onSearch: PropTypes.func.isRequired,
  currentPage: PropTypes.number.isRequired,
  totalItems: PropTypes.number.isRequired,
  itemsPerPage: PropTypes.number.isRequired,
  onPageChange: PropTypes.func.isRequired,
};

function GetGridContainerLayOut(props) {
  return (
    <GridContainer>
      {props.repoButton}
      <GridItem xs={12} sm={12} md={12}>
        {/* Add Search component */}
        <Search onSearch={props.onSearch} />

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
      <GridItem xs={12} sm={12} md={12}>
        <Pagination
          currentPage={props.currentPage}
          totalItems={props.totalItems}
          itemsPerPage={props.itemsPerPage}
          onPageChange={props.onPageChange}
        />
      </GridItem>
    </GridContainer>
  );
}

