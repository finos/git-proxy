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
import styles from '../../../assets/jss/material-dashboard-react/views/dashboardStyle';
import { getPushes } from '../../../services/git-push';
import { KeyboardArrowRight } from '@material-ui/icons';
import Search from '../../../components/Search/Search';
import Pagination from '../../../components/Pagination/Pagination';

export default function PushesTable(props) {
  const useStyles = makeStyles(styles);
  const classes = useStyles();
  const [data, setData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isError, setIsError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const navigate = useNavigate();
  const [, setAuth] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;
  const [searchTerm, setSearchTerm] = useState('');
  const openPush = (push) => navigate(`/dashboard/push/${push}`, { replace: true });

  useEffect(() => {
    const query = {};
    for (const k in props) {
      if (k) query[k] = props[k];
    }
    getPushes(setIsLoading, setData, setAuth, setIsError, setErrorMessage, query);
  }, [props]);

  useEffect(() => {
    setFilteredData(data);
  }, [data]);

  useEffect(() => {
    const lowerCaseTerm = searchTerm.toLowerCase();
    const filtered = searchTerm
      ? data.filter(
          (item) =>
            item.repo.toLowerCase().includes(lowerCaseTerm) ||
            item.commitTo.toLowerCase().includes(lowerCaseTerm) ||
            item.commitData[0].message.toLowerCase().includes(lowerCaseTerm),
        )
      : data;
    setFilteredData(filtered);
    setCurrentPage(1);
  }, [searchTerm, data]);

  const handleSearch = (term) => setSearchTerm(term.trim());

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredData.slice(indexOfFirstItem, indexOfLastItem);

  const paginate = (pageNumber) => setCurrentPage(pageNumber);

  if (isLoading) return <div>Loading...</div>;
  if (isError) return <div>{errorMessage}</div>;

  const getGitProvider = (url) => {
    const hostname = new URL(url).hostname.toLowerCase();
    if (hostname === 'github.com') return 'github';
    if (hostname.includes('gitlab')) return 'gitlab';
    return 'unknown';
  };

  const getUserProfileUrl = (username, provider, hostname) => {
    if (provider == 'github') {
      return `https://github.com/${username}`;
    } else if (provider == 'gitlab') {
      return `https://${hostname}/${username}`;
    } else {
      return null;
    }
  };

  const getUserProfileData = (username, provider, hostname) => {
    let profileData = '';
    const profileUrl = getUserProfileUrl(username, provider, hostname);
    if (profileUrl) {
      profileData = `<a href="${profileUrl}" rel='noreferrer' target='_blank'>${username}</a>`;
    } else {
      profileData = `<span>${username}</span>`;
    }
    return profileData;
  };

  return (
    <div>
      <Search onSearch={handleSearch} /> {}
      <TableContainer component={Paper}>
        <Table className={classes.table} aria-label='simple table'>
          <TableHead>
            <TableRow>
              <TableCell align='left'>Timestamp</TableCell>
              <TableCell align='left'>Repository</TableCell>
              <TableCell align='left'>Branch</TableCell>
              <TableCell align='left'>Commit SHA</TableCell>
              <TableCell align='left'>Committer</TableCell>
              <TableCell align='left'>Author</TableCell>
              <TableCell align='left'>Author E-mail</TableCell>
              <TableCell align='left'>Commit Message</TableCell>
              <TableCell align='left'>No. of Commits</TableCell>
              <TableCell align='right'></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {currentItems.reverse().map((row) => {
              const repoFullName = row.repo.replace('.git', '');
              const repoBranch = row.branch.replace('refs/heads/', '');
              const repoUrl = row.url;
              const repoWebUrl = repoUrl.replace('.git', '');
              const gitProvider = getGitProvider(repoUrl);
              const hostname = new URL(repoUrl).hostname;

              return (
                <TableRow key={row.id}>
                  <TableCell align='left'>
                    {moment
                      .unix(row.commitData[0].commitTs || row.commitData[0].commitTimestamp)
                      .toString()}
                  </TableCell>
                  <TableCell align='left'>
                    <a href={`${repoUrl}`} rel='noreferrer' target='_blank'>
                      {repoFullName}
                    </a>
                  </TableCell>
                  <TableCell align='left'>
                    <a href={`${repoWebUrl}/tree/${repoBranch}`} rel='noreferrer' target='_blank'>
                      {repoBranch}
                    </a>
                  </TableCell>
                  <TableCell align='left'>
                    <a
                      href={`${repoWebUrl}/commit/${row.commitTo}`}
                      rel='noreferrer'
                      target='_blank'
                    >
                      {row.commitTo.substring(0, 8)}
                    </a>
                  </TableCell>
                  <TableCell align='left'>
                    {getUserProfileData(row.commitData[0].committer, gitProvider, hostname)}
                  </TableCell>
                  <TableCell align='left'>
                    {getUserProfileData(row.commitData[0].author, gitProvider, hostname)}
                  </TableCell>
                  <TableCell align='left'>
                    {row.commitData[0].authorEmail ? (
                      <a href={`mailto:${row.commitData[0].authorEmail}`}>
                        {row.commitData[0].authorEmail}
                      </a>
                    ) : (
                      'No data...'
                    )}
                  </TableCell>
                  <TableCell align='left'>{row.commitData[0].message}</TableCell>
                  <TableCell align='left'>{row.commitData.length}</TableCell>
                  <TableCell component='th' scope='row'>
                    <Button variant='contained' color='primary' onClick={() => openPush(row.id)}>
                      <KeyboardArrowRight />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
      {/* Pagination Component */}
      <Pagination
        itemsPerPage={itemsPerPage}
        totalItems={filteredData.length}
        paginate={paginate}
        currentPage={currentPage}
        onPageChange={handlePageChange}
      />
    </div>
  );
}
