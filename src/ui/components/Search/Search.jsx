import React from 'react';
import { TextField } from '@material-ui/core';
import './Search.css';
import InputAdornment from '@material-ui/core/InputAdornment';
import SearchIcon from '@material-ui/icons/Search'; // Import the Search Icon


export default function Search({ onSearch }) {
  const handleSearchChange = (event) => {
    const query = event.target.value;
    onSearch(query);  // Pass the search query to parent component
  };

  return (
    <div style={{ margin: '20px 0' }}>
      <TextField
        label="Search"
        variant="outlined"
        fullWidth
        margin="normal"
        onChange={handleSearchChange}  // Trigger onSearch on every change
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




