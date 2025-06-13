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
import NewRepo, { RepositoryData } from './NewRepo';
import RepoOverview from './RepoOverview';
import { UserContext } from '../../../../context';
import Search from '../../../components/Search/Search';
import Pagination from '../../../components/Pagination/Pagination';
import Filtering, { FilterOption, SortOrder } from '../../../components/Filtering/Filtering';
import { RepositoriesProps } from '../repositories.types';

interface GridContainerLayoutProps {
  classes: any;
  openRepo: (repo: string) => void;
  data: RepositoryData[];
  repoButton: React.ReactNode;
  onSearch: (query: string) => void;
  currentPage: number;
  totalItems: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
  onFilterChange: (filterOption: FilterOption, sortOrder: SortOrder) => void;
}

interface UserContextType {
  user: {
    admin: boolean;
    [key: string]: any;
  };
}

export default function Repositories(props: RepositoriesProps): React.ReactElement {
  const useStyles = makeStyles(styles as any);
  const classes = useStyles();
  const [data, setData] = useState<RepositoryData[]>([]);
  const [filteredData, setFilteredData] = useState<RepositoryData[]>([]);
  const [, setAuth] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isError, setIsError] = useState<boolean>(false);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const itemsPerPage: number = 5;
  const navigate = useNavigate();
  const { user } = useContext<UserContextType>(UserContext);

  const openRepo = (repo: string): void => navigate(`/dashboard/repo/${repo}`, { replace: true });

  useEffect(() => {
    const query: Record<string, any> = {};
    for (const k in props) {
      if (!k) continue;
      query[k] = props[k];
    }
    getRepos(
      setIsLoading,
      (data: RepositoryData[]) => {
        setData(data);
        setFilteredData(data);
      },
      setAuth,
      setIsError,
      query,
    );
  }, [props]);

  const refresh = async (repo: RepositoryData): Promise<void> => {
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
      data={paginatedData}
      repoButton={addrepoButton}
      onSearch={handleSearch}
      currentPage={currentPage}
      totalItems={filteredData.length}
      itemsPerPage={itemsPerPage}
      onPageChange={handlePageChange}
      onFilterChange={handleFilterChange}
    />
  );
}

function GetGridContainerLayOut(props: GridContainerLayoutProps): React.ReactElement {
  return (
    <GridContainer>
      {props.repoButton}
      <GridItem xs={12} sm={12} md={12}>
        <Search onSearch={props.onSearch} />
        <Filtering onFilterChange={props.onFilterChange} />
        <TableContainer
          style={{ background: 'transparent', borderRadius: '5px', border: '1px solid #d0d7de' }}
        >
          <Table className={props.classes.table} aria-label='simple table'>
            <TableBody>
              {props.data.map((row) => {
                if (row.project && row.name) {
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
