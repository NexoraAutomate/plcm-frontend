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
