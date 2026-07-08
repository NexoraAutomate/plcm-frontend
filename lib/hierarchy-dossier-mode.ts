export type HierarchyDossierMode = 'bhd' | 'mmhd';

export const HIERARCHY_DOSSIER_OPTIONS: {
  value: HierarchyDossierMode;
  label: string;
  description: string;
}[] = [
  {
    value: 'bhd',
    label: 'Build History Dossier (BHD)',
    description: 'Original build history of the project',
  },
  {
    value: 'mmhd',
    label: 'Maintenance & Modification History Dossier (MMHD)',
    description: 'Latest replaced entities and maintenance history',
  },
];

export function getHierarchyDossierLabel(mode: HierarchyDossierMode): string {
  return (
    HIERARCHY_DOSSIER_OPTIONS.find((option) => option.value === mode)?.label ?? mode
  );
}
