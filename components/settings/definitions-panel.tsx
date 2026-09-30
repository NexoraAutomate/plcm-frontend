'use client';

import { useAuth } from '@/lib/auth-context';
import { AccessRestricted } from '@/components/auth/access-restricted';
import { P } from '@/lib/permission-codes';
import { HierarchyConfigPanel, HierarchyPanel } from '@/components/lazy/heavy-editors';
import type { DefinitionsSectionId } from '@/components/settings/settings-tabs-config';
import { DefinitionsLabelsSection } from '@/components/settings/definitions-labels-section';

export type DefinitionsPanelProps = {
  section: DefinitionsSectionId;
};

export function DefinitionsPanel({ section }: DefinitionsPanelProps) {
  const { can } = useAuth();
  const canLabels = can([
    P.manage_settings,
    P.edit_inventory,
    P.hierarchy_config_manage,
    P.create_hierarchy,
  ]);
  const canEntityList = can([P.view_hierarchy, P.create_hierarchy, P.manage_settings]);
  const canConfigs = can([P.hierarchy_config_manage, P.view_hierarchy, P.manage_settings]);
  const configsReadOnly = !can(P.hierarchy_config_manage);
  const entityListReadOnly = !can([P.create_hierarchy, P.edit_hierarchy]);

  if (section === 'labels' && !canLabels) {
    return (
      <AccessRestricted
        title="Access Restricted"
        message="You do not have permission to view Labels & Templates."
      />
    );
  }
  if (section === 'entity-list' && !canEntityList) {
    return (
      <AccessRestricted
        title="Access Restricted"
        message="You do not have permission to view Entity List."
      />
    );
  }
  if (section === 'configurations' && !canConfigs) {
    return (
      <AccessRestricted
        title="Access Restricted"
        message="You do not have permission to view Configurations."
      />
    );
  }

  if (section === 'labels') {
    return <DefinitionsLabelsSection />;
  }
  if (section === 'entity-list') {
    return <HierarchyPanel embedded variant="entity-list" readOnly={entityListReadOnly} />;
  }
  return <HierarchyConfigPanel embedded readOnly={configsReadOnly} />;
}
