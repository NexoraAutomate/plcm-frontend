'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

export type PasswordPolicySettings = {
  minLength: number;
  expiryDays: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecial: boolean;
  historyLength: number;
  maxLoginAttempts: number;
  lockoutDurationMinutes: number;
};

export type TwoFactorSettings = {
  enabled: boolean;
  requireForAllUsers: boolean;
  requireForAdminsOnly: boolean;
};

export type SecuritySettingsState = {
  passwordPolicy: PasswordPolicySettings;
  twoFactor: TwoFactorSettings;
};

export type ActiveSession = {
  id: string;
  user: string;
  device: string;
  browser: string;
  operatingSystem: string;
  ipAddress: string;
  loginTime: string;
  lastActivity: string;
  status: 'Active' | 'Idle' | 'Expired';
};

const STORAGE_KEY = 'plcm-security-settings';

export const DEFAULT_SECURITY_SETTINGS: SecuritySettingsState = {
  passwordPolicy: {
    minLength: 8,
    expiryDays: 90,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecial: false,
    historyLength: 5,
    maxLoginAttempts: 5,
    lockoutDurationMinutes: 30,
  },
  twoFactor: {
    enabled: false,
    requireForAllUsers: false,
    requireForAdminsOnly: true,
  },
};

/**
 * Local persistence + hooks for Security settings.
 * Replace the storage layer with API calls when backend endpoints are available.
 */
export function useSecuritySettings() {
  const [settings, setSettings] = useState<SecuritySettingsState>(DEFAULT_SECURITY_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        setSettings({ ...DEFAULT_SECURITY_SETTINGS, ...JSON.parse(raw) });
      }
    } catch {
      // ignore corrupt local state
    } finally {
      setLoading(false);
    }
  }, []);

  const saveSettings = useCallback(async (next: SecuritySettingsState) => {
    setSaving(true);
    try {
      // TODO: POST /api/auth/security-settings when backend is ready
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      setSettings(next);
      toast.success('Security settings saved');
    } catch {
      toast.error('Failed to save security settings');
    } finally {
      setSaving(false);
    }
  }, []);

  const updatePasswordPolicy = useCallback(
    (patch: Partial<PasswordPolicySettings>) => {
      const next = {
        ...settings,
        passwordPolicy: { ...settings.passwordPolicy, ...patch },
      };
      setSettings(next);
      return next;
    },
    [settings]
  );

  const updateTwoFactor = useCallback(
    (patch: Partial<TwoFactorSettings>) => {
      const next = {
        ...settings,
        twoFactor: { ...settings.twoFactor, ...patch },
      };
      setSettings(next);
      return next;
    },
    [settings]
  );

  return {
    settings,
    setSettings,
    loading,
    saving,
    saveSettings,
    updatePasswordPolicy,
    updateTwoFactor,
  };
}

/** Placeholder session list until a sessions API exists. */
export function useActiveSessions() {
  const [sessions, setSessions] = useState<ActiveSession[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      // TODO: GET /api/auth/sessions
      setSessions([
        {
          id: 'current',
          user: 'Current User',
          device: 'This device',
          browser: typeof navigator !== 'undefined' ? navigator.userAgent.split(' ').slice(-1)[0] : 'Browser',
          operatingSystem:
            typeof navigator !== 'undefined' ? navigator.platform || 'Unknown' : 'Unknown',
          ipAddress: '—',
          loginTime: new Date().toISOString(),
          lastActivity: new Date().toISOString(),
          status: 'Active',
        },
      ]);
    } catch {
      toast.error('Failed to load active sessions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const terminateSession = useCallback(async (sessionId: string) => {
    // TODO: DELETE /api/auth/sessions/{id}
    setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    toast.success('Session terminated');
  }, []);

  const terminateAllSessions = useCallback(async () => {
    // TODO: DELETE /api/auth/sessions
    setSessions([]);
    toast.success('All sessions terminated');
  }, []);

  return {
    sessions,
    loading,
    refresh,
    terminateSession,
    terminateAllSessions,
  };
}
