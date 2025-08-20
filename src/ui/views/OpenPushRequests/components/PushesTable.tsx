import React, { useState, useEffect } from 'react';
import { makeStyles } from '@material-ui/core/styles';
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
import ErrorBoundary from '../../../components/ErrorBoundary/ErrorBoundary';
import { PushData } from '../../../../types/models';
import {
  isTagPush,
  getDisplayTimestamp,
  getTagName,
  getRefToShow,
  getShaOrTag,
  getCommitterOrTagger,
  getAuthor,
  getAuthorEmail,
  getMessage,
  getCommitCount,
  getRepoFullName,
  isValidValue,
  getRefUrl,
  getShaUrl,
} from '../../../utils/pushUtils';
import { trimTrailingDotGit } from '../../../../db/helper';
import { getGitProvider, getUserProfileLink } from '../../../utils';

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

  // Include "tag" in the searchable fields when tag exists
  useEffect(() => {
    const lowerCaseTerm = searchTerm.toLowerCase();
    const filtered = searchTerm
      ? data.filter((item) => {
          const repoName = getRepoFullName(item.repo).toLowerCase();
          const message = getMessage(item).toLowerCase();
          const commitToSha = item.commitTo.toLowerCase();
          const tagName = getTagName(item.tag).toLowerCase();

          return (
            repoName.includes(lowerCaseTerm) ||
            commitToSha.includes(lowerCaseTerm) ||
            message.includes(lowerCaseTerm) ||
            tagName.includes(lowerCaseTerm)
          );
        })
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
    <ErrorBoundary>
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
              {[...currentItems].reverse().map((row) => {
                const isTag = isTagPush(row);
                const repoFullName = getRepoFullName(row.repo);
                const displayTime = getDisplayTimestamp(isTag, row.commitData[0], row.tagData?.[0]);
                const refToShow = getRefToShow(row);
                const shaOrTag = getShaOrTag(row);
                const repoUrl = row.url;
                const repoWebUrl = trimTrailingDotGit(repoUrl);
                const gitProvider = getGitProvider(repoUrl);
                const hostname = new URL(repoUrl).hostname;
                const committerOrTagger = getCommitterOrTagger(row);
                const author = getAuthor(row);
                const authorEmail = getAuthorEmail(row);
                const message = getMessage(row);
                const commitCount = getCommitCount(row);

                return (
                  <TableRow key={row.id}>
                    <TableCell align='left'>{displayTime}</TableCell>
                    <TableCell align='left'>
                      <a href={`${repoUrl}`} rel='noreferrer' target='_blank'>
                        {repoFullName}
                      </a>
                    </TableCell>
                    <TableCell align='left'>
                      <a
                        href={getRefUrl(repoWebUrl, gitProvider, isTag, refToShow)}
                        rel='noreferrer'
                        target='_blank'
                      >
                        {refToShow}
                      </a>
                    </TableCell>
                    <TableCell align='left'>
                      <a
                        href={getShaUrl(repoWebUrl, gitProvider, isTag, isTag ? shaOrTag : row.commitTo)}
                        rel='noreferrer'
                        target='_blank'
                      >
                        {shaOrTag}
                      </a>
                    </TableCell>
                    <TableCell align='left'>
                      {isValidValue(committerOrTagger) ? (
                        <span dangerouslySetInnerHTML={{ __html: getUserProfileLink(committerOrTagger, gitProvider, hostname) }} />
                      ) : (
                        'N/A'
                      )}
                    </TableCell>
                    <TableCell align='left'>
                      {isValidValue(author) ? (
                        <span dangerouslySetInnerHTML={{ __html: getUserProfileLink(author, gitProvider, hostname) }} />
                      ) : (
                        'N/A'
                      )}
                    </TableCell>
                    <TableCell align='left'>
                      {isValidValue(authorEmail) ? (
                        <a href={`mailto:${authorEmail}`}>{authorEmail}</a>
                      ) : (
                        'N/A'
                      )}
                    </TableCell>
                    <TableCell align='left'>{message}</TableCell>
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
        <Pagination
          itemsPerPage={itemsPerPage}
          totalItems={filteredData.length}
          currentPage={currentPage}
          onPageChange={handlePageChange}
        />
      </div>
    </ErrorBoundary>
  );
};

export default PushesTable;
