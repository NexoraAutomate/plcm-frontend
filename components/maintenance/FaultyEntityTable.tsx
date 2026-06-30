'use client';

import React from 'react';
import { Check, Eye, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { FaultyEntity } from '@/lib/models';
import { FaultyEntityTreeList } from '@/components/maintenance/faulty-entity-tree-list';

interface FaultyEntityTableProps {
  entities: FaultyEntity[];
  onView?: (entity: FaultyEntity) => void;
  onResolve?: (entity: FaultyEntity) => void;
  onDelete?: (entity: FaultyEntity) => void;
  isLoading?: boolean;
}

export function FaultyEntityTable({
  entities,
  onView,
  onResolve,
  onDelete,
  isLoading = false,
}: FaultyEntityTableProps) {
  if (isLoading) {
    return (
      <div className="text-sm text-muted-foreground py-4">
        Loading faulty entities...
      </div>
    );
  }

  if (!entities || entities.length === 0) {
    return (
      <div className="text-sm text-muted-foreground py-4">
        No faulty entities found.
      </div>
    );
  }

  return (
    <FaultyEntityTreeList
      entities={entities}
      emptyMessage="No faulty entities found."
      renderActions={(entity) => (
        <>
          {onView ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onView(entity)}
              className="h-8 w-8 p-0"
            >
              <Eye className="h-4 w-4" />
            </Button>
          ) : null}
          {onResolve && entity.status !== 'resolved' ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onResolve(entity)}
              className="h-8 w-8 p-0"
            >
              <Check className="h-4 w-4" />
            </Button>
          ) : null}
          {onDelete ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDelete(entity)}
              className="h-8 w-8 p-0 text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          ) : null}
        </>
      )}
    />
  );
}
