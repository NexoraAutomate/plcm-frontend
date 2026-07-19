'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

export type EmailNotificationSettings = {
  projectApproval: boolean;
  taskAssignment: boolean;
  maintenanceAlerts: boolean;
  inventoryAlerts: boolean;
  milestoneCompletion: boolean;
  weeklyBugDigest: boolean;
  dailySummary: boolean;
};

export type InAppNotificationSettings = {
  enabled: boolean;
  desktop: boolean;
  sound: boolean;
};

export type FutureChannelSettings = {
  whatsapp: boolean;
  push: boolean;
};

export type AlertSettingsState = {
  email: EmailNotificationSettings;
  inApp: InAppNotificationSettings;
  channels: FutureChannelSettings;
};

const STORAGE_KEY = 'plcm-alert-settings';

export const DEFAULT_ALERT_SETTINGS: AlertSettingsState = {
  email: {
    projectApproval: true,
    taskAssignment: true,
    maintenanceAlerts: true,
    inventoryAlerts: true,
    milestoneCompletion: true,
    weeklyBugDigest: false,
    dailySummary: false,
  },
  inApp: {
    enabled: true,
    desktop: false,
    sound: false,
  },
  channels: {
    whatsapp: false,
    push: false,
  },
};

/**
 * Local persistence for notification preferences.
 * Swap to API integration when notification-settings endpoints are available.
 */
export function useAlertSettings() {
  const [settings, setSettings] = useState<AlertSettingsState>(DEFAULT_ALERT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        setSettings({ ...DEFAULT_ALERT_SETTINGS, ...JSON.parse(raw) });
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  const saveSettings = useCallback(async (next: AlertSettingsState) => {
    setSaving(true);
    try {
      // TODO: PUT /api/notifications/settings
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      setSettings(next);
      toast.success('Notification settings saved');
    } catch {
      toast.error('Failed to save notification settings');
    } finally {
      setSaving(false);
    }
  }, []);

  return { settings, setSettings, loading, saving, saveSettings };
}
