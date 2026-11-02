'use client';

/**
 * Expandable entity tree (MUI Tree View–style UX without adding @mui/x-tree-view).
 * https://mui.com/x/react-tree-view/
 */

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  ChevronDown,
  ChevronRight,
  FileText,
  Folder,
  FolderOpen,
} from 'lucide-react';
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
  /** Hide these levels entirely (e.g. system when one already exists). */
  hiddenLevels?: TemplateNodeLevel[];
  selectedName?: string;
  onSelect?: (item: EntityTreeSelection) => void;
  /**
   * When set, hover reveals a quantity field + arrow that calls this instead of
   * (or in addition to) click-to-select. Used by Add hierarchy node dialog.
   */
  onAddEntity?: (item: EntityTreeSelection, quantity: number) => void;
  maxQuantity?: number;
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
  hiddenLevels,
  selectedName,
  onSelect,
  onAddEntity,
  maxQuantity = 100,
  draggable,
  onDragStart,
  className,
  defaultExpandedLevels,
  emptyHint,
}: Props) {
  const [query, setQuery] = useState('');
  const [hoverQty, setHoverQty] = useState<Record<string, number>>({});
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

  const qtyFor = (key: string) => {
    const raw = hoverQty[key];
    if (raw == null) return 1;
    return raw;
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
                          const rowKey = `${level}-${item.id}-${item.name}`;
                          const canUse = levelInteractive;
                          const canAdd = canUse && !!onAddEntity;
                          const canClick = canUse && !!onSelect && !onAddEntity;
                          const canDrag = !!draggable && canUse;
                          const selected =
                            !onAddEntity &&
                            selectedName === item.name &&
                            (selectableLevel == null || selectableLevel === level);
                          const qty = qtyFor(rowKey);
                          return (
                            <li key={rowKey} role="treeitem">
                              <div
                                role={canClick ? 'button' : undefined}
                                tabIndex={canClick || canDrag || canAdd ? 0 : -1}
                                title={
                                  !canUse
                                    ? 'Select a matching parent on the canvas'
                                    : canAdd
                                      ? 'Set quantity and add to the group'
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
                                  if (canAdd && (event.key === 'Enter' || event.key === ' ')) {
                                    event.preventDefault();
                                    const safeQty = Math.min(
                                      maxQuantity,
                                      Math.max(1, Math.floor(Number(qty) || 1))
                                    );
                                    onAddEntity?.(payload, safeQty);
                                    return;
                                  }
                                  if (!canClick) return;
                                  if (event.key === 'Enter' || event.key === ' ') {
                                    event.preventDefault();
                                    onSelect?.(payload);
                                  }
                                }}
                                className={cn(
                                  'group/row flex w-full items-center gap-2 rounded-full px-2.5 py-1.5 text-left text-xs transition-colors select-none',
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
                                </span>
                                {canAdd ? (
                                  <span
                                    className={cn(
                                      'ml-auto flex shrink-0 items-center gap-1 opacity-0 transition-opacity',
                                      'group-hover/row:opacity-100 focus-within:opacity-100'
                                    )}
                                  >
                                    <Input
                                      type="number"
                                      min={1}
                                      max={maxQuantity}
                                      step={1}
                                      aria-label={`Quantity for ${item.name}`}
                                      className="h-6 w-12 rounded-md px-1.5 text-center text-[11px] tabular-nums"
                                      value={qty}
                                      onClick={(e) => e.stopPropagation()}
                                      onChange={(e) => {
                                        const raw = e.target.value;
                                        setHoverQty((prev) => ({
                                          ...prev,
                                          [rowKey]:
                                            raw === ''
                                              ? 0
                                              : Number.isNaN(Number(raw))
                                                ? 0
                                                : Number(raw),
                                        }));
                                      }}
                                    />
                                    <button
                                      type="button"
                                      title={`Add ${item.name} to group`}
                                      aria-label={`Add ${item.name} to group`}
                                      className="flex size-6 items-center justify-center rounded-md bg-teal-600 text-white transition-colors hover:bg-teal-500 disabled:opacity-40"
                                      disabled={qty < 1 || qty > maxQuantity}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        const safeQty = Math.min(
                                          maxQuantity,
                                          Math.max(1, Math.floor(Number(qty) || 1))
                                        );
                                        onAddEntity?.(payload, safeQty);
                                      }}
                                    >
                                      <ArrowRight className="size-3.5" />
                                    </button>
                                  </span>
                                ) : item.abbreviation ? (
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
