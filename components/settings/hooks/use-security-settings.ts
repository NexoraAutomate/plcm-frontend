'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import * as api from '@/lib/api';
import type { SecuritySettings as ApiSecuritySettings, ActiveSession as ApiSession } from '@/lib/models';

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
  isCurrent?: boolean;
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

function mapSession(row: ApiSession): ActiveSession {
  return {
    id: row.session_id,
    user: row.username,
    device: row.device_name || '—',
    browser: row.browser || '—',
    operatingSystem: row.operating_system || '—',
    ipAddress: row.ip_address || '—',
    loginTime: row.login_time,
    lastActivity: row.last_activity || row.login_time,
    status: 'Active',
    isCurrent: row.is_current,
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

export function useActiveSessions() {
  const [sessions, setSessions] = useState<ActiveSession[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.auth.listSessions(0, 100);
      setSessions((res.data ?? []).map(mapSession));
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
    async (sessionId: string) => {
      try {
        await api.auth.terminateSession(sessionId);
        toast.success('Session terminated');
        await refresh();
      } catch {
        toast.error('Failed to terminate session');
      }
    },
    [refresh]
  );

  const terminateAllSessions = useCallback(async () => {
    try {
      const res = await api.auth.terminateAllSessions(true);
      toast.success(res.data?.message || 'Sessions terminated');
      await refresh();
    } catch {
      toast.error('Failed to terminate sessions');
    }
  }, [refresh]);

  return {
    sessions,
    loading,
    refresh,
    terminateSession,
    terminateAllSessions,
  };
}
