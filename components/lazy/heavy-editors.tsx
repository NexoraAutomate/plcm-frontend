'use client';

import dynamic from 'next/dynamic';
import { PageLoader } from '@/components/page-loader';

function FlowLoader() {
  return (
    <div className="flex min-h-[20rem] flex-1 items-center justify-center rounded-lg border border-dashed border-border/60 bg-muted/20">
      <PageLoader />
    </div>
  );
}

export const ProjectHierarchyFlow = dynamic(
  () =>
    import('@/components/hierarchy-dashboard/project-hierarchy-flow').then((m) => ({
      default: m.ProjectHierarchyFlow,
    })),
  { ssr: false, loading: FlowLoader }
);

export const SystemHierarchyFlow = dynamic(
  () =>
    import('@/components/system-hierarchy-flow').then((m) => ({
      default: m.SystemHierarchyFlow,
    })),
  { ssr: false, loading: FlowLoader }
);

export const InventoryHierarchyDialog = dynamic(
  () =>
    import('@/components/inventory-hierarchy-dialog').then((m) => ({
      default: m.InventoryHierarchyDialog,
    })),
  { ssr: false }
);

export const MaintenanceLookupDialog = dynamic(
  () =>
    import('@/components/maintenance/MaintenanceLookupDialog').then((m) => ({
      default: m.MaintenanceLookupDialog,
    })),
  { ssr: false }
);

export const LocationTreeEditor = dynamic(
  () =>
    import('@/components/settings/location-tree-editor').then((m) => ({
      default: m.LocationTreeEditor,
    })),
  { ssr: false, loading: FlowLoader }
);

export const HierarchyConfigPanel = dynamic(
  () =>
    import('@/components/settings/hierarchy-config-panel').then((m) => ({
      default: m.HierarchyConfigPanel,
    })),
  { ssr: false, loading: FlowLoader }
);

export const HierarchyPanel = dynamic(
  () =>
    import('@/components/settings/hierarchy-panel').then((m) => ({
      default: m.HierarchyPanel,
    })),
  { ssr: false, loading: FlowLoader }
);
