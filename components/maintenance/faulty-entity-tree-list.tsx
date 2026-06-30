'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { FaultyEntity, MaintenanceAction } from '@/lib/models';
import { buildInvestigationTree, type InvestigationTreeNode } from '@/lib/maintenance-tree';
import { FaultyEntityStatusBadge } from '@/components/maintenance/badges';

interface FaultyEntityTreeListProps {
  entities: FaultyEntity[];
  actions?: MaintenanceAction[];
  renderActions?: (entity: FaultyEntity) => ReactNode;
  renderLeading?: (entity: FaultyEntity) => ReactNode;
  emptyMessage?: string;
}

function entityById(entities: FaultyEntity[]) {
  return new Map(entities.map((entity) => [entity.id, entity]));
}

function TreeRow({
  node,
  entityMap,
  entities,
  actions,
  depth = 0,
  renderActions,
  renderLeading,
}: {
  node: InvestigationTreeNode;
  entityMap: Map<number, FaultyEntity>;
  entities: FaultyEntity[];
  actions: MaintenanceAction[];
  depth?: number;
  renderActions?: (entity: FaultyEntity) => ReactNode;
  renderLeading?: (entity: FaultyEntity) => ReactNode;
}) {
  const entity = entityMap.get(node.id);
  const hasChildren = node.children.length > 0;
  const [open, setOpen] = useState(depth < 1);

  if (!entity) return null;

  return (
    <div className="space-y-1">
      <div
        className="flex items-center gap-2 rounded-lg border border-border bg-background p-2 hover:bg-muted/40"
        style={{ marginLeft: depth * 20 }}
      >
        {hasChildren ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0"
            onClick={() => setOpen((current) => !current)}
          >
            {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </Button>
        ) : (
          <span className="inline-block h-7 w-7 shrink-0" />
        )}

        {renderLeading ? renderLeading(entity) : null}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-medium">{node.display_name}</p>
            <FaultyEntityStatusBadge
              entity={entity}
              allEntities={entities}
              actions={actions}
            />
            {entity.fault_type ? (
              <span className="text-xs text-muted-foreground capitalize">{entity.fault_type}</span>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground">
            {entity.entity_type} · Part: {entity.part_number || '—'} · Serial:{' '}
            {entity.serial_number || '—'}
          </p>
        </div>

        {renderActions ? (
          <div className="flex shrink-0 items-center gap-1">{renderActions(entity)}</div>
        ) : null}
      </div>

      {hasChildren && open
        ? node.children.map((child) => (
            <TreeRow
              key={child.id}
              node={child}
              entityMap={entityMap}
              entities={entities}
              actions={actions}
              depth={depth + 1}
              renderActions={renderActions}
              renderLeading={renderLeading}
            />
          ))
        : null}
    </div>
  );
}

export function FaultyEntityTreeList({
  entities,
  actions = [],
  renderActions,
  renderLeading,
  emptyMessage = 'No entities found.',
}: FaultyEntityTreeListProps) {
  const treeNodes = useMemo(() => buildInvestigationTree(entities), [entities]);
  const entityMap = useMemo(() => entityById(entities), [entities]);

  if (!entities.length) {
    return <p className="py-4 text-sm text-muted-foreground">{emptyMessage}</p>;
  }

  return (
    <div className="space-y-2">
      {treeNodes.map((node) => (
        <TreeRow
          key={node.id}
          node={node}
          entityMap={entityMap}
          entities={entities}
          actions={actions}
          renderActions={renderActions}
          renderLeading={renderLeading}
        />
      ))}
    </div>
  );
}
