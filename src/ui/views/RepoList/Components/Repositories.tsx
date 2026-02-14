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
  onFilterChange: (filterOption: FilterOption, sortOrder: SortOrder) => void;
  tableId: string;
  key: string;
}

export default function Repositories(): React.ReactElement {
  const useStyles = makeStyles(styles as any);
  const classes = useStyles();
  const [repos, setRepos] = useState<RepoView[]>([]);
  const [filteredRepos, setFilteredRepos] = useState<RepoView[]>([]);
  const [, setAuth] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isError, setIsError] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const itemsPerPage: number = 5;
  const navigate = useNavigate();
  const { user } = useContext<UserContextType>(UserContext);
  const openRepo = (repoId: string): void =>
    navigate(`/dashboard/repo/${repoId}`, { replace: true });

  useEffect(() => {
    getRepos(
      setIsLoading,
      (repos: RepoView[]) => {
        setRepos(repos);
        setFilteredRepos(repos);
      },
      setAuth,
      setIsError,
      setErrorMessage,
    );
  }, []);

  const refresh = async (repo: RepoView): Promise<void> => {
    const updatedRepos = [...repos, repo];
    setRepos(updatedRepos);
    setFilteredRepos(updatedRepos);
  };

  const handleSearch = (query: string): void => {
    setCurrentPage(1);
    if (!query) {
      setFilteredRepos(repos);
    } else {
      const lowercasedQuery = query.toLowerCase();
      setFilteredRepos(
        repos.filter(
          (repo) =>
            repo.name.toLowerCase().includes(lowercasedQuery) ||
            repo.project.toLowerCase().includes(lowercasedQuery),
        ),
      );
    }
  };

  const handleFilterChange = (filterOption: FilterOption, sortOrder: SortOrder): void => {
    const sortedRepos = [...repos];
    switch (filterOption) {
      case 'Date Modified':
        sortedRepos.sort(
          (a, b) =>
            new Date(a.lastModified || 0).getTime() - new Date(b.lastModified || 0).getTime(),
        );
        break;
      case 'Date Created':
        sortedRepos.sort(
          (a, b) => new Date(a.dateCreated || 0).getTime() - new Date(b.dateCreated || 0).getTime(),
        );
        break;
      case 'Alphabetical':
        sortedRepos.sort((a, b) => a.name.localeCompare(b.name));
        break;
      default:
        break;
    }
    if (sortOrder === 'desc') {
      sortedRepos.reverse();
    }

    setFilteredRepos(sortedRepos);
  };

  const handlePageChange = (page: number): void => setCurrentPage(page);
  const startIdx = (currentPage - 1) * itemsPerPage;
  const paginatedRepos = filteredRepos.slice(startIdx, startIdx + itemsPerPage);

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
    totalItems: filteredRepos.length,
    itemsPerPage: itemsPerPage,
    onPageChange: handlePageChange,
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
          <Table id={props.tableId} className={props.classes.table} aria-label='simple table'>
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
        />
      </GridItem>
    </GridContainer>
  );
}
