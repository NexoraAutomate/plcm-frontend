'use client';

import { useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { Panel } from '@xyflow/react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  ENTITY_FLOW_FIELD_OPTIONS,
  type EntityFlowFieldKey,
} from '@/lib/entity-lookup-flow';
import { cn } from '@/lib/utils';

interface EntityFlowFieldSlicerProps {
  visibleFields: Set<EntityFlowFieldKey>;
  onToggleField: (field: EntityFlowFieldKey, checked: boolean) => void;
  /** Stable id prefix so inline + fullscreen maps do not clash. */
  idPrefix?: string;
  /** Optional control rendered beside Display Fields (e.g. Create case). */
  besideAction?: ReactNode;
}

export function EntityFlowFieldSlicer({
  visibleFields,
  onToggleField,
  idPrefix = 'field',
  besideAction,
}: EntityFlowFieldSlicerProps) {
  const [open, setOpen] = useState(false);

  return (
    <Panel position="top-right" className="m-3">
      <div className="flex items-start gap-2">
        {besideAction ? <div className="shrink-0">{besideAction}</div> : null}
        <Collapsible
          open={open}
          onOpenChange={setOpen}
          className="w-52 rounded-lg border border-border bg-background/95 shadow-md backdrop-blur-sm"
        >
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left"
            >
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Display Fields
              </span>
              <ChevronDown
                className={cn(
                  'h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform',
                  open && 'rotate-180'
                )}
              />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="border-t border-border px-3 pb-3 pt-2">
            <div className="space-y-2">
              {ENTITY_FLOW_FIELD_OPTIONS.map(({ key, label }) => {
                const inputId = `${idPrefix}-${key}`;
                return (
                  <div key={key} className="flex items-center gap-2">
                    <Checkbox
                      id={inputId}
                      checked={visibleFields.has(key)}
                      onCheckedChange={(checked) => onToggleField(key, checked === true)}
                    />
                    <Label htmlFor={inputId} className="text-xs font-normal">
                      {label}
                    </Label>
                  </div>
                );
              })}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>
    </Panel>
  );
}
