import React from 'react';
import { TextField } from '@material-ui/core';
import './Search.css';
import InputAdornment from '@material-ui/core/InputAdornment';
import SearchIcon from '@material-ui/icons/Search'; 


export default function Search({ onSearch }) {
  const handleSearchChange = (event) => {
    const query = event.target.value;
    onSearch(query);  
  };

  return (
    <div style={{ margin: '20px 0' }}>
      <TextField
        label="Search"
        variant="outlined"
        fullWidth
        margin="normal"
        onChange={handleSearchChange}  
        placeholder="Search..."
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon />
            </InputAdornment>
          ),
        }}
      />
    </div>
  );
}
