import React from 'react';
import { TextField } from '@material-ui/core';
import './Search.css';
import InputAdornment from '@material-ui/core/InputAdornment';
import SearchIcon from '@material-ui/icons/Search';

interface SearchProps {
  onSearch: (query: string) => void;
  placeholder?: string;
}

const Search: React.FC<SearchProps> = ({ onSearch, placeholder = 'Search...' }) => {
  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const query = event.target.value;
    onSearch(query);
  };

  return (
    <div style={{ margin: '20px 0' }}>
      <TextField
        label='Search'
        variant='outlined'
        fullWidth
        margin='normal'
        onChange={handleSearchChange}
        placeholder={placeholder}
        InputProps={{
          startAdornment: (
            <InputAdornment position='start'>
              <SearchIcon />
            </InputAdornment>
          ),
        }}
      />
    </div>
  );
};

export default Search;
