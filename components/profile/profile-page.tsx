'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-context';
import * as api from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { SettingsCard } from '@/components/settings/settings-card';
import { UserStatusBadge } from '@/components/settings/user-status-badge';
import { UserAvatar } from '@/components/user-avatar';
import { formatRoleNames } from '@/lib/user-display';
import type { ReactNode } from 'react';

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

export function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const searchParams = useSearchParams();
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    if (searchParams.get('changePassword') === '1') {
      setPasswordOpen(true);
    }
  }, [searchParams]);

  async function handleChangePassword() {
    if (!oldPassword || !newPassword) {
      toast.error('Enter your current and new password');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('New password must be at least 6 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }
    setSavingPassword(true);
    try {
      await api.auth.changePassword(oldPassword, newPassword);
      toast.success('Password changed');
      setPasswordOpen(false);
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: unknown) {
      const detail =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { detail?: string } } }).response?.data?.detail
          : undefined;
      toast.error(typeof detail === 'string' ? detail : 'Failed to change password');
    } finally {
      setSavingPassword(false);
    }
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-2xl">
        <p className="text-sm text-muted-foreground">Loading profile…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Profile</h1>
          <p className="text-sm text-muted-foreground">Your account details</p>
        </div>
        <Button variant="outline" onClick={() => setPasswordOpen(true)}>
          Change password
        </Button>
      </div>

      <div className="flex items-center gap-4 rounded-xl border bg-card p-5">
        <UserAvatar
          userId={user.id}
          fullName={user.full_name}
          username={user.username}
          avatarUrl={user.avatar_url}
          size={72}
          editable
          uploadMode="self"
          onUploaded={async () => {
            await refreshUser();
          }}
        />
        <div className="min-w-0 space-y-1.5">
          <p className="truncate text-lg font-semibold leading-none">
            {user.full_name || user.username}
          </p>
          <p className="truncate text-sm text-muted-foreground">{user.email || 'No email'}</p>
          <p className="text-xs text-muted-foreground">Click the photo to upload a new one</p>
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

      <Dialog open={passwordOpen} onOpenChange={setPasswordOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change password</DialogTitle>
            <DialogDescription>Enter your current password and choose a new one.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="old-password">Current password</Label>
              <Input
                id="old-password"
                type="password"
                autoComplete="current-password"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="new-password">New password</Label>
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="confirm-password">Confirm new password</Label>
              <Input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setPasswordOpen(false)}>
                Cancel
              </Button>
              <Button disabled={savingPassword} onClick={() => void handleChangePassword()}>
                {savingPassword ? 'Saving…' : 'Update password'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
