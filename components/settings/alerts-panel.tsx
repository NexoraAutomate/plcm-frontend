'use client';

import { Button } from '@/components/ui/button';
import { SettingsCard } from '@/components/settings/settings-card';
import { SettingsSection } from '@/components/settings/settings-section';
import { SettingsToggleGroup } from '@/components/settings/settings-toggle-group';
import { PageLoader } from '@/components/page-loader';
import { useAlertSettings } from '@/components/settings/hooks/use-alert-settings';

export type AlertsPanelProps = {
  embedded?: boolean;
};

export function AlertsPanel({ embedded = false }: AlertsPanelProps) {
  const { settings, setSettings, loading, saving, saveSettings } = useAlertSettings();

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-8">
      {!embedded && (
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Alerts</h1>
          <p className="mt-2 text-muted-foreground">
            Configure email, in-app, and future notification channels
          </p>
        </div>
      )}

      <div className="flex justify-end">
        <Button disabled={saving} onClick={() => saveSettings(settings)}>
          {saving ? 'Saving...' : 'Save Notification Settings'}
        </Button>
      </div>

      <SettingsSection
        title="Email Notifications"
        description="Choose which operational events generate email alerts."
      >
        <SettingsCard>
          <SettingsToggleGroup
            items={[
              {
                id: 'email-project-approval',
                label: 'Project Approval Notifications',
                checked: settings.email.projectApproval,
                onCheckedChange: (checked) =>
                  setSettings({
                    ...settings,
                    email: { ...settings.email, projectApproval: checked },
                  }),
              },
              {
                id: 'email-task-assignment',
                label: 'Task Assignment Notifications',
                checked: settings.email.taskAssignment,
                onCheckedChange: (checked) =>
                  setSettings({
                    ...settings,
                    email: { ...settings.email, taskAssignment: checked },
                  }),
              },
              {
                id: 'email-maintenance',
                label: 'Maintenance Alerts',
                checked: settings.email.maintenanceAlerts,
                onCheckedChange: (checked) =>
                  setSettings({
                    ...settings,
                    email: { ...settings.email, maintenanceAlerts: checked },
                  }),
              },
              {
                id: 'email-inventory',
                label: 'Inventory Alerts',
                checked: settings.email.inventoryAlerts,
                onCheckedChange: (checked) =>
                  setSettings({
                    ...settings,
                    email: { ...settings.email, inventoryAlerts: checked },
                  }),
              },
              {
                id: 'email-milestone',
                label: 'Milestone Completion Notifications',
                checked: settings.email.milestoneCompletion,
                onCheckedChange: (checked) =>
                  setSettings({
                    ...settings,
                    email: { ...settings.email, milestoneCompletion: checked },
                  }),
              },
              {
                id: 'email-weekly-bug',
                label: 'Weekly Bug Digest',
                checked: settings.email.weeklyBugDigest,
                onCheckedChange: (checked) =>
                  setSettings({
                    ...settings,
                    email: { ...settings.email, weeklyBugDigest: checked },
                  }),
              },
              {
                id: 'email-daily-summary',
                label: 'Daily Summary Email',
                checked: settings.email.dailySummary,
                onCheckedChange: (checked) =>
                  setSettings({
                    ...settings,
                    email: { ...settings.email, dailySummary: checked },
                  }),
              },
            ]}
          />
        </SettingsCard>
      </SettingsSection>

      <SettingsSection
        title="In-App Notifications"
        description="Control how alerts appear inside the application."
      >
        <SettingsCard>
          <SettingsToggleGroup
            items={[
              {
                id: 'inapp-enabled',
                label: 'Enable In-App Notifications',
                checked: settings.inApp.enabled,
                onCheckedChange: (checked) =>
                  setSettings({
                    ...settings,
                    inApp: { ...settings.inApp, enabled: checked },
                  }),
              },
              {
                id: 'inapp-desktop',
                label: 'Enable Desktop Notifications',
                description: 'Request browser permission for desktop alerts',
                checked: settings.inApp.desktop,
                disabled: !settings.inApp.enabled,
                onCheckedChange: (checked) =>
                  setSettings({
                    ...settings,
                    inApp: { ...settings.inApp, desktop: checked },
                  }),
              },
              {
                id: 'inapp-sound',
                label: 'Enable Sound Notifications',
                checked: settings.inApp.sound,
                disabled: !settings.inApp.enabled,
                onCheckedChange: (checked) =>
                  setSettings({
                    ...settings,
                    inApp: { ...settings.inApp, sound: checked },
                  }),
              },
            ]}
          />
        </SettingsCard>
      </SettingsSection>

    </div>
  );
}
