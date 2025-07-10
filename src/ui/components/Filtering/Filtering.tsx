import React, { useState } from 'react';
import './Filtering.css';

export type FilterOption = 'Date Modified' | 'Date Created' | 'Alphabetical' | 'Sort by';
export type SortOrder = 'asc' | 'desc';

interface FilteringProps {
  onFilterChange: (option: FilterOption, order: SortOrder) => void;
}

const Filtering: React.FC<FilteringProps> = ({ onFilterChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedOption, setSelectedOption] = useState<FilterOption>('Sort by');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  const toggleDropdown = () => {
    setIsOpen(!isOpen);
  };

  const toggleSortOrder = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (selectedOption !== 'Sort by') {
      const newSortOrder = sortOrder === 'asc' ? 'desc' : 'asc';
      setSortOrder(newSortOrder);
      onFilterChange(selectedOption, newSortOrder);
    }
  };

  const handleOptionClick = (option: FilterOption) => {
    setSelectedOption(option);
    onFilterChange(option, sortOrder);
    setIsOpen(false);
  };

  return (
    <div className='filtering-container'>
      <div className='dropdown'>
        <button onClick={toggleDropdown} className='dropdown-toggle'>
          {selectedOption}
          {selectedOption !== 'Sort by' && (
            <span onClick={toggleSortOrder}>{sortOrder === 'asc' ? ' ↑' : ' ↓'}</span>
          )}
          <span className='dropdown-arrow'>▼</span>
        </button>

        {isOpen && (
          <div className='dropdown-menu'>
            <div onClick={() => handleOptionClick('Date Modified')} className='dropdown-item'>
              Date Modified
            </div>
            <div onClick={() => handleOptionClick('Date Created')} className='dropdown-item'>
              Date Created
            </div>
            <div onClick={() => handleOptionClick('Alphabetical')} className='dropdown-item'>
              Alphabetical
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Filtering;
