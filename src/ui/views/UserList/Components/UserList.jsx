import React, { useState } from 'react';
import { makeStyles } from '@material-ui/core/styles';
import GridItem from '../../../components/Grid/GridItem';
import GridContainer from '../../../components/Grid/GridContainer';
import Button from '@material-ui/core/Button';
import Table from '@material-ui/core/Table';
import TableBody from '@material-ui/core/TableBody';
import TableCell from '@material-ui/core/TableCell';
import TableContainer from '@material-ui/core/TableContainer';
import TableHead from '@material-ui/core/TableHead';
import TableRow from '@material-ui/core/TableRow';
import Paper from '@material-ui/core/Paper';
import { CloseRounded, Check, KeyboardArrowRight } from '@material-ui/icons';
import Pagination from '../../../components/Pagination/Pagination';
import Search from '../../../components/Search/Search';


const useStyles = makeStyles({
  table: {
    minWidth: 650,
  },
});

export default function UserList() {
  const classes = useStyles();

  // Dummy user data
  const dummyUsers = [
    { username: 'johnDoe', displayName: 'John Doe', title: 'Developer', email: 'john@example.com', gitAccount: 'johnDoeGit', admin: true },
    { username: 'janeDoe', displayName: 'Jane Doe', title: 'Designer', email: 'jane@example.com', gitAccount: 'janeDoeGit', admin: false },
    { username: 'markSmith', displayName: 'Mark Smith', title: 'Project Manager', email: 'mark@example.com', gitAccount: 'markSmithGit', admin: true },
    { username: 'lucasBrown', displayName: 'Lucas Brown', title: 'Data Scientist', email: 'lucas@example.com', gitAccount: 'lucasBrownGit', admin: false },
    { username: 'emilyWhite', displayName: 'Emily White', title: 'Backend Engineer', email: 'emily@example.com', gitAccount: 'emilyWhiteGit', admin: true },
    { username: 'oliviaGreen', displayName: 'Olivia Green', title: 'Frontend Developer', email: 'olivia@example.com', gitAccount: 'oliviaGreenGit', admin: false },
    { username: 'noahBlue', displayName: 'Noah Blue', title: 'DevOps Engineer', email: 'noah@example.com', gitAccount: 'noahBlueGit', admin: true },
    { username: 'miaBlack', displayName: 'Mia Black', title: 'Quality Analyst', email: 'mia@example.com', gitAccount: 'miaBlackGit', admin: false },
    { username: 'willGray', displayName: 'Will Gray', title: 'HR Manager', email: 'will@example.com', gitAccount: 'willGrayGit', admin: false },
    { username: 'avaYellow', displayName: 'Ava Yellow', title: 'UX Designer', email: 'ava@example.com', gitAccount: 'avaYellowGit', admin: true },
  ];

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5; 
  const [searchQuery, setSearchQuery] = useState('');

  // Calculate the items for the current page
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;

 // Filter users based on the search query
 const filteredUsers = dummyUsers.filter(user =>
  user.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
  user.username.toLowerCase().includes(searchQuery.toLowerCase())
);

const currentItems = filteredUsers.slice(indexOfFirstItem, indexOfLastItem);
const totalItems = filteredUsers.length;
  // Function to handle page change
  const handlePageChange = (page) => {
    setCurrentPage(page);
  };


  // Function to handle search
  const handleSearch = (query) => {
    setSearchQuery(query);
    setCurrentPage(1); // Reset to the first page when searching
  };

  return (
    <GridContainer>
      <GridItem xs={12} sm={12} md={12}>

        {/* Search Component */}
        <Search onSearch={handleSearch} placeholder="Search users..." />

        <TableContainer component={Paper}>
          <Table className={classes.table} aria-label='simple table'>
            <TableHead>
              <TableRow>
                <TableCell align='left'>Name</TableCell>
                <TableCell align='left'>Role</TableCell>
                <TableCell align='left'>E-mail</TableCell>
                <TableCell align='left'>GitHub Username</TableCell>
                <TableCell align='left'>Administrator</TableCell>
                <TableCell align='left'></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {currentItems.map((row) => (
                <TableRow key={row.username}>
                  <TableCell align='left'>{row.displayName}</TableCell>
                  <TableCell align='left'>{row.title}</TableCell>
                  <TableCell align='left'>
                    <a href={`mailto:${row.email}`}>{row.email}</a>
                  </TableCell>
                  <TableCell align='left'>
                    <a href={`https://github.com/${row.gitAccount}`} target='_blank' rel='noreferrer'>
                      {row.gitAccount}
                    </a>
                  </TableCell>
                  <TableCell align='left'>
                    {row.admin ? <Check fontSize='small' color='primary' /> : <CloseRounded color='error' />}
                  </TableCell>
                  <TableCell component='th' scope='row'>
                    <Button variant='contained' color='primary'>
                      <KeyboardArrowRight />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Pagination Component */}
        <Pagination
          currentPage={currentPage}
          totalItems={totalItems}
          itemsPerPage={itemsPerPage}
          onPageChange={handlePageChange}
        />
      </GridItem>
    </GridContainer>
  );
}

