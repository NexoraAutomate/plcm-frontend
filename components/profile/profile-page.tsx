'use client';

import type { ReactNode } from 'react';
import { useAuth } from '@/lib/auth-context';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { SettingsCard } from '@/components/settings/settings-card';
import { UserStatusBadge } from '@/components/settings/user-status-badge';
import { formatRoleNames } from '@/lib/user-display';

function formatDateTime(value?: string | null) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-right text-sm font-medium text-foreground">{value}</span>
    </div>
  );
}

function userInitials(fullName?: string | null) {
  if (!fullName?.trim()) return 'U';
  return (
    fullName
      .split(/\s+/)
      .filter(Boolean)
      .map((n) => n[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'U'
  );
}

export function ProfilePage() {
  const { user } = useAuth();

  if (!user) {
    return (
      <div className="mx-auto max-w-2xl">
        <p className="text-sm text-muted-foreground">Loading profile…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Profile</h1>
        <p className="text-sm text-muted-foreground">Your account details</p>
      </div>

      <div className="flex items-center gap-4 rounded-xl border bg-card p-5">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary text-lg font-bold text-primary-foreground">
          {userInitials(user.full_name)}
        </div>
        <div className="min-w-0 space-y-1.5">
          <p className="truncate text-lg font-semibold leading-none">{user.full_name || user.username}</p>
          <p className="truncate text-sm text-muted-foreground">{user.email || 'No email'}</p>
          <div className="flex flex-wrap items-center gap-2">
            <UserStatusBadge isActive={user.is_active} />
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
              {formatRoleNames(user.roles)}
            </Badge>
          </div>
        </div>
      </div>

      <SettingsCard title="Account Information" description="Details associated with your login">
        <InfoRow label="Username" value={user.username} />
        <InfoRow label="Full Name" value={user.full_name || '—'} />
        <InfoRow label="Email" value={user.email || '—'} />
        <InfoRow label="Roles" value={formatRoleNames(user.roles)} />
        <InfoRow label="Account Status" value={<UserStatusBadge isActive={user.is_active} />} />
        <Separator />
        <InfoRow label="Member Since" value={formatDateTime(user.created_at)} />
        <InfoRow label="Last Updated" value={formatDateTime(user.updated_at)} />
        <InfoRow label="Last Login" value={formatDateTime(user.last_login_at)} />
        <InfoRow label="Last Logout" value={formatDateTime(user.last_logout_at)} />
        <InfoRow label="Last Activity" value={formatDateTime(user.last_activity_at)} />
      </SettingsCard>
    </div>
  );
}
