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

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigationType } from 'react-router';
import { TextInput } from '@primer/react';
import { SearchIcon, XIcon } from '@primer/octicons-react';

export interface ListFilterInputProps {
  value: string;
  onSearch: (query: string) => void;
  /** Visible hint text. Default matches repositories list. */
  placeholder?: string;
  /** Accessible label for the field (maps to `aria-label`). */
  ariaLabel?: string;
  /** `name` on the underlying input. Default preserves repositories list behavior. */
  name?: string;
  /** `id` on the underlying input when you need to associate a label. */
  inputId?: string;
}

const DEFAULT_PLACEHOLDER = 'Search repositories';
const DEFAULT_ARIA_LABEL = 'Search repositories';
const DEFAULT_NAME = 'repos-filter';

/**
 * Compact Primer search field with leading icon and optional clear action.
 * @see https://primer.style/product/components/text-input/
 */
const ListFilterInput = ({
  value,
  onSearch,
  placeholder = DEFAULT_PLACEHOLDER,
  ariaLabel = DEFAULT_ARIA_LABEL,
  name = DEFAULT_NAME,
  inputId,
}: ListFilterInputProps) => {
  const { key: navigationKey } = useLocation();
  const navigationType = useNavigationType();
  const [draft, setDraft] = useState(value);
  const pendingSearches = useRef<string[]>([]);

  useEffect(() => {
    if (navigationType === 'POP') {
      pendingSearches.current = [];
      setDraft(value);
      return;
    }

    const acknowledgedIndex = pendingSearches.current.lastIndexOf(value.trim());
    if (acknowledgedIndex !== -1) {
      pendingSearches.current.splice(0, acknowledgedIndex + 1);
      return;
    }

    pendingSearches.current = [];
    setDraft((current) => (current.trim() === value.trim() ? current : value));
  }, [value, navigationKey, navigationType]);

  const updateSearch = useCallback(
    (query: string) => {
      setDraft(query);
      const normalizedQuery = query.trim();
      const searches = pendingSearches.current;
      const previousQuery = searches.length > 0 ? searches[searches.length - 1] : value.trim();
      if (normalizedQuery !== previousQuery) {
        searches.push(normalizedQuery);
      }
      onSearch(query);
    },
    [onSearch, value],
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      updateSearch(e.target.value);
    },
    [updateSearch],
  );

  const handleClear = useCallback(() => {
    updateSearch('');
  }, [updateSearch]);

  return (
    <div className='list-filter-input-wrap w-full min-w-0' data-testid='search'>
      <TextInput
        id={inputId}
        className='list-filter-input w-full min-w-0'
        name={name}
        block
        leadingVisual={SearchIcon}
        placeholder={placeholder}
        aria-label={ariaLabel}
        autoComplete='off'
        autoCorrect='off'
        autoCapitalize='off'
        spellCheck={false}
        value={draft}
        onChange={handleChange}
        trailingAction={
          draft ? (
            <TextInput.Action icon={XIcon} aria-label='Clear search' onClick={handleClear} />
          ) : undefined
        }
      />
    </div>
  );
};

export default ListFilterInput;
