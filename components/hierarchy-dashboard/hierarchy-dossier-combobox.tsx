'use client';

import {
  HIERARCHY_DOSSIER_OPTIONS,
  type HierarchyDossierMode,
} from '@/lib/hierarchy-dossier-mode';
import {
  HierarchySearchCombobox,
  type HierarchySearchOption,
} from '@/components/hierarchy-dashboard/hierarchy-search-combobox';

const DOSSIER_OPTIONS: HierarchySearchOption[] = HIERARCHY_DOSSIER_OPTIONS.map(
  (option) => ({
    value: option.value,
    label: option.label,
    description: option.description,
  })
);

const DOSSIER_TRIGGER_STYLES: Record<HierarchyDossierMode, string> = {
  bhd: 'border-transparent bg-sky-50 font-medium text-sky-950 shadow-none hover:bg-sky-100 dark:bg-sky-950/70 dark:text-sky-100 dark:hover:bg-sky-900/70',
  mmhd: 'border-transparent bg-orange-50 font-medium text-orange-950 shadow-none hover:bg-orange-100 dark:bg-orange-950/70 dark:text-orange-100 dark:hover:bg-orange-900/70',
};

const DOSSIER_LABEL_STYLES: Record<HierarchyDossierMode, string> = {
  bhd: 'font-semibold text-sky-800 dark:text-sky-200',
  mmhd: 'font-semibold text-orange-800 dark:text-orange-200',
};

interface HierarchyDossierComboboxProps {
  value: HierarchyDossierMode;
  onChange: (mode: HierarchyDossierMode) => void;
  className?: string;
}

export function HierarchyDossierCombobox({
  value,
  onChange,
  className,
}: HierarchyDossierComboboxProps) {
  return (
    <HierarchySearchCombobox
      label="Dossier View"
      placeholder="Select dossier view"
      value={value}
      options={DOSSIER_OPTIONS}
      onChange={(nextValue) => onChange(nextValue as HierarchyDossierMode)}
      className={className}
      triggerClassName={DOSSIER_TRIGGER_STYLES[value]}
      labelClassName={DOSSIER_LABEL_STYLES[value]}
    />
  );
}
