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
import { getPushes } from '../../../services/git-push';
import { KeyboardArrowRight } from '@material-ui/icons';
import Search from '../../../components/Search/Search';
import Pagination from '../../../components/Pagination/Pagination';
import { PushActionView } from '../../../types';
import { trimPrefixRefsHeads, trimTrailingDotGit } from '../../../../db/helper';
import { generateAuthorLinks, generateEmailLink } from '../../../utils';

interface PushesTableProps {
  blocked?: boolean;
  canceled?: boolean;
  authorised?: boolean;
  rejected?: boolean;
  errored?: boolean;
  handleError: (error: string) => void;
}

const PushesTable: React.FC<PushesTableProps> = (props) => {
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
    if (props.errored !== undefined) query.error = props.errored;

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

  useEffect(() => {
    const lowerCaseTerm = searchTerm.toLowerCase();
    const filtered = searchTerm
      ? pushes.filter(
          (item) =>
            item.repo.toLowerCase().includes(lowerCaseTerm) ||
            item.commitTo?.toLowerCase().includes(lowerCaseTerm) ||
            item.commitData?.[0]?.message.toLowerCase().includes(lowerCaseTerm),
        )
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
    <div>
      <Search onSearch={handleSearch} />
      <TableContainer component={Paper}>
        <Table aria-label='simple table' data-testid='pushes-table'>
          <TableHead>
            <TableRow>
              <TableCell align='left'>Timestamp</TableCell>
              <TableCell align='left'>Repository</TableCell>
              <TableCell align='left'>Branch</TableCell>
              <TableCell align='left'>Commit SHA</TableCell>
              <TableCell align='left'>Committer</TableCell>
              <TableCell align='left'>Authors</TableCell>
              <TableCell align='left'>Commit Message</TableCell>
              <TableCell align='left'>No. of Commits</TableCell>
              <TableCell align='right'></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {currentItems.map((row) => {
              const repoFullName = trimTrailingDotGit(row.repo);
              const repoBranch = trimPrefixRefsHeads(row.branch ?? '');
              const repoUrl = row.url;
              const repoWebUrl = trimTrailingDotGit(repoUrl);
              // may be used to resolve users to profile links in future
              // const gitProvider = getGitProvider(repoUrl);
              // const hostname = new URL(repoUrl).hostname;
              const commitTimestamp = row.commitData?.[0]?.commitTimestamp;

              return (
                <TableRow key={row.id} data-testid={`push-row-${row.id}`}>
                  <TableCell align='left'>
                    {commitTimestamp ? moment.unix(Number(commitTimestamp)).toString() : 'N/A'}
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
                      {row.commitTo?.substring(0, 8)}
                    </a>
                  </TableCell>
                  <TableCell align='left'>
                    {/* render github/gitlab profile links in future 
                    {getUserProfileLink(row.commitData[0].committerEmail, gitProvider, hostname)} 
                    */}
                    {generateEmailLink(
                      row.commitData?.[0]?.committer ?? '',
                      row.commitData?.[0]?.committerEmail ?? '',
                    )}
                  </TableCell>
                  <TableCell align='left'>
                    {/* render github/gitlab profile links in future 
                    {getUserProfileLink(row.commitData[0].authorEmail, gitProvider, hostname)} 
                    */}
                    {generateAuthorLinks(row.commitData ?? [])}
                  </TableCell>
                  <TableCell align='left'>{row.commitData?.[0]?.message || 'N/A'}</TableCell>
                  <TableCell align='left'>{row.commitData?.length ?? 0}</TableCell>
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
