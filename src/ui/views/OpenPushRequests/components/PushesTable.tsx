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
import { PushData } from '../../../../types/models';

interface PushesTableProps {
  [key: string]: any;
}

const useStyles = makeStyles(styles as any);

const PushesTable: React.FC<PushesTableProps> = (props) => {
  const classes = useStyles();
  const [data, setData] = useState<PushData[]>([]);
  const [filteredData, setFilteredData] = useState<PushData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isError, setIsError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const navigate = useNavigate();
  const [, setAuth] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;
  const [searchTerm, setSearchTerm] = useState('');

  const openPush = (pushId: string) => navigate(`/dashboard/push/${pushId}`, { replace: true });

  useEffect(() => {
    const query = {
      blocked: props.blocked ?? false,
      canceled: props.canceled ?? false,
      authorised: props.authorised ?? false,
      rejected: props.rejected ?? false,
    };
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
            item.commitData[0]?.message.toLowerCase().includes(lowerCaseTerm),
        )
      : data;
    setFilteredData(filtered);
    setCurrentPage(1);
  }, [searchTerm, data]);

  const handleSearch = (term: string) => setSearchTerm(term.trim());

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredData.slice(indexOfFirstItem, indexOfLastItem);

  if (isLoading) return <div>Loading...</div>;
  if (isError) return <div>{errorMessage}</div>;

  return (
    <div>
      <Search onSearch={handleSearch} />
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
            {[...currentItems].reverse().map((row) => {
              const repoFullName = row.repo.replace('.git', '');
              const repoBranch = row.branch.replace('refs/heads/', '');
              const commitTimestamp =
                row.commitData[0]?.commitTs || row.commitData[0]?.commitTimestamp;

              return (
                <TableRow key={row.id}>
                  <TableCell align='left'>
                    {commitTimestamp ? moment.unix(commitTimestamp).toString() : 'N/A'}
                  </TableCell>
                  <TableCell align='left'>
                    <a href={`https://github.com/${row.repo}`} rel='noreferrer' target='_blank'>
                      {repoFullName}
                    </a>
                  </TableCell>
                  <TableCell align='left'>
                    <a
                      href={`https://github.com/${repoFullName}/tree/${repoBranch}`}
                      rel='noreferrer'
                      target='_blank'
                    >
                      {repoBranch}
                    </a>
                  </TableCell>
                  <TableCell align='left'>
                    <a
                      href={`https://github.com/${repoFullName}/commit/${row.commitTo}`}
                      rel='noreferrer'
                      target='_blank'
                    >
                      {row.commitTo.substring(0, 8)}
                    </a>
                  </TableCell>
                  <TableCell align='left'>
                    {row.commitData[0]?.committer ? (
                      <a
                        href={`https://github.com/${row.commitData[0].committer}`}
                        rel='noreferrer'
                        target='_blank'
                      >
                        {row.commitData[0].committer}
                      </a>
                    ) : (
                      'N/A'
                    )}
                  </TableCell>
                  <TableCell align='left'>
                    {row.commitData[0]?.author ? (
                      <a
                        href={`https://github.com/${row.commitData[0].author}`}
                        rel='noreferrer'
                        target='_blank'
                      >
                        {row.commitData[0].author}
                      </a>
                    ) : (
                      'N/A'
                    )}
                  </TableCell>
                  <TableCell align='left'>
                    {row.commitData[0]?.authorEmail ? (
                      <a href={`mailto:${row.commitData[0].authorEmail}`}>
                        {row.commitData[0].authorEmail}
                      </a>
                    ) : (
                      'No data...'
                    )}
                  </TableCell>
                  <TableCell align='left'>{row.commitData[0]?.message || 'N/A'}</TableCell>
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
      <Pagination
        itemsPerPage={itemsPerPage}
        totalItems={filteredData.length}
        currentPage={currentPage}
        onPageChange={handlePageChange}
      />
    </div>
  );
};

export default PushesTable;
