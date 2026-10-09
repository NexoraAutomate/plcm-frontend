'use client';

import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import {
  CONFIG_TREE_NODE_FIELD_OPTIONS,
  type ConfigTreeNodeFieldVisibility,
} from '@/lib/config-tree-node-fields';

interface ConfigTreeNodeLegendProps {
  visibility: ConfigTreeNodeFieldVisibility;
  onChange: (visibility: ConfigTreeNodeFieldVisibility) => void;
  className?: string;
}

/** Floating panel to choose which detail fields appear on config tree nodes. */
export function ConfigTreeNodeLegend({
  visibility,
  onChange,
  className,
}: ConfigTreeNodeLegendProps) {
  const toggleField = (
    key: keyof ConfigTreeNodeFieldVisibility,
    checked: boolean
  ) => {
    onChange({ ...visibility, [key]: checked });
  };

  return (
    <div
      className={cn(
        'nodrag nopan absolute top-3 right-3 z-20 w-52 rounded-lg border bg-background/95 p-3 shadow-md backdrop-blur-sm',
        className
      )}
    >
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Node fields
      </p>
      <div className="space-y-2">
        {CONFIG_TREE_NODE_FIELD_OPTIONS.map((field) => (
          <div key={field.key} className="flex items-center gap-2">
            <Checkbox
              id={`config-tree-field-${field.key}`}
              checked={visibility[field.key]}
              onCheckedChange={(checked) =>
                toggleField(field.key, checked === true)
              }
            />
            <Label
              htmlFor={`config-tree-field-${field.key}`}
              className="cursor-pointer text-xs font-normal"
            >
              {field.label}
            </Label>
          </div>
        ))}
      </div>
    </div>
  );
}
