'use client';

import { useAppDefinitions } from '@/lib/app-definitions-context';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { useDataStore } from '@/lib/data-store';
import { useEnsureHierarchy } from '@/hooks/use-ensure-hierarchy';
import {
  getGlobalSearchGroupOrder,
  GLOBAL_SEARCH_MIN_LENGTH,
  searchGlobal,
  type GlobalSearchGroup,
} from '@/lib/global-search';

interface GlobalSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialQuery?: string;
}

export function GlobalSearchDialog({
  open,
  onOpenChange,
  initialQuery = '',
}: GlobalSearchDialogProps) {
  const { definitions } = useAppDefinitions();
  const groupOrder = useMemo(() => getGlobalSearchGroupOrder(), [definitions]);
  const router = useRouter();
  const {
    customers,
    orders,
    projects,
    maintenanceCases,
    systems,
    subsystems,
    modules,
    units,
    components,
    loading,
  } = useDataStore();
  const { hierarchyLoading, hierarchyReady, hierarchyAttempted } = useEnsureHierarchy();
  const [query, setQuery] = useState(initialQuery);

  useEffect(() => {
    if (open) {
      setQuery(initialQuery);
    }
  }, [open, initialQuery]);

  const searchLoading =
    open && (loading || hierarchyLoading || (!hierarchyReady && !hierarchyAttempted));

  const results = useMemo(
    () =>
      searchGlobal(query, {
        customers,
        orders,
        projects,
        maintenanceCases,
        systems,
        subsystems,
        modules,
        units,
        components,
      }),
    [
      query,
      customers,
      orders,
      projects,
      maintenanceCases,
      systems,
      subsystems,
      modules,
      units,
      components,
    ]
  );

  const grouped = useMemo(() => {
    const map = new Map<GlobalSearchGroup, typeof results>();
    for (const group of groupOrder) {
      map.set(group, []);
    }
    for (const result of results) {
      map.get(result.group)?.push(result);
    }
    return map;
  }, [results, groupOrder]);

  const handleSelect = (href: string) => {
    onOpenChange(false);
    router.push(href);
  };

  const trimmed = query.trim();
  const showHint = trimmed.length > 0 && trimmed.length < GLOBAL_SEARCH_MIN_LENGTH;
  const showEmpty = trimmed.length >= GLOBAL_SEARCH_MIN_LENGTH && results.length === 0 && !searchLoading;

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} title="Search" description="Find customers, projects, cases, and entities">
      <CommandInput
        placeholder="Search customers, projects, cases, entities..."
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        {searchLoading ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Loading data…</p>
        ) : showHint ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Type at least {GLOBAL_SEARCH_MIN_LENGTH} characters to search
          </p>
        ) : showEmpty ? (
          <CommandEmpty>No results found.</CommandEmpty>
        ) : trimmed.length < GLOBAL_SEARCH_MIN_LENGTH ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Start typing to search across the application
          </p>
        ) : (
          groupOrder.map((group) => {
            const items = grouped.get(group) ?? [];
            if (items.length === 0) return null;
            return (
              <CommandGroup key={group} heading={group}>
                {items.map((item) => (
                  <CommandItem
                    key={`${group}-${item.id}`}
                    value={`${group} ${item.title} ${item.subtitle ?? ''}`}
                    onSelect={() => handleSelect(item.href)}
                  >
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate font-medium">{item.title}</span>
                      {item.subtitle ? (
                        <span className="truncate text-xs text-muted-foreground">{item.subtitle}</span>
                      ) : null}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            );
          })
        )}
      </CommandList>
    </CommandDialog>
  );
}
