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

import React, { useState, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router';
import { sortUsers } from '../../../services/user';
import Danger from '../../../components/Typography/Danger';
import UserListTable from './UserListTable';
import { type UserSortField } from './userSortField';
import { applyUserListUrlPatch, parseUserListUrlState } from './userListQuery';
import { useClientPagination } from '../../../hooks/useClientPagination';
import { useUsersListQuery } from '../../../query/useUsersListQuery';

const UserList = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const itemsPerPage = 26;

  const { sort, filter, page } = useMemo(() => parseUserListUrlState(searchParams), [searchParams]);

  const { data: rawUsers = [], isLoading, error } = useUsersListQuery();

  const users = useMemo(() => sortUsers(rawUsers, sort), [rawUsers, sort]);

  const handleSortChange = useCallback(
    (next: UserSortField) => {
      setSearchParams((prev) => applyUserListUrlPatch(prev, { sort: next }), { replace: true });
    },
    [setSearchParams],
  );

  const handleSearch = useCallback(
    (query: string): void => {
      setSearchParams((prev) => applyUserListUrlPatch(prev, { filter: query, page: 1 }), {
        replace: true,
      });
    },
    [setSearchParams],
  );

  const handlePageChange = useCallback(
    (nextPage: number): void => {
      setSearchParams((prev) => applyUserListUrlPatch(prev, { page: nextPage }), { replace: true });
    },
    [setSearchParams],
  );

  const filteredUsers = useMemo(() => {
    if (!filter) return users;
    const lowercasedQuery = filter.toLowerCase();
    return users.filter(
      (user) =>
        (user.displayName && user.displayName.toLowerCase().includes(lowercasedQuery)) ||
        (user.username && user.username.toLowerCase().includes(lowercasedQuery)),
    );
  }, [users, filter]);

  const { effectivePage, currentItems } = useClientPagination(
    filteredUsers,
    page,
    itemsPerPage,
    isLoading,
    (corrected) =>
      setSearchParams((p) => applyUserListUrlPatch(p, { page: corrected }), { replace: true }),
  );

  if (isLoading) return <div>Loading...</div>;
  if (error) return <Danger>{error.message}</Danger>;

  return (
    <UserListTable
      users={currentItems}
      filterValue={filter}
      onSearch={handleSearch}
      sort={sort}
      onSortChange={handleSortChange}
      currentPage={effectivePage}
      totalItems={filteredUsers.length}
      itemsPerPage={itemsPerPage}
      onPageChange={handlePageChange}
    />
  );
};

export default UserList;
