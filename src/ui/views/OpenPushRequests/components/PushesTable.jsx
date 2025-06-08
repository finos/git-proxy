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
  const navigate = useNavigate();
  const [, setAuth] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;
  const [searchTerm, setSearchTerm] = useState('');

  const openPush = (pushId) => navigate(`/dashboard/push/${pushId}`, { replace: true });

  useEffect(() => {
    const query = {};
    for (const k in props) {
      if (k) query[k] = props[k];
    }
    getPushes(setIsLoading, setData, setAuth, setIsError, query);
  }, [props]);

  useEffect(() => {
    setFilteredData(data);
  }, [data]);

  // Include “tag” in the searchable fields when tag exists
  useEffect(() => {
    const lowerCaseTerm = searchTerm.toLowerCase();
    const filtered = searchTerm
      ? data.filter((item) => {
          const repoName = item.repo.toLowerCase();
          const commitMsg = item.commitData?.[0]?.message?.toLowerCase() || '';
          const commitToSha = item.commitTo.toLowerCase();
          const tagName = item.tag?.replace('refs/tags/', '').toLowerCase() || '';
          return (
            repoName.includes(lowerCaseTerm) ||
            commitToSha.includes(lowerCaseTerm) ||
            commitMsg.includes(lowerCaseTerm) ||
            tagName.includes(lowerCaseTerm)
          );
        })
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
  if (isError) return <div>Something went wrong ...</div>;

  return (
    <div>
      <Search onSearch={handleSearch} />
      <TableContainer component={Paper}>
        <Table className={classes.table} aria-label='pushes table'>
          <TableHead>
            <TableRow>
              <TableCell align='left'>Timestamp</TableCell>
              <TableCell align='left'>Repository</TableCell>
              <TableCell align='left'>Branch/Tag</TableCell>
              <TableCell align='left'>Commit SHA/Tag</TableCell>
              <TableCell align='left'>Committer/Tagger</TableCell>
              <TableCell align='left'>Author</TableCell>
              <TableCell align='left'>Author E-mail</TableCell>
              <TableCell align='left'>Message</TableCell>
              <TableCell align='left'>No. of Commits</TableCell>
              <TableCell align='right'></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {currentItems.reverse().map((row) => {
              const isTagPush = Boolean(row.tag);
              const repoFullName = row.repo.replace('.git', '');
              const firstCommit = row.commitData?.[0] || null;
              const tagName = isTagPush ? row.tag.replace('refs/tags/', '') : '';
              const timestampUnix = isTagPush
                ? /* use row.user’s timestamp? fallback to commitTimestamp */ firstCommit?.commitTimestamp
                : firstCommit?.commitTimestamp;
              const displayTime = timestampUnix ? moment.unix(timestampUnix).toString() : '—';
              const refToShow = isTagPush ? tagName : row.branch.replace('refs/heads/', '');
              const shaOrTag = isTagPush ? tagName : row.commitTo.substring(0, 8);
              const committerOrTagger = isTagPush ? row.user : firstCommit?.committer;
              const authorOrNA = isTagPush ? '—' : firstCommit?.author || '—';
              const authorEmailOrNA = isTagPush ? '—' : firstCommit?.authorEmail || '—';
              const messageOrNote = isTagPush
                ? /* for lightweight tags, commitData[0].message is often the tagger’s commit message */
                  firstCommit?.message || ''
                : firstCommit?.message || '';
              const commitCount = row.commitData?.length || 0;

              return (
                <TableRow key={row.id}>
                  <TableCell align='left'>{displayTime}</TableCell>
                  <TableCell align='left'>
                    <a href={`https://github.com/${repoFullName}`} rel='noreferrer' target='_blank'>
                      {repoFullName}
                    </a>
                  </TableCell>

                  <TableCell align='left'>
                    {isTagPush ? (
                      <a
                        href={`https://github.com/${repoFullName}/releases/tag/${refToShow}`}
                        rel='noreferrer'
                        target='_blank'
                      >
                        {refToShow}
                      </a>
                    ) : (
                      <a
                        href={`https://github.com/${repoFullName}/tree/${refToShow}`}
                        rel='noreferrer'
                        target='_blank'
                      >
                        {refToShow}
                      </a>
                    )}
                  </TableCell>
                  <TableCell align='left'>
                    {isTagPush ? (
                      <a
                        href={`https://github.com/${repoFullName}/releases/tag/${shaOrTag}`}
                        rel='noreferrer'
                        target='_blank'
                      >
                        {shaOrTag}
                      </a>
                    ) : (
                      <a
                        href={`https://github.com/${repoFullName}/commit/${row.commitTo}`}
                        rel='noreferrer'
                        target='_blank'
                      >
                        {shaOrTag}
                      </a>
                    )}
                  </TableCell>
                  <TableCell align='left'>
                    {committerOrTagger !== '—' ? (
                      <a
                        href={`https://github.com/${committerOrTagger}`}
                        rel='noreferrer'
                        target='_blank'
                      >
                        {committerOrTagger}
                      </a>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell align='left'>
                    {authorOrNA !== '—' ? (
                      <a href={`https://github.com/${authorOrNA}`} rel='noreferrer' target='_blank'>
                        {authorOrNA}
                      </a>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell align='left'>
                    {authorEmailOrNA !== '—' ? (
                      <a href={`mailto:${authorEmailOrNA}`}>{authorEmailOrNA}</a>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell align='left'>{messageOrNote}</TableCell>
                  <TableCell align='left'>{commitCount}</TableCell>
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
