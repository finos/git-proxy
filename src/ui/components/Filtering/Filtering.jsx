import React, { useState } from 'react';
import './Filtering.css';

const Filtering = ({ onFilterChange }) => {
  const [isOpen, setIsOpen] = useState(false); // State to toggle dropdown open/close
  const [selectedOption, setSelectedOption] = useState('Sort by'); // Initial state
  const [sortOrder, setSortOrder] = useState('asc'); // Track sort order (asc/desc)

  const toggleDropdown = () => {
    setIsOpen(!isOpen); // Toggle dropdown open/close state
  };

  const toggleSortOrder = () => {
    // Toggle sort order only if an option is selected
    if (selectedOption !== 'Sort by') {
      const newSortOrder = sortOrder === 'asc' ? 'desc' : 'asc';
      setSortOrder(newSortOrder);
      onFilterChange(selectedOption, newSortOrder); // Trigger filtering with new order
    }
  };

  const handleOptionClick = (option) => {
    // Handle filter option selection
    setSelectedOption(option);
    onFilterChange(option, sortOrder); // Call the parent function with selected filter and order
    setIsOpen(false); // Collapse the dropdown after selection
  };

  return (
    <div className="filtering-container">
      <div className="dropdown">
        {/* Make the entire button clickable for toggling dropdown */}
        <button onClick={toggleDropdown} className="dropdown-toggle">
          {selectedOption}
          {/* Render the up/down arrow next to selected option */}
          {selectedOption !== 'Sort by' && (
            <span onClick={(e) => { e.stopPropagation(); toggleSortOrder(); }}>
              {sortOrder === 'asc' ? ' ↑' : ' ↓'}
            </span>
          )}
          <span className="dropdown-arrow">▼</span>
        </button>

        {isOpen && (
          <div className="dropdown-menu">
            <div onClick={() => handleOptionClick('Date Modified')} className="dropdown-item">
              Date Modified
            </div>
            <div onClick={() => handleOptionClick('Date Created')} className="dropdown-item">
              Date Created
            </div>
            <div onClick={() => handleOptionClick('Alphabetical')} className="dropdown-item">
              Alphabetical
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Filtering;




