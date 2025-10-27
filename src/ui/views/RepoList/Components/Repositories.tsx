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
import NewRepo, { RepositoryDataWithId } from './NewRepo';
import RepoOverview from './RepoOverview';
import { UserContext } from '../../../../context';
import Search from '../../../components/Search/Search';
import Pagination from '../../../components/Pagination/Pagination';
import Filtering, { FilterOption, SortOrder } from '../../../components/Filtering/Filtering';
import Danger from '../../../components/Typography/Danger';

interface GridContainerLayoutProps {
  classes: any;
  openRepo: (repo: string) => void;
  data: RepositoryDataWithId[];
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

interface UserContextType {
  user: {
    admin: boolean;
    [key: string]: any;
  };
}

export default function Repositories(): React.ReactElement {
  const useStyles = makeStyles(styles as any);
  const classes = useStyles();
  const [data, setData] = useState<RepositoryDataWithId[]>([]);
  const [filteredData, setFilteredData] = useState<RepositoryDataWithId[]>([]);
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
      (data: RepositoryDataWithId[]) => {
        setData(data);
        setFilteredData(data);
      },
      setAuth,
      setIsError,
      setErrorMessage,
    );
  }, []);

  const refresh = async (repo: RepositoryDataWithId): Promise<void> => {
    const updatedData = [...data, repo];
    setData(updatedData);
    setFilteredData(updatedData);
  };

  const handleSearch = (query: string): void => {
    setCurrentPage(1);
    if (!query) {
      setFilteredData(data);
    } else {
      const lowercasedQuery = query.toLowerCase();
      setFilteredData(
        data.filter(
          (repo) =>
            repo.name.toLowerCase().includes(lowercasedQuery) ||
            repo.project.toLowerCase().includes(lowercasedQuery),
        ),
      );
    }
  };

  const handleFilterChange = (filterOption: FilterOption, sortOrder: SortOrder): void => {
    const sortedData = [...data];
    switch (filterOption) {
      case 'Date Modified':
        sortedData.sort(
          (a, b) =>
            new Date(a.lastModified || 0).getTime() - new Date(b.lastModified || 0).getTime(),
        );
        break;
      case 'Date Created':
        sortedData.sort(
          (a, b) => new Date(a.dateCreated || 0).getTime() - new Date(b.dateCreated || 0).getTime(),
        );
        break;
      case 'Alphabetical':
        sortedData.sort((a, b) => a.name.localeCompare(b.name));
        break;
      default:
        break;
    }
    if (sortOrder === 'desc') {
      sortedData.reverse();
    }

    setFilteredData(sortedData);
  };

  const handlePageChange = (page: number): void => setCurrentPage(page);
  const startIdx = (currentPage - 1) * itemsPerPage;
  const paginatedData = filteredData.slice(startIdx, startIdx + itemsPerPage);

  if (isLoading) return <div>Loading...</div>;
  if (isError) return <Danger>{errorMessage}</Danger>;

  const addrepoButton = user.admin ? (
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
    data: paginatedData,
    repoButton: addrepoButton,
    onSearch: handleSearch,
    currentPage: currentPage,
    totalItems: filteredData.length,
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
              {props.data.map((row) => {
                if (row.url) {
                  return (
                    <RepoOverview data={{ ...row, proxyURL: row.proxyURL || '' }} key={row._id} />
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
