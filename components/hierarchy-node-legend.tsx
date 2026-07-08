'use client';

import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import type { HierarchyNodeFieldVisibility } from '@/lib/system-hierarchy-graph';
import type { HierarchyDossierMode } from '@/lib/hierarchy-dossier-mode';

const LEGEND_FIELDS: {
  key: keyof HierarchyNodeFieldVisibility;
  label: string;
  mmhdOnly?: boolean;
}[] = [
  { key: 'status', label: 'Status' },
  { key: 'serialNumber', label: 'Serial Number' },
  { key: 'partNumber', label: 'Part Number' },
  { key: 'createdAt', label: 'Created Date' },
  { key: 'description', label: 'Description' },
  { key: 'replacementDate', label: 'Replacement Date', mmhdOnly: true },
];

interface HierarchyNodeLegendProps {
  visibility: HierarchyNodeFieldVisibility;
  onChange: (visibility: HierarchyNodeFieldVisibility) => void;
  className?: string;
  dossierMode?: HierarchyDossierMode;
}

export function HierarchyNodeLegend({
  visibility,
  onChange,
  className,
  dossierMode = 'bhd',
}: HierarchyNodeLegendProps) {
  const toggleField = (key: keyof HierarchyNodeFieldVisibility, checked: boolean) => {
    onChange({ ...visibility, [key]: checked });
  };

  const visibleFields = LEGEND_FIELDS.filter(
    (field) => !field.mmhdOnly || dossierMode === 'mmhd'
  );

  return (
    <div
      className={cn(
        'nodrag nopan absolute top-3 right-3 z-10 w-52 rounded-lg border bg-background/95 p-3 shadow-md backdrop-blur-sm',
        className
      )}
    >
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Node fields
      </p>
      <div className="space-y-2">
        {visibleFields.map((field) => (
          <div key={field.key} className="flex items-center gap-2">
            <Checkbox
              id={`hierarchy-field-${field.key}`}
              checked={visibility[field.key]}
              onCheckedChange={(checked) => toggleField(field.key, checked === true)}
            />
            <Label
              htmlFor={`hierarchy-field-${field.key}`}
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

function formatNodeDate(value?: string) {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString();
}

export function HierarchyNodeFieldLines({
  data,
}: {
  data: {
    status?: string;
    serialNumber?: string;
    partNumber?: string;
    configurationItem?: string;
    createdAt?: string;
    replacementDate?: string;
    description?: string;
    type?: string;
    dossierMode?: 'bhd' | 'mmhd';
    isReplacedEntity?: boolean;
    fieldVisibility?: HierarchyNodeFieldVisibility;
  };
}) {
  const visibility = data.fieldVisibility ?? {
    status: true,
    serialNumber: true,
    partNumber: false,
    createdAt: false,
    description: false,
    replacementDate: false,
  };

  const lines: { label: string; value: string }[] = [];

  if (visibility.serialNumber && data.serialNumber?.trim()) {
    lines.push({
      label: data.dossierMode === 'bhd' ? 'Orig S/N' : 'S/N',
      value: data.serialNumber,
    });
  }
  if (visibility.partNumber && data.partNumber?.trim()) {
    lines.push({
      label: data.dossierMode === 'bhd' ? 'Orig P/N' : 'P/N',
      value: data.partNumber,
    });
  }
  if (data.dossierMode === 'bhd' && data.configurationItem?.trim()) {
    lines.push({ label: 'Config', value: data.configurationItem });
  }
  if (visibility.status && data.status?.trim()) {
    lines.push({ label: 'Status', value: data.status });
  }
  if (visibility.createdAt && data.createdAt) {
    const formatted = formatNodeDate(data.createdAt);
    if (formatted) lines.push({ label: 'Created', value: formatted });
  }
  if (data.dossierMode === 'mmhd' && visibility.replacementDate && data.replacementDate) {
    const formatted = formatNodeDate(data.replacementDate);
    if (formatted) lines.push({ label: 'Replaced', value: formatted });
  }
  if (visibility.description && data.description?.trim()) {
    lines.push({ label: 'Desc', value: data.description });
  }

  if (lines.length === 0) return null;

  return (
    <div className="mt-1.5 space-y-0.5 border-t border-border/50 pt-1.5">
      {lines.map((line) => (
        <p key={line.label} className="truncate text-[10px] text-muted-foreground">
          <span className="font-medium text-foreground/70">{line.label}:</span> {line.value}
        </p>
      ))}
    </div>
  );
}
