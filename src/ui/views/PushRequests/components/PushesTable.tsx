/**
 * Copyright 2026 GitProxy Contributors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

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
import { ErrorBoundary } from '../../../components/ErrorBoundary/ErrorBoundary';
import { PushActionView } from '../../../types';
import {
  isTagPush,
  getDisplayTimestamp,
  getTagName,
  getRefToShow,
  getShaOrTag,
  getCommitterOrTagger,
  getAuthorEmail,
  getMessage,
  getCommitCount,
  getRepoFullName,
  isValidValue,
  getRefUrl,
  getShaUrl,
} from '../../../utils/pushUtils';
import { trimTrailingDotGit } from '../../../../db/helper';
import { getGitProvider, generateAuthorLinks, generateEmailLink } from '../../../utils';

interface PushesTableProps {
  [key: string]: any;
}

const useStyles = makeStyles(styles as any);

const PushesTable: React.FC<PushesTableProps> = (props) => {
  const classes = useStyles();
  const [pushes, setPushes] = useState<PushActionView[]>([]);
  const [filteredData, setFilteredData] = useState<PushActionView[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;
  const [searchTerm, setSearchTerm] = useState('');

  const openPush = (pushId: string) => navigate(`/dashboard/push/${pushId}`);

  useEffect(() => {
    const query: any = {};

    // Only include filters that are explicitly set (not undefined)
    if (props.blocked !== undefined) query.blocked = props.blocked;
    if (props.canceled !== undefined) query.canceled = props.canceled;
    if (props.authorised !== undefined) query.authorised = props.authorised;
    if (props.rejected !== undefined) query.rejected = props.rejected;
    if (props.error !== undefined) query.error = props.error;

    const load = async () => {
      setIsLoading(true);
      const result = await getPushes(query);
      if (result.success && result.data) {
        setPushes(result.data);
      } else if (result.status === 401) {
        setIsLoading(false);
        navigate('/login', { replace: true });
        return;
      } else if (props.handleError) {
        props.handleError(result.message || 'Failed to load pushes');
      }
      setIsLoading(false);
    };
    load();
  }, [props]);

  useEffect(() => {
    setFilteredData(pushes);
  }, [pushes]);

  // Include "tag" in the searchable fields when tag exists
  useEffect(() => {
    const lowerCaseTerm = searchTerm.toLowerCase();
    const filtered = searchTerm
      ? pushes.filter((item) => {
          const row = item as any;
          const repoName = getRepoFullName(row.repo).toLowerCase();
          const message = getMessage(row).toLowerCase();
          const commitToSha = (row.commitTo ?? '').toLowerCase();
          const tagName = getTagName(row.tag).toLowerCase();

          return (
            repoName.includes(lowerCaseTerm) ||
            commitToSha.includes(lowerCaseTerm) ||
            message.includes(lowerCaseTerm) ||
            tagName.includes(lowerCaseTerm)
          );
        })
      : pushes;
    setFilteredData(filtered);
    setCurrentPage(1);
  }, [searchTerm, pushes]);

  const handleSearch = (term: string) => setSearchTerm(term.trim());

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredData.slice(indexOfFirstItem, indexOfLastItem);

  if (isLoading) return <div>Loading...</div>;

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
                <TableCell align='left'>Authors</TableCell>
                <TableCell align='left'>Message</TableCell>
                <TableCell align='left'>No. of Commits</TableCell>
                <TableCell align='right'></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {[...currentItems].reverse().map((row) => {
                const r = row as any;
                const isTag = isTagPush(r);
                const repoFullName = getRepoFullName(r.repo);
                const displayTime = getDisplayTimestamp(isTag, r.commitData?.[0], r.tagData?.[0]);
                const refToShow = getRefToShow(r);
                const shaOrTag = getShaOrTag(r);
                const repoUrl = r.url;
                const repoWebUrl = trimTrailingDotGit(repoUrl);
                const gitProvider = getGitProvider(repoUrl);
                // const hostname = new URL(repoUrl).hostname; // may be used to resolve users to profile links in future
                const committerOrTagger = getCommitterOrTagger(r);
                const message = getMessage(r);
                const commitCount = getCommitCount(r);

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
                        href={getShaUrl(
                          repoWebUrl,
                          gitProvider,
                          isTag,
                          isTag ? shaOrTag : r.commitTo,
                        )}
                        rel='noreferrer'
                        target='_blank'
                      >
                        {shaOrTag}
                      </a>
                    </TableCell>
                    <TableCell align='left'>
                      {isValidValue(committerOrTagger)
                        ? generateEmailLink(committerOrTagger, getAuthorEmail(r))
                        : 'N/A'}
                    </TableCell>
                    <TableCell align='left'>{generateAuthorLinks(r.commitData ?? [])}</TableCell>
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
