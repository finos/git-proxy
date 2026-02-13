/**
 * @license
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License. You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import React, { useState, useEffect } from 'react';
import { makeStyles } from '@material-ui/core/styles';
import GridItem from '../../../components/Grid/GridItem';
import GridContainer from '../../../components/Grid/GridContainer';
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
import { getUsers } from '../../../services/user';
import Pagination from '../../../components/Pagination/Pagination';
import { CloseRounded, Check, KeyboardArrowRight } from '@material-ui/icons';
import Search from '../../../components/Search/Search';
import Danger from '../../../components/Typography/Danger';
import { PublicUser } from '../../../../db/types';

const useStyles = makeStyles(styles as any);

const UserList: React.FC = () => {
  const classes = useStyles();
  const [users, setUsers] = useState<PublicUser[]>([]);
  const [, setAuth] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const navigate = useNavigate();
  const [currentPage, setCurrentPage] = useState<number>(1);
  const itemsPerPage = 5;
  const [searchQuery, setSearchQuery] = useState<string>('');

  const openUser = (username: string) => navigate(`/dashboard/user/${username}`, { replace: true });

  useEffect(() => {
    getUsers(setIsLoading, setUsers, setAuth, setErrorMessage);
  }, []);

  if (isLoading) return <div>Loading...</div>;
  if (errorMessage) return <Danger>{errorMessage}</Danger>;

  const filteredUsers = users.filter(
    (user) =>
      (user.displayName && user.displayName.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (user.username && user.username.toLowerCase().includes(searchQuery.toLowerCase())),
  );

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredUsers.slice(indexOfFirstItem, indexOfLastItem);
  const totalItems = filteredUsers.length;

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    setCurrentPage(1);
  };

  return (
    <GridContainer>
      <GridItem xs={12} sm={12} md={12}>
        <Search onSearch={handleSearch} placeholder='Search users...' />
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
              {currentItems.map((user) => (
                <TableRow key={user.username}>
                  <TableCell align='left'>{user.displayName}</TableCell>
                  <TableCell align='left'>{user.title}</TableCell>
                  <TableCell align='left'>
                    <a href={`mailto:${user.email}`}>{user.email}</a>
                  </TableCell>
                  <TableCell align='left'>
                    <a
                      href={`https://github.com/${user.gitAccount}`}
                      target='_blank'
                      rel='noreferrer'
                    >
                      {user.gitAccount}
                    </a>
                  </TableCell>
                  <TableCell align='left'>
                    {user.admin ? (
                      <Check fontSize='small' color='primary' />
                    ) : (
                      <CloseRounded color='error' />
                    )}
                  </TableCell>
                  <TableCell component='th' scope='row'>
                    <Button
                      variant='contained'
                      color='primary'
                      onClick={() => openUser(user.username)}
                    >
                      <KeyboardArrowRight />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        <Pagination
          currentPage={currentPage}
          totalItems={totalItems}
          itemsPerPage={itemsPerPage}
          onPageChange={handlePageChange}
        />
      </GridItem>
    </GridContainer>
  );
};

export default UserList;
