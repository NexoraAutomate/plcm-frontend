'use client';

import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { SettingsCard } from '@/components/settings/settings-card';
import { UserStatusBadge } from '@/components/settings/user-status-badge';
import * as api from '@/lib/api';
import type { User, UserActivitySummary } from '@/lib/models';
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

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User | null;
};

export function UserDetailsDialog({ open, onOpenChange, user }: Props) {
  const [activity, setActivity] = useState<UserActivitySummary | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !user) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await api.users.activity(user.id);
        if (!cancelled) setActivity(res.data);
      } catch {
        if (!cancelled) {
          setActivity(null);
          toast.error('Failed to load user activity');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, user]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>User Details</DialogTitle>
          <DialogDescription>
            Account and activity information for {user?.full_name || user?.username}
          </DialogDescription>
        </DialogHeader>

        {user ? (
          <div className="space-y-4">
            <SettingsCard title="Account Information">
              <InfoRow label="Username" value={user.username} />
              <InfoRow label="Full Name" value={user.full_name || '—'} />
              <InfoRow label="Email" value={user.email || '—'} />
              <InfoRow label="Roles" value={formatRoleNames(user.roles)} />
              <InfoRow
                label="Account Status"
                value={<UserStatusBadge isActive={activity?.is_active ?? user.is_active} />}
              />
              <Separator />
              <InfoRow label="Created Date" value={formatDateTime(activity?.created_at || user.created_at)} />
              <InfoRow label="Last Updated" value={formatDateTime(activity?.updated_at || user.updated_at)} />
              <InfoRow label="Last Login" value={formatDateTime(activity?.last_login || user.last_login_at)} />
              <InfoRow label="Last Logout" value={formatDateTime(activity?.last_logout || user.last_logout_at)} />
              <InfoRow
                label="Failed Login Count"
                value={activity?.failed_login_count ?? user.failed_login_count ?? 0}
              />
              <InfoRow label="Total Login Count" value={activity?.total_login_count ?? 0} />
              <InfoRow
                label="Account Created By"
                value={activity?.created_by_id ?? user.created_by_id ?? '—'}
              />
            </SettingsCard>

            <SettingsCard title="Activity Information">
              {loading ? (
                <p className="py-4 text-sm text-muted-foreground">Loading activity…</p>
              ) : (
                <>
                  <InfoRow label="Last Login" value={formatDateTime(activity?.last_login)} />
                  <InfoRow label="Last Activity" value={formatDateTime(activity?.last_activity)} />
                  <InfoRow label="Last IP Address" value={activity?.last_ip_address || '—'} />
                  <InfoRow label="Last Device" value={activity?.last_device || '—'} />
                  <InfoRow label="Browser" value={activity?.browser || '—'} />
                  <InfoRow label="Operating System" value={activity?.operating_system || '—'} />
                </>
              )}
            </SettingsCard>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
