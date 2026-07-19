'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import * as api from '@/lib/api';
import type { SecuritySettings as ApiSecuritySettings } from '@/lib/models';

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
  inactivityDeactivateDays: number;
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
    inactivityDeactivateDays: 90,
  },
  twoFactor: {
    enabled: false,
    requireForAllUsers: false,
    requireForAdminsOnly: true,
  },
};

function fromApi(data: ApiSecuritySettings): SecuritySettingsState {
  return {
    passwordPolicy: {
      minLength: data.min_password_length,
      expiryDays: data.password_expiry_days,
      requireUppercase: data.require_uppercase,
      requireLowercase: data.require_lowercase,
      requireNumbers: data.require_numbers,
      requireSpecial: data.require_special,
      historyLength: data.password_history_length,
      maxLoginAttempts: data.max_login_attempts,
      lockoutDurationMinutes: data.lockout_duration_minutes,
      inactivityDeactivateDays: data.inactivity_deactivate_days,
    },
    twoFactor: {
      enabled: data.two_factor_enabled,
      requireForAllUsers: data.two_factor_require_all,
      requireForAdminsOnly: data.two_factor_require_admins_only,
    },
  };
}

function toApi(settings: SecuritySettingsState): Partial<ApiSecuritySettings> {
  return {
    min_password_length: settings.passwordPolicy.minLength,
    password_expiry_days: settings.passwordPolicy.expiryDays,
    require_uppercase: settings.passwordPolicy.requireUppercase,
    require_lowercase: settings.passwordPolicy.requireLowercase,
    require_numbers: settings.passwordPolicy.requireNumbers,
    require_special: settings.passwordPolicy.requireSpecial,
    password_history_length: settings.passwordPolicy.historyLength,
    max_login_attempts: settings.passwordPolicy.maxLoginAttempts,
    lockout_duration_minutes: settings.passwordPolicy.lockoutDurationMinutes,
    inactivity_deactivate_days: settings.passwordPolicy.inactivityDeactivateDays,
    two_factor_enabled: settings.twoFactor.enabled,
    two_factor_require_all: settings.twoFactor.requireForAllUsers,
    two_factor_require_admins_only: settings.twoFactor.requireForAdminsOnly,
  };
}

export function useSecuritySettings() {
  const [settings, setSettings] = useState<SecuritySettingsState>(DEFAULT_SECURITY_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.auth.getSecuritySettings();
        if (!cancelled) setSettings(fromApi(res.data));
      } catch {
        // Fall back to defaults when the caller lacks manage_settings or API is unavailable
        if (!cancelled) setSettings(DEFAULT_SECURITY_SETTINGS);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const saveSettings = useCallback(async (next: SecuritySettingsState) => {
    setSaving(true);
    try {
      const res = await api.auth.updateSecuritySettings(toApi(next));
      setSettings(fromApi(res.data));
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

/** Active sessions derived from open login-history rows when available. */
export function useActiveSessions() {
  const [sessions, setSessions] = useState<ActiveSession[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.auth.listLoginHistory(0, 50, {
        login_status: 'Success',
        sort_by: 'login_time',
        sort_order: 'desc',
      });
      const open = (res.data ?? []).filter((row) => !row.logout_time);
      setSessions(
        open.map((row) => ({
          id: row.session_id || String(row.id),
          user: row.username,
          device: row.device_name || '—',
          browser: row.browser || '—',
          operatingSystem: row.operating_system || '—',
          ipAddress: row.ip_address || '—',
          loginTime: row.login_time,
          lastActivity: row.last_activity || row.login_time,
          status: 'Active',
        }))
      );
    } catch {
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const terminateSession = useCallback(
    async (_sessionId: string) => {
      toast.message('Session termination requires a dedicated sessions API.');
      await refresh();
    },
    [refresh]
  );

  const terminateAllSessions = useCallback(async () => {
    toast.message('Terminate-all requires a dedicated sessions API.');
    await refresh();
  }, [refresh]);

  return {
    sessions,
    loading,
    refresh,
    terminateSession,
    terminateAllSessions,
  };
}
