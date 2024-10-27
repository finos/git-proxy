import React, { useState } from 'react';
import PropTypes from 'prop-types';
import './Search.css'; // Import the CSS file

export default function Search({ placeholder = 'Search...', onSearch }) {
  const [query, setQuery] = useState('');

  const handleInputChange = (e) => {
    setQuery(e.target.value);
  };

  const handleSearch = () => {
    onSearch(query);
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter') {
      handleSearch(); // Trigger search on Enter
    }
  };

  return (
    <div className="search-container">
      <input
        type="text"
        placeholder={placeholder}
        value={query}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown} // Add keydown event
        className="search-input" // Apply the class
      />
      <button onClick={handleSearch} className="search-button">
        Search
      </button>
    </div>
  );
}

Search.propTypes = {
  placeholder: PropTypes.string,
  onSearch: PropTypes.func.isRequired,
};
