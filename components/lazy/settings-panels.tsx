'use client';

import dynamic from 'next/dynamic';
import { PageLoader } from '@/components/page-loader';

function PanelLoader() {
  return (
    <div className="flex min-h-[12rem] items-center justify-center py-10">
      <PageLoader />
    </div>
  );
}

export const UsersPanel = dynamic(
  () => import('@/components/settings/users-panel').then((m) => ({ default: m.UsersPanel })),
  { ssr: false, loading: PanelLoader }
);

export const RolesPanel = dynamic(
  () => import('@/components/settings/roles-panel').then((m) => ({ default: m.RolesPanel })),
  { ssr: false, loading: PanelLoader }
);

export const RoleAccessPanel = dynamic(
  () =>
    import('@/components/settings/role-access-panel').then((m) => ({
      default: m.RoleAccessPanel,
    })),
  { ssr: false, loading: PanelLoader }
);

export const StatusesPanel = dynamic(
  () =>
    import('@/components/settings/statuses-panel').then((m) => ({ default: m.StatusesPanel })),
  { ssr: false, loading: PanelLoader }
);

export const AlertsPanel = dynamic(
  () => import('@/components/settings/alerts-panel').then((m) => ({ default: m.AlertsPanel })),
  { ssr: false, loading: PanelLoader }
);

export const SecurityPanel = dynamic(
  () =>
    import('@/components/settings/security-panel').then((m) => ({ default: m.SecurityPanel })),
  { ssr: false, loading: PanelLoader }
);

export const DefinitionsPanel = dynamic(
  () =>
    import('@/components/settings/definitions-panel').then((m) => ({
      default: m.DefinitionsPanel,
    })),
  { ssr: false, loading: PanelLoader }
);

export const BackupPanel = dynamic(
  () => import('@/components/settings/backup-panel').then((m) => ({ default: m.BackupPanel })),
  { ssr: false, loading: PanelLoader }
);
