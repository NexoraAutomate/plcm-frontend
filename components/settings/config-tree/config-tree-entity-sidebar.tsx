'use client';

import { useMemo, useState } from 'react';
import { GripVertical } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { filterTemplateNames, type TemplateNameItem } from '@/lib/hierarchy-template-names';
import {
  TEMPLATE_NODE_LEVELS,
  type TemplateNodeLevel,
} from '@/lib/hierarchy-config';
import { cn } from '@/lib/utils';

export const ENTITY_DND_MIME = 'application/plcm-config-entity';

export type EntityDragPayload = {
  level: TemplateNodeLevel;
  name: string;
  abbreviation: string;
  entityId: number;
};

type Props = {
  entities: TemplateNameItem[];
  usedNamesByLevel: Map<TemplateNodeLevel, Set<string>>;
  levelLabel: (level: string) => string;
  disabled?: boolean;
};

export function ConfigTreeEntitySidebar({
  entities,
  usedNamesByLevel,
  levelLabel,
  disabled,
}: Props) {
  const [level, setLevel] = useState<TemplateNodeLevel>('system');
  const [query, setQuery] = useState('');

  const options = useMemo(() => {
    const used = usedNamesByLevel.get(level) ?? new Set();
    const q = query.trim().toLowerCase();
    return filterTemplateNames(entities, level)
      .filter((item) => !used.has(item.name.trim().toLowerCase()))
      .filter((item) => !q || item.name.toLowerCase().includes(q));
  }, [entities, level, query, usedNamesByLevel]);

  return (
    <aside
      className={cn(
        'flex w-64 shrink-0 flex-col border-r bg-background',
        disabled && 'pointer-events-none opacity-50'
      )}
    >
      <div className="space-y-2 border-b p-3">
        <p className="text-sm font-medium">Entity list</p>
        <p className="text-[11px] text-muted-foreground">
          Drag an entity onto the canvas to add a node.
        </p>
        <Select
          value={level}
          onValueChange={(v) => setLevel(v as TemplateNodeLevel)}
        >
          <SelectTrigger className="h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TEMPLATE_NODE_LEVELS.map((l) => (
              <SelectItem key={l} value={l}>
                {levelLabel(l)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          className="h-8"
          placeholder="Filter…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-2 space-y-1">
        {options.length === 0 ? (
          <p className="px-1 py-4 text-xs text-muted-foreground">
            No unused {levelLabel(level)} entities.
          </p>
        ) : (
          options.map((item) => (
            <div
              key={`${item.id}-${item.name}`}
              draggable={!disabled}
              onDragStart={(event) => {
                const payload: EntityDragPayload = {
                  level,
                  name: item.name,
                  abbreviation: (item.abbreviation || '').toUpperCase(),
                  entityId: item.id,
                };
                event.dataTransfer.setData(ENTITY_DND_MIME, JSON.stringify(payload));
                event.dataTransfer.setData('text/plain', item.name);
                event.dataTransfer.effectAllowed = 'copy';
              }}
              className="flex cursor-grab items-center gap-1.5 rounded-md border bg-muted/30 px-2 py-1.5 text-xs active:cursor-grabbing"
            >
              <GripVertical className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <div className="truncate font-medium">{item.name}</div>
                {item.abbreviation ? (
                  <div className="truncate font-mono text-[10px] text-muted-foreground">
                    {item.abbreviation}
                  </div>
                ) : null}
              </div>
            </div>
          ))
        )}
      </div>
    </aside>
  );
}
