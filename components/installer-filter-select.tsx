'use client';

import { useMemo } from 'react';
import type { User } from '@/lib/models';
import { formatUserRef } from '@/lib/user-display';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export const INSTALLER_FILTER_ALL = 'all';
export const INSTALLER_FILTER_SELF = 'self';

interface InstallerFilterSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  users: User[];
  currentUserId?: number | null;
  isInventoryManager: boolean;
  className?: string;
  /** When false, omit the Label (for compact toolbars). Default true. */
  showLabel?: boolean;
}

/**
 * Admin/SubAdmin: filter by any installer.
 * Installer: "Self" option to show only their installs.
 */
export function InstallerFilterSelect({
  value,
  onValueChange,
  users,
  currentUserId,
  isInventoryManager,
  className = 'w-48',
  showLabel = true,
}: InstallerFilterSelectProps) {
  const installerOptions = useMemo(() => {
    return [...users]
      .filter((u) => u.is_active !== false)
      .sort((a, b) =>
        (formatUserRef(a) || a.username || '').localeCompare(
          formatUserRef(b) || b.username || ''
        )
      );
  }, [users]);

  const select = (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className={className}>
        <SelectValue placeholder="Filter by installer" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={INSTALLER_FILTER_ALL}>All installers</SelectItem>
        {!isInventoryManager && currentUserId != null ? (
          <SelectItem value={INSTALLER_FILTER_SELF}>Self (my installs)</SelectItem>
        ) : null}
        {isInventoryManager
          ? installerOptions.map((u) => (
              <SelectItem key={u.id} value={String(u.id)}>
                {formatUserRef(u) || u.username || `User #${u.id}`}
              </SelectItem>
            ))
          : null}
      </SelectContent>
    </Select>
  );

  if (!showLabel) return select;

  return (
    <div className="space-y-2">
      <Label className="sr-only">Installer</Label>
      {select}
    </div>
  );
}

/** Resolve combobox value → installed_by_id for list APIs. */
export function resolveInstallerFilterId(
  value: string,
  options: { currentUserId?: number | null; isInventoryManager: boolean }
): number | null {
  if (value === INSTALLER_FILTER_ALL) return null;
  if (value === INSTALLER_FILTER_SELF) {
    return options.currentUserId != null ? Number(options.currentUserId) : null;
  }
  const id = Number(value);
  return Number.isFinite(id) ? id : null;
}
