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

import { useEffect, useMemo, useRef } from 'react';

/**
 * Computes pagination over a client-side filtered list and fires a URL correction
 * when the current page exceeds the available page count.
 *
 * @param items       Already-filtered array to paginate.
 * @param page        Current page number from URL state (1-based).
 * @param itemsPerPage Number of items per page.
 * @param isLoading   When true the clamp effect is suppressed (avoids premature corrections
 *                    before data has loaded).
 * @param onPageClamp Called with the corrected page number when `page > maxPage`.
 */
export function useClientPagination<T>(
  items: T[],
  page: number,
  itemsPerPage: number,
  isLoading: boolean,
  onPageClamp: (corrected: number) => void,
): { effectivePage: number; currentItems: T[]; maxPage: number } {
  const onPageClampRef = useRef(onPageClamp);
  onPageClampRef.current = onPageClamp;

  const { effectivePage, currentItems, maxPage } = useMemo(() => {
    const maxPage = Math.max(1, Math.ceil(items.length / itemsPerPage));
    const effectivePage = Math.min(page, maxPage);
    const startIdx = (effectivePage - 1) * itemsPerPage;
    return {
      effectivePage,
      currentItems: items.slice(startIdx, startIdx + itemsPerPage),
      maxPage,
    };
  }, [items, page, itemsPerPage]);

  useEffect(() => {
    if (isLoading) return;
    if (page !== effectivePage) {
      onPageClampRef.current(effectivePage);
    }
  }, [isLoading, page, effectivePage]);

  return { effectivePage, currentItems, maxPage };
}
