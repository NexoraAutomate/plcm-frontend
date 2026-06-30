'use client';

import { Panel } from '@xyflow/react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  ENTITY_FLOW_FIELD_OPTIONS,
  type EntityFlowFieldKey,
} from '@/lib/entity-lookup-flow';

interface EntityFlowFieldSlicerProps {
  visibleFields: Set<EntityFlowFieldKey>;
  onToggleField: (field: EntityFlowFieldKey, checked: boolean) => void;
}

export function EntityFlowFieldSlicer({
  visibleFields,
  onToggleField,
}: EntityFlowFieldSlicerProps) {
  return (
    <Panel position="top-right" className="m-3">
      <div className="w-52 rounded-lg border border-border bg-background/95 p-3 shadow-md backdrop-blur-sm">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Display Fields
        </p>
        <div className="space-y-2">
          {ENTITY_FLOW_FIELD_OPTIONS.map(({ key, label }) => (
            <div key={key} className="flex items-center gap-2">
              <Checkbox
                id={`field-${key}`}
                checked={visibleFields.has(key)}
                onCheckedChange={(checked) => onToggleField(key, checked === true)}
              />
              <Label htmlFor={`field-${key}`} className="text-xs font-normal">
                {label}
              </Label>
            </div>
          ))}
        </div>
      </div>
    </Panel>
  );
}
