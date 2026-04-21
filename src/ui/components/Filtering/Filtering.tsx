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

import React, { useState } from 'react';
import Select from '@material-ui/core/Select';
import MenuItem from '@material-ui/core/MenuItem';
import IconButton from '@material-ui/core/IconButton';
import { ArrowUpward, ArrowDownward } from '@material-ui/icons';

export type FilterOption = 'Alphabetical' | 'Sort by';
export type SortOrder = 'asc' | 'desc';

interface FilteringProps {
  onFilterChange: (option: FilterOption, order: SortOrder) => void;
}

const Filtering: React.FC<FilteringProps> = ({ onFilterChange }) => {
  const [selectedOption, setSelectedOption] = useState<FilterOption>('Sort by');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  const handleOptionChange = (e: React.ChangeEvent<{ value: unknown }>) => {
    const option = e.target.value as FilterOption;
    setSelectedOption(option);
    if (option !== 'Sort by') {
      onFilterChange(option, sortOrder);
    }
  };

  const toggleSortOrder = () => {
    if (selectedOption !== 'Sort by') {
      const newOrder: SortOrder = sortOrder === 'asc' ? 'desc' : 'asc';
      setSortOrder(newOrder);
      onFilterChange(selectedOption, newOrder);
    }
  };

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, paddingBottom: 10 }}>
      <Select
        value={selectedOption}
        onChange={handleOptionChange}
        variant='outlined'
        margin='dense'
        style={{ fontSize: 14, height: 36, minWidth: 140 }}
      >
        <MenuItem value='Sort by' disabled>
          Sort by
        </MenuItem>
        <MenuItem value='Alphabetical'>Alphabetical</MenuItem>
      </Select>
      {selectedOption !== 'Sort by' && (
        <IconButton
          size='small'
          onClick={toggleSortOrder}
          title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}
        >
          {sortOrder === 'asc' ? (
            <ArrowUpward fontSize='small' />
          ) : (
            <ArrowDownward fontSize='small' />
          )}
        </IconButton>
      )}
    </div>
  );
};

export default Filtering;
