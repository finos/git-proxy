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

import React, { useState, useEffect, useContext } from 'react';
import { makeStyles } from '@material-ui/core/styles';
import { useNavigate } from 'react-router-dom';
import Table from '@material-ui/core/Table';
import TableBody from '@material-ui/core/TableBody';
import TableContainer from '@material-ui/core/TableContainer';
import styles from '../../../assets/jss/material-dashboard-react/views/dashboardStyle';
import { getRepos } from '../../../services/repo';
import { PaginationParams } from '../../../services/git-push';
import GridContainer from '../../../components/Grid/GridContainer';
import GridItem from '../../../components/Grid/GridItem';
import NewRepo from './NewRepo';
import { RepoView } from '../../../types';
import RepoOverview from './RepoOverview';
import { UserContext, UserContextType } from '../../../context';
import Search from '../../../components/Search/Search';
import Pagination from '../../../components/Pagination/Pagination';
import Filtering, { FilterOption, SortOrder } from '../../../components/Filtering/Filtering';
import Danger from '../../../components/Typography/Danger';

interface GridContainerLayoutProps {
  classes: any;
  openRepo: (repo: string) => void;
  repos: RepoView[];
  repoButton: React.ReactNode;
  onSearch: (query: string) => void;
  currentPage: number;
  totalItems: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
  onItemsPerPageChange: (n: number) => void;
  onFilterChange: (filterOption: FilterOption, sortOrder: SortOrder) => void;
  tableId: string;
  key: string;
}

export default function Repositories(): React.ReactElement {
  const useStyles = makeStyles(styles as any);
  const classes = useStyles();
  const [repos, setRepos] = useState<RepoView[]>([]);
  const [totalItems, setTotalItems] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isError, setIsError] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(10);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [refreshKey, setRefreshKey] = useState<number>(0);
  const navigate = useNavigate();
  const { user } = useContext<UserContextType>(UserContext);
  const openRepo = (repoId: string): void => navigate(`/dashboard/repo/${repoId}`);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      const pagination: PaginationParams = {
        page: currentPage,
        limit: itemsPerPage,
        search: searchTerm || undefined,
        sortBy,
        sortOrder,
      };
      const result = await getRepos({}, pagination);
      if (result.success && result.data) {
        setRepos(result.data.data);
        setTotalItems(result.data.total);
      } else if (result.status === 401) {
        setIsLoading(false);
        navigate('/login', { replace: true });
        return;
      } else {
        setIsError(true);
        setErrorMessage(result.message || 'Failed to load repositories');
      }
      setIsLoading(false);
    };
    load();
  }, [currentPage, itemsPerPage, searchTerm, sortBy, sortOrder, refreshKey]);

  const refresh = async (): Promise<void> => {
    setCurrentPage(1);
    setSearchTerm('');
    setRefreshKey((k) => k + 1);
  };

  const handleSearch = (query: string): void => {
    setSearchTerm(query.trim());
    setCurrentPage(1);
  };

  const handleFilterChange = (filterOption: FilterOption, order: SortOrder): void => {
    const fieldMap: Record<string, string> = {
      Alphabetical: 'name',
      'Date Modified': 'lastModified',
      'Date Created': 'dateCreated',
    };
    setSortBy(fieldMap[filterOption] ?? 'name');
    setSortOrder(order === 'desc' ? 'desc' : 'asc');
    setCurrentPage(1);
  };

  const handlePageChange = (page: number): void => setCurrentPage(page);
  const handleItemsPerPageChange = (n: number): void => {
    setItemsPerPage(n);
    setCurrentPage(1);
  };
  const paginatedRepos = repos;

  if (isLoading) return <div>Loading...</div>;
  if (isError) return <Danger>{errorMessage}</Danger>;

  const addrepoButton = user?.admin ? (
    <GridItem>
      <NewRepo onSuccess={refresh} />
    </GridItem>
  ) : (
    <GridItem />
  );

  return getGridContainerLayOut({
    key: 'x',
    classes: classes,
    openRepo: openRepo,
    repos: paginatedRepos,
    repoButton: addrepoButton,
    onSearch: handleSearch,
    currentPage: currentPage,
    totalItems: totalItems,
    itemsPerPage: itemsPerPage,
    onPageChange: handlePageChange,
    onItemsPerPageChange: handleItemsPerPageChange,
    onFilterChange: handleFilterChange,
    tableId: 'RepoListTable',
  });
}

function getGridContainerLayOut(props: GridContainerLayoutProps): React.ReactElement {
  return (
    <GridContainer>
      {props.repoButton}
      <GridItem xs={12} sm={12} md={12}>
        <Search onSearch={props.onSearch} />
        <Filtering onFilterChange={props.onFilterChange} />
        <TableContainer
          style={{ background: 'transparent', borderRadius: '5px', border: '1px solid #d0d7de' }}
        >
          <Table
            size='small'
            id={props.tableId}
            className={props.classes.table}
            aria-label='simple table'
          >
            <TableBody>
              {props.repos.map((repo) => {
                if (repo.url) {
                  return (
                    <RepoOverview
                      repo={{ ...repo, proxyURL: repo.proxyURL || '' }}
                      key={repo._id}
                    />
                  );
                }
                return null;
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
          onItemsPerPageChange={props.onItemsPerPageChange}
        />
      </GridItem>
    </GridContainer>
  );
}
