'use client';

import { useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { SettingsCard } from '@/components/settings/settings-card';
import { SettingsSection } from '@/components/settings/settings-section';
import { SettingsToggleGroup } from '@/components/settings/settings-toggle-group';
import { PageLoader } from '@/components/page-loader';
import { Can } from '@/components/auth/can';
import { P } from '@/lib/permission-codes';
import {
  useActiveSessions,
  useSecuritySettings,
} from '@/components/settings/hooks/use-security-settings';
import { usePageDataRefresh } from '@/components/page-data-refresh';

export type SecurityPanelProps = {
  embedded?: boolean;
};

function formatDateTime(value: string) {
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

export function SecurityPanel({ embedded = false }: SecurityPanelProps) {
  const {
    settings,
    loading,
    saving,
    saveSettings,
    updatePasswordPolicy,
    updateTwoFactor,
    reload: reloadSettings,
  } = useSecuritySettings();
  const { sessions, loading: sessionsLoading, refresh: refreshSessions, terminateSession, terminateAllSessions } =
    useActiveSessions();
  const refresh = useCallback(
    () => Promise.all([reloadSettings(), refreshSessions()]).then(() => undefined),
    [reloadSettings, refreshSessions]
  );

  usePageDataRefresh(refresh);

  if (loading) return <PageLoader />;

  const { passwordPolicy, twoFactor } = settings;

  return (
    <div className="space-y-8">
      {!embedded && (
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Security</h1>
          <p className="text-sm text-muted-foreground">
            Configure password policy, multi-factor authentication, and session controls
          </p>
        </div>
      )}

      <SettingsSection
        title="Password Policy"
        description="Define password strength and account lockout rules for all users."
        actions={
          <Button
            size="sm"
            disabled={saving}
            onClick={() => saveSettings(settings)}
          >
            {saving ? 'Saving...' : 'Save Policy'}
          </Button>
        }
      >
        <SettingsCard>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Minimum Password Length</Label>
                <span className="text-sm tabular-nums text-muted-foreground">
                  {passwordPolicy.minLength}
                </span>
              </div>
              <Slider
                min={6}
                max={32}
                step={1}
                value={[passwordPolicy.minLength]}
                onValueChange={([value]) => updatePasswordPolicy({ minLength: value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="expiry-days">Password Expiry (Days)</Label>
              <Input
                id="expiry-days"
                type="number"
                min={0}
                max={365}
                value={passwordPolicy.expiryDays}
                onChange={(e) =>
                  updatePasswordPolicy({ expiryDays: Number(e.target.value) || 0 })
                }
              />
              <p className="text-xs text-muted-foreground">Use 0 for passwords that never expire.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="inactivity-days">Automatically Mark User Inactive After</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="inactivity-days"
                  type="number"
                  min={0}
                  max={3650}
                  className="md:w-32"
                  value={passwordPolicy.inactivityDeactivateDays}
                  onChange={(e) =>
                    updatePasswordPolicy({
                      inactivityDeactivateDays: Number(e.target.value) || 0,
                    })
                  }
                />
                <span className="text-sm text-muted-foreground">Days</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Users with no successful login within this period are deactivated automatically.
                Use 0 to disable automatic deactivation.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="history-length">Password History Length</Label>
              <Input
                id="history-length"
                type="number"
                min={0}
                max={24}
                value={passwordPolicy.historyLength}
                onChange={(e) =>
                  updatePasswordPolicy({ historyLength: Number(e.target.value) || 0 })
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Maximum Login Attempts</Label>
              <Select
                value={String(passwordPolicy.maxLoginAttempts)}
                onValueChange={(value) =>
                  updatePasswordPolicy({ maxLoginAttempts: Number(value) })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[3, 5, 8, 10].map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n} attempts
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>Account Lockout Duration</Label>
              <Select
                value={String(passwordPolicy.lockoutDurationMinutes)}
                onValueChange={(value) =>
                  updatePasswordPolicy({ lockoutDurationMinutes: Number(value) })
                }
              >
                <SelectTrigger className="md:w-64">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="15">15 minutes</SelectItem>
                  <SelectItem value="30">30 minutes</SelectItem>
                  <SelectItem value="60">1 hour</SelectItem>
                  <SelectItem value="1440">24 hours</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="mt-6">
            <SettingsToggleGroup
              items={[
                {
                  id: 'require-upper',
                  label: 'Require Uppercase Letters',
                  description: 'At least one A–Z character',
                  checked: passwordPolicy.requireUppercase,
                  onCheckedChange: (checked) =>
                    updatePasswordPolicy({ requireUppercase: checked }),
                },
                {
                  id: 'require-lower',
                  label: 'Require Lowercase Letters',
                  description: 'At least one a–z character',
                  checked: passwordPolicy.requireLowercase,
                  onCheckedChange: (checked) =>
                    updatePasswordPolicy({ requireLowercase: checked }),
                },
                {
                  id: 'require-numbers',
                  label: 'Require Numbers',
                  description: 'At least one digit (0–9)',
                  checked: passwordPolicy.requireNumbers,
                  onCheckedChange: (checked) =>
                    updatePasswordPolicy({ requireNumbers: checked }),
                },
                {
                  id: 'require-special',
                  label: 'Require Special Characters',
                  description: 'At least one symbol (e.g. !@#$)',
                  checked: passwordPolicy.requireSpecial,
                  onCheckedChange: (checked) =>
                    updatePasswordPolicy({ requireSpecial: checked }),
                },
              ]}
            />
          </div>
        </SettingsCard>
      </SettingsSection>

      <SettingsSection
        title="Two-Factor Authentication"
        description="Strengthen account security with an additional verification step."
        actions={
          <Button size="sm" disabled={saving} onClick={() => saveSettings(settings)}>
            {saving ? 'Saving...' : 'Save 2FA'}
          </Button>
        }
      >
        <SettingsCard>
          <SettingsToggleGroup
            items={[
              {
                id: '2fa-enabled',
                label: 'Enable Two-Factor Authentication',
                description: 'Allow users to enroll in 2FA',
                checked: twoFactor.enabled,
                onCheckedChange: (checked) => updateTwoFactor({ enabled: checked }),
              },
              {
                id: '2fa-all',
                label: 'Require 2FA for All Users',
                description: 'Every account must complete 2FA at login',
                checked: twoFactor.requireForAllUsers,
                disabled: !twoFactor.enabled,
                onCheckedChange: (checked) =>
                  updateTwoFactor({
                    requireForAllUsers: checked,
                    requireForAdminsOnly: checked ? false : twoFactor.requireForAdminsOnly,
                  }),
              },
              {
                id: '2fa-admin',
                label: 'Require 2FA for Administrators Only',
                description: 'Enforce 2FA for Admin role accounts',
                checked: twoFactor.requireForAdminsOnly,
                disabled: !twoFactor.enabled || twoFactor.requireForAllUsers,
                onCheckedChange: (checked) =>
                  updateTwoFactor({ requireForAdminsOnly: checked }),
              },
            ]}
          />
        </SettingsCard>
      </SettingsSection>

      <SettingsSection
        title="Active Sessions"
        description="Review and terminate active login sessions across devices."
        actions={
          <Can permission={P.manage_settings}>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => terminateAllSessions()}
              disabled={sessions.length === 0}
            >
              Terminate All Sessions
            </Button>
          </Can>
        }
      >
        <SettingsCard>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Device</TableHead>
                  <TableHead>Browser</TableHead>
                  <TableHead>Operating System</TableHead>
                  <TableHead>IP Address</TableHead>
                  <TableHead>Login Time</TableHead>
                  <TableHead>Last Activity</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sessionsLoading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="py-8 text-center text-muted-foreground">
                      Loading sessions…
                    </TableCell>
                  </TableRow>
                ) : sessions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="py-8 text-center text-muted-foreground">
                      No active sessions
                    </TableCell>
                  </TableRow>
                ) : (
                  sessions.map((session) => (
                    <TableRow key={session.id}>
                      <TableCell className="font-medium">{session.user}</TableCell>
                      <TableCell>{session.device}</TableCell>
                      <TableCell>{session.browser}</TableCell>
                      <TableCell>{session.operatingSystem}</TableCell>
                      <TableCell className="font-mono text-sm">{session.ipAddress}</TableCell>
                      <TableCell>{formatDateTime(session.loginTime)}</TableCell>
                      <TableCell>{formatDateTime(session.lastActivity)}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap items-center gap-1">
                          <Badge variant={session.status === 'Active' ? 'default' : 'secondary'}>
                            {session.status}
                          </Badge>
                          {session.isCurrent ? (
                            <Badge variant="outline">This device</Badge>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={session.isCurrent}
                          onClick={() => terminateSession(session.id)}
                        >
                          Terminate
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Terminating a session immediately invalidates that device&apos;s access token. Your
            current session is kept when using Terminate All.
          </p>
        </SettingsCard>
      </SettingsSection>
    </div>
  );
}
