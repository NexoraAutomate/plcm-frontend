import type { InventoryIssuance } from '@/lib/models';

const INSTALLED_VERIFIED = 'INSTALLED_VERIFIED';

/** Issued stock that has not started install may be returned (installer or IM force-return). */
export function issuanceCanReturn(row: InventoryIssuance): boolean {
  if (row.status !== 'issued') return false;
  if (row.verified_at) return false;
  if (row.installed_at) return false;
  const lifecycle = (row.item_lifecycle_status || 'ISSUED').trim().toUpperCase();
  return lifecycle === 'ISSUED';
}

export function issuanceInstallStateLabel(row: InventoryIssuance): string | null {
  if (row.verified_at || row.item_lifecycle_status === INSTALLED_VERIFIED) {
    return 'installed verified';
  }
  if (row.installed_at) return 'install in progress';
  return null;
}
