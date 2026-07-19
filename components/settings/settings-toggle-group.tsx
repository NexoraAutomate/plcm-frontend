'use client';

import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

export type SettingsToggleItem = {
  id: string;
  label: string;
  description?: string;
  checked: boolean;
  disabled?: boolean;
  onCheckedChange: (checked: boolean) => void;
};

interface SettingsToggleGroupProps {
  items: SettingsToggleItem[];
  className?: string;
}

export function SettingsToggleGroup({ items, className }: SettingsToggleGroupProps) {
  return (
    <div className={cn('divide-y divide-border rounded-lg border border-border', className)}>
      {items.map((item) => (
        <div
          key={item.id}
          className="flex items-start justify-between gap-4 px-4 py-3.5"
        >
          <div className="min-w-0 space-y-0.5">
            <Label htmlFor={item.id} className="text-sm font-medium text-foreground">
              {item.label}
            </Label>
            {item.description ? (
              <p className="text-xs text-muted-foreground">{item.description}</p>
            ) : null}
          </div>
          <Switch
            id={item.id}
            checked={item.checked}
            disabled={item.disabled}
            onCheckedChange={item.onCheckedChange}
            aria-label={item.label}
          />
        </div>
      ))}
    </div>
  );
}
