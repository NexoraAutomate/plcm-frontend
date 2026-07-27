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

export const ALERT_SETTINGS_STORAGE_KEY = 'plcm-alert-settings';

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

export function readAlertSettings(): AlertSettingsState {
  if (typeof window === 'undefined') return DEFAULT_ALERT_SETTINGS;
  try {
    const raw = localStorage.getItem(ALERT_SETTINGS_STORAGE_KEY);
    if (!raw) return DEFAULT_ALERT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<AlertSettingsState>;
    return {
      email: { ...DEFAULT_ALERT_SETTINGS.email, ...parsed.email },
      inApp: { ...DEFAULT_ALERT_SETTINGS.inApp, ...parsed.inApp },
      channels: { ...DEFAULT_ALERT_SETTINGS.channels, ...parsed.channels },
    };
  } catch {
    return DEFAULT_ALERT_SETTINGS;
  }
}

/**
 * Notification preferences persisted locally and applied by the in-app feed.
 */
export function useAlertSettings() {
  const [settings, setSettings] = useState<AlertSettingsState>(DEFAULT_ALERT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setSettings(readAlertSettings());
    setLoading(false);
  }, []);

  const saveSettings = useCallback(async (next: AlertSettingsState) => {
    setSaving(true);
    try {
      if (next.inApp.desktop && typeof window !== 'undefined' && 'Notification' in window) {
        if (Notification.permission === 'default') {
          const permission = await Notification.requestPermission();
          if (permission !== 'granted') {
            next = {
              ...next,
              inApp: { ...next.inApp, desktop: false },
            };
            toast.message('Desktop notification permission was not granted');
          }
        } else if (Notification.permission === 'denied') {
          next = {
            ...next,
            inApp: { ...next.inApp, desktop: false },
          };
          toast.message('Desktop notifications are blocked in the browser');
        }
      }

      localStorage.setItem(ALERT_SETTINGS_STORAGE_KEY, JSON.stringify(next));
      setSettings(next);
      window.dispatchEvent(new CustomEvent('plcm-alert-settings-changed', { detail: next }));
      toast.success('Notification settings saved');
    } catch {
      toast.error('Failed to save notification settings');
    } finally {
      setSaving(false);
    }
  }, []);

  return { settings, setSettings, loading, saving, saveSettings };
}
