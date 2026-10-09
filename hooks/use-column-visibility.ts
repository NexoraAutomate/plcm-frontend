'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

export type ColumnVisibilityDef = {
  id: string;
  label: string;
  /** When false, column starts hidden. Default true. */
  defaultVisible?: boolean;
  /** When true, column cannot be hidden. */
  alwaysVisible?: boolean;
};

const storageKey = (tableId: string) => `table-columns:${tableId}`;

function defaultVisibleIds(columns: ColumnVisibilityDef[]): string[] {
  return columns
    .filter((c) => c.alwaysVisible || c.defaultVisible !== false)
    .map((c) => c.id);
}

function readStored(tableId: string, columns: ColumnVisibilityDef[]): string[] | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(storageKey(tableId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;
    const allowed = new Set(columns.map((c) => c.id));
    const ids = parsed.filter((id): id is string => typeof id === 'string' && allowed.has(id));
    const always = columns.filter((c) => c.alwaysVisible).map((c) => c.id);
    for (const id of always) {
      if (!ids.includes(id)) ids.push(id);
    }
    return ids.length > 0 ? ids : null;
  } catch {
    return null;
  }
}

export function useColumnVisibility(tableId: string, columns: ColumnVisibilityDef[]) {
  const columnKey = columns.map((c) => c.id).join('|');
  const defaults = useMemo(() => defaultVisibleIds(columns), [columnKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const [visibleIds, setVisibleIdsState] = useState<string[]>(defaults);

  useEffect(() => {
    const stored = readStored(tableId, columns);
    setVisibleIdsState(stored ?? defaultVisibleIds(columns));
    // Intentionally re-sync when tableId or column set changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableId, columnKey]);

  const setVisibleIds = useCallback(
    (next: string[] | ((prev: string[]) => string[])) => {
      setVisibleIdsState((prev) => {
        const resolved = typeof next === 'function' ? next(prev) : next;
        const always = columns.filter((c) => c.alwaysVisible).map((c) => c.id);
        const allowed = new Set(columns.map((c) => c.id));
        const merged = Array.from(new Set([...resolved.filter((id) => allowed.has(id)), ...always]));
        const finalIds = merged.length > 0 ? merged : defaultVisibleIds(columns);
        try {
          localStorage.setItem(storageKey(tableId), JSON.stringify(finalIds));
        } catch {
          /* ignore quota */
        }
        return finalIds;
      });
    },
    [columns, tableId]
  );

  const isVisible = useCallback(
    (id: string) => visibleIds.includes(id),
    [visibleIds]
  );

  const toggleColumn = useCallback(
    (id: string) => {
      const def = columns.find((c) => c.id === id);
      if (def?.alwaysVisible) return;
      setVisibleIds((prev) =>
        prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
      );
    },
    [columns, setVisibleIds]
  );

  const resetColumns = useCallback(() => {
    setVisibleIds(defaultVisibleIds(columns));
  }, [columns, setVisibleIds]);

  const visibleColumns = useMemo(
    () => columns.filter((c) => visibleIds.includes(c.id)),
    [columns, visibleIds]
  );

  return {
    visibleIds,
    visibleColumns,
    isVisible,
    toggleColumn,
    setVisibleIds,
    resetColumns,
  };
}
