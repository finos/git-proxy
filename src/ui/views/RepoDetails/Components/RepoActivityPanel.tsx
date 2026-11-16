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

import React, { useCallback, useState } from 'react';
import { Stack, Text } from '@primer/react';
import PushesTable from '../../PushRequests/components/PushesTable';
import Danger from '../../../components/Typography/Danger';
import { PushActionView, RepoView } from '../../../types';

const ACTIVITY_ITEMS_PER_PAGE = 100;

export interface RepoActivityPanelProps {
  registeredRepos: RepoView[];
  pushes: PushActionView[];
  isLoading: boolean;
  errorMessage: string | null;
}

const RepoActivityPanel = ({
  registeredRepos,
  pushes,
  isLoading,
  errorMessage,
}: RepoActivityPanelProps) => {
  const [page, setPage] = useState(1);

  const handlePageChange = useCallback((nextPage: number) => {
    setPage(nextPage);
  }, []);

  const maxPage = Math.max(1, Math.ceil(pushes.length / ACTIVITY_ITEMS_PER_PAGE));
  const effectivePage = Math.min(page, maxPage);

  return (
    <Stack direction='vertical' gap='normal' padding='none' className='min-w-0 w-full'>
      {errorMessage ? <Danger>{errorMessage}</Danger> : null}
      {!errorMessage ? (
        <div className='min-w-0 w-full'>
          {!isLoading && pushes.length === 0 ? (
            <Text
              as='p'
              size='medium'
              weight='normal'
              className='m-0 min-w-0 w-full text-[var(--fgColor-default)]'
            >
              No activity yet for this repository.
            </Text>
          ) : (
            <PushesTable
              registeredRepos={registeredRepos}
              rows={pushes}
              isLoading={isLoading}
              currentPage={effectivePage}
              onPageChange={handlePageChange}
              showStatus
            />
          )}
        </div>
      ) : null}
    </Stack>
  );
};

export default RepoActivityPanel;
