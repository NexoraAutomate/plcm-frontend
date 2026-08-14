'use client';

import { useState } from 'react';

/**
 * Pagination index that jumps back to page 0 on the same render when
 * `resetKey` changes (search/filters). An effect-based reset is one frame
 * too late and fetches the old page against the new filters.
 */
export function useSyncedPage(resetKey: string, initialPage = 0) {
  const [page, setPage] = useState(initialPage);
  const [seenKey, setSeenKey] = useState(resetKey);

  if (seenKey !== resetKey) {
    setSeenKey(resetKey);
    setPage(initialPage);
  }

  const currentPage = seenKey !== resetKey ? initialPage : page;
  return { page: currentPage, setPage };
}
