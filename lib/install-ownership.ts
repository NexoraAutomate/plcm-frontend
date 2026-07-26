/**
 * Install ownership: non-managers may only mutate installs they performed.
 * Admin/SubAdmin (inventory managers) may manage any install.
 * Entities with no installer remain editable by anyone with the permission.
 */
export function canManageInstall(options: {
  isInventoryManager: boolean;
  currentUserId?: number | null;
  installedById?: number | null;
}): boolean {
  if (options.isInventoryManager) return true;
  if (options.installedById == null) return true;
  if (options.currentUserId == null) return false;
  return Number(options.installedById) === Number(options.currentUserId);
}

export function isOwnInstall(options: {
  currentUserId?: number | null;
  installedById?: number | null;
}): boolean {
  if (options.currentUserId == null || options.installedById == null) return false;
  return Number(options.installedById) === Number(options.currentUserId);
}

/** Emerald row highlight when the signed-in installer owns the install. */
export function ownInstallRowClass(options: {
  isInventoryManager: boolean;
  currentUserId?: number | null;
  installedById?: number | null;
  isCurrentInstall?: boolean | null;
}): string {
  if (options.isInventoryManager) return '';
  if (options.isCurrentInstall === false) return '';
  if (
    !isOwnInstall({
      currentUserId: options.currentUserId,
      installedById: options.installedById,
    })
  ) {
    return '';
  }
  return 'bg-emerald-50/70 dark:bg-emerald-950/25';
}

export function showOwnInstallBadge(options: {
  isInventoryManager: boolean;
  currentUserId?: number | null;
  installedById?: number | null;
  isCurrentInstall?: boolean | null;
}): boolean {
  if (options.isInventoryManager) return false;
  if (options.isCurrentInstall === false) return false;
  return isOwnInstall({
    currentUserId: options.currentUserId,
    installedById: options.installedById,
  });
}
