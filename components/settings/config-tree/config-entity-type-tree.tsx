'use client';

/**
 * Expandable entity tree (MUI Tree View–style UX without adding @mui/x-tree-view).
 * https://mui.com/x/react-tree-view/
 */

import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, FileText, Folder, FolderOpen } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { filterTemplateNames, type TemplateNameItem } from '@/lib/hierarchy-template-names';
import {
  TEMPLATE_NODE_LEVELS,
  type TemplateNodeLevel,
} from '@/lib/hierarchy-config';
import { LEVEL_LEGEND_DOT } from '@/lib/config-tree-level-styles';
import { cn } from '@/lib/utils';

export type EntityTreeSelection = {
  level: TemplateNodeLevel;
  name: string;
  abbreviation: string;
  entityId: number;
};

type Props = {
  entities: TemplateNameItem[];
  levelLabel: (level: string) => string;
  /** When set, only this level’s leaves are interactive. */
  selectableLevel?: TemplateNodeLevel | null;
  /**
   * Names (lowercase) already used under the current parent for the selectable level.
   * Shown dimmed/disabled instead of hidden.
   */
  usedNames?: Set<string>;
  /** Hide these levels entirely (e.g. system when one already exists). */
  hiddenLevels?: TemplateNodeLevel[];
  selectedName?: string;
  onSelect?: (item: EntityTreeSelection) => void;
  draggable?: boolean;
  onDragStart?: (event: React.DragEvent, item: EntityTreeSelection) => void;
  className?: string;
  defaultExpandedLevels?: TemplateNodeLevel[];
  emptyHint?: string;
};

export function ConfigEntityTypeTree({
  entities,
  levelLabel,
  selectableLevel,
  usedNames,
  hiddenLevels,
  selectedName,
  onSelect,
  draggable,
  onDragStart,
  className,
  defaultExpandedLevels,
  emptyHint,
}: Props) {
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<Set<TemplateNodeLevel>>(() => {
    if (defaultExpandedLevels?.length) return new Set(defaultExpandedLevels);
    return new Set<TemplateNodeLevel>();
  });

  useEffect(() => {
    if (selectableLevel) {
      setExpanded(new Set([selectableLevel]));
    }
  }, [selectableLevel]);

  const visibleLevels = useMemo(
    () => TEMPLATE_NODE_LEVELS.filter((l) => !hiddenLevels?.includes(l)),
    [hiddenLevels]
  );

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    return visibleLevels.map((level) => {
      const items = filterTemplateNames(entities, level).filter(
        (item) => !q || item.name.toLowerCase().includes(q)
      );
      return { level, items };
    });
  }, [entities, query, visibleLevels]);

  const toggle = (level: TemplateNodeLevel) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(level)) next.delete(level);
      else next.add(level);
      return next;
    });
  };

  if (visibleLevels.length === 0) {
    return (
      <div className={cn('rounded-2xl border bg-muted/20 p-4 text-sm text-muted-foreground', className)}>
        {emptyHint || 'No entities available for this selection.'}
      </div>
    );
  }

  return (
    <div className={cn('flex h-full min-h-0 flex-col gap-2', className)}>
      <Input
        className="h-8 rounded-full"
        placeholder="Filter entities…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="min-h-0 flex-1 overflow-auto rounded-2xl border bg-muted/20 p-2">
        <ul className="space-y-1" role="tree" aria-label="Entity list by type">
          {groups.map(({ level, items }) => {
            const levelInteractive =
              selectableLevel == null || selectableLevel === level;
            const isOpen =
              (expanded.has(level) || (query.trim().length > 0 && items.length > 0)) &&
              (levelInteractive || query.trim().length > 0);
            return (
              <li key={level} role="treeitem" aria-expanded={isOpen}>
                <Collapsible
                  open={isOpen}
                  onOpenChange={() => {
                    if (!levelInteractive && !query.trim()) return;
                    toggle(level);
                  }}
                >
                  <CollapsibleTrigger asChild>
                    <button
                      type="button"
                      disabled={!levelInteractive && !query.trim()}
                      className={cn(
                        'flex w-full items-center gap-2 rounded-full px-2.5 py-1.5 text-left text-sm font-medium transition-colors',
                        levelInteractive
                          ? 'hover:bg-muted/80'
                          : 'cursor-not-allowed opacity-40',
                        selectableLevel === level && 'bg-muted/60'
                      )}
                    >
                      {isOpen ? (
                        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      )}
                      {isOpen ? (
                        <FolderOpen className="h-4 w-4 shrink-0 text-amber-600" />
                      ) : (
                        <Folder className="h-4 w-4 shrink-0 text-amber-600" />
                      )}
                      <span
                        className={cn('h-2 w-2 shrink-0 rounded-full', LEVEL_LEGEND_DOT[level])}
                      />
                      <span className="min-w-0 flex-1 truncate">{levelLabel(level)}</span>
                      <span className="tabular-nums text-xs text-muted-foreground">
                        {items.length}
                      </span>
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <ul
                      role="group"
                      className="ml-3 mt-0.5 space-y-0.5 border-l-2 border-muted-foreground/25 pl-3"
                    >
                      {items.length === 0 ? (
                        <li className="rounded-full px-2 py-1.5 text-xs text-muted-foreground">
                          No entities
                        </li>
                      ) : (
                        items.map((item) => {
                          const payload: EntityTreeSelection = {
                            level,
                            name: item.name,
                            abbreviation: (item.abbreviation || '').toUpperCase(),
                            entityId: item.id,
                          };
                          const taken = usedNames?.has(item.name.trim().toLowerCase()) ?? false;
                          const levelAllowed = levelInteractive;
                          const canUse = levelAllowed && !taken;
                          const canClick = canUse && !!onSelect;
                          const canDrag = !!draggable && canUse;
                          const selected =
                            selectedName === item.name &&
                            (selectableLevel == null || selectableLevel === level);
                          return (
                            <li key={`${level}-${item.id}-${item.name}`} role="treeitem">
                              <div
                                role={canClick ? 'button' : undefined}
                                tabIndex={canClick || canDrag ? 0 : -1}
                                title={
                                  taken
                                    ? 'Already used under this parent'
                                    : !levelAllowed
                                      ? 'Select a matching parent on the canvas'
                                      : undefined
                                }
                                draggable={canDrag}
                                onDragStart={(event) => {
                                  if (!canDrag) {
                                    event.preventDefault();
                                    return;
                                  }
                                  event.dataTransfer.effectAllowed = 'copy';
                                  onDragStart?.(event, payload);
                                }}
                                onClick={() => {
                                  if (!canClick) return;
                                  onSelect?.(payload);
                                }}
                                onKeyDown={(event) => {
                                  if (!canClick) return;
                                  if (event.key === 'Enter' || event.key === ' ') {
                                    event.preventDefault();
                                    onSelect?.(payload);
                                  }
                                }}
                                className={cn(
                                  'flex w-full items-center gap-2 rounded-full px-2.5 py-1.5 text-left text-xs transition-colors select-none',
                                  canUse
                                    ? 'hover:bg-background'
                                    : 'cursor-not-allowed opacity-40',
                                  selected &&
                                    'bg-primary text-primary-foreground hover:bg-primary/90',
                                  canDrag && 'cursor-grab active:cursor-grabbing',
                                  canClick && !canDrag && 'cursor-pointer'
                                )}
                              >
                                <FileText
                                  className={cn(
                                    'h-3.5 w-3.5 shrink-0 pointer-events-none',
                                    selected
                                      ? 'text-primary-foreground'
                                      : 'text-muted-foreground'
                                  )}
                                />
                                <span className="min-w-0 flex-1 truncate font-medium pointer-events-none">
                                  {item.name}
                                  {taken ? (
                                    <span className="ml-1 font-normal opacity-80">(used)</span>
                                  ) : null}
                                </span>
                                {item.abbreviation ? (
                                  <span
                                    className={cn(
                                      'shrink-0 font-mono text-[10px] pointer-events-none',
                                      selected
                                        ? 'text-primary-foreground/80'
                                        : 'text-muted-foreground'
                                    )}
                                  >
                                    {item.abbreviation}
                                  </span>
                                ) : null}
                              </div>
                            </li>
                          );
                        })
                      )}
                    </ul>
                  </CollapsibleContent>
                </Collapsible>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
