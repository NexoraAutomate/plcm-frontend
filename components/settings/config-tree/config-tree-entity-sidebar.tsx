'use client';

import { ConfigEntityTypeTree } from '@/components/settings/config-tree/config-entity-type-tree';
import type { TemplateNameItem } from '@/lib/hierarchy-template-names';
import type { TemplateNodeLevel } from '@/lib/hierarchy-config';
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
  levelLabel: (level: string) => string;
  disabled?: boolean;
  /** Child level to enable when a canvas parent is selected. */
  focusChildLevel?: TemplateNodeLevel | null;
  /** Assigned names already used under the selected parent. */
  usedChildNames?: Set<string>;
  /** Hide system folder when a system already exists. */
  hideSystemLevel?: boolean;
  contextLabel?: string;
};

export function ConfigTreeEntitySidebar({
  entities,
  levelLabel,
  disabled,
  focusChildLevel = null,
  usedChildNames,
  hideSystemLevel,
  contextLabel,
}: Props) {
  const hiddenLevels = hideSystemLevel ? (['system'] as TemplateNodeLevel[]) : undefined;

  return (
    <aside
      className={cn(
        'flex w-72 shrink-0 flex-col border-r bg-background',
        disabled && 'pointer-events-none opacity-50'
      )}
    >
      <div className="space-y-1 border-b p-3">
        <p className="text-sm font-medium">Entity list</p>
        <p className="text-[11px] text-muted-foreground">
          {contextLabel ||
            'Select a node on the canvas to list remaining children, then drag one in.'}
        </p>
      </div>
      <div className="min-h-0 flex-1 p-2">
        {!focusChildLevel ? (
          <div className="rounded-2xl border bg-muted/20 p-4 text-sm text-muted-foreground">
            {contextLabel ||
              (hideSystemLevel
                ? 'Select a System, Subsystem, Module, or Unit on the canvas to see remaining children you can add.'
                : 'Drag a System onto the canvas to start.')}
          </div>
        ) : (
          <ConfigEntityTypeTree
            className="h-full"
            entities={entities}
            levelLabel={levelLabel}
            selectableLevel={focusChildLevel}
            usedNames={usedChildNames}
            hiddenLevels={hiddenLevels}
            draggable
            defaultExpandedLevels={[focusChildLevel]}
            emptyHint={
              focusChildLevel === 'system'
                ? 'Add a System first.'
                : 'No remaining entities for this parent.'
            }
            onDragStart={(event, item) => {
              const payload: EntityDragPayload = {
                level: item.level,
                name: item.name,
                abbreviation: item.abbreviation,
                entityId: item.entityId,
              };
              const json = JSON.stringify(payload);
              event.dataTransfer.setData(ENTITY_DND_MIME, json);
              event.dataTransfer.setData('application/json', json);
              event.dataTransfer.setData('text/plain', item.name);
              event.dataTransfer.effectAllowed = 'copy';
            }}
          />
        )}
      </div>
    </aside>
  );
}
