import * as api from '@/lib/api';
import type { SignatureKind } from '@/components/inventory/issue-signature-fields';

/** Upload optional hard-copy proforma after issuance is created. */
export async function uploadIssuanceProformaIfNeeded(
  issuanceId: number | null | undefined,
  signatureType: SignatureKind,
  proformaFile: File | null | undefined
) {
  if (!issuanceId || signatureType !== 'HARD_COPY' || !proformaFile) return;
  await api.inventory.uploadIssuanceProforma(issuanceId, proformaFile);
}

export function issuanceHasSignatureArtifacts(row: {
  signature_type?: string | null;
  has_signature_attachment?: boolean | null;
  has_proforma_attachment?: boolean | null;
}): boolean {
  const type = (row.signature_type || '').toUpperCase();
  if (type === 'DIGITAL' && row.has_signature_attachment) return true;
  // Hard-copy ack is always recorded; proforma scan is optional.
  if (type === 'HARD_COPY') return true;
  return false;
}

export function displayStatusBadgeVariant(status: string) {
  const normalized = status.trim().toLowerCase();
  switch (normalized) {
    case 'issued':
      return 'default' as const;
    case 'return pending':
    case 'return_pending':
      return 'secondary' as const;
    case 'installed':
    case 'installed verified':
    case 'install in progress':
    case 'under testing':
      return 'secondary' as const;
    case 'returned':
      return 'outline' as const;
    case 'reverted':
    case 'defect pending':
      return 'destructive' as const;
    default:
      return 'outline' as const;
  }
}

export function issuanceDisplayStatus(row: {
  status?: string | null;
  display_status?: string | null;
  item_lifecycle_status?: string | null;
  verified_at?: string | null;
}): string {
  if (row.display_status?.trim()) return row.display_status.trim();
  const status = (row.status || 'issued').trim().toLowerCase();
  if (status !== 'issued') return status.replace(/_/g, ' ');
  if (row.verified_at) return 'installed verified';
  const lifecycle = (row.item_lifecycle_status || '').trim().toUpperCase();
  if (lifecycle === 'INSTALLATION_IN_PROGRESS') return 'install in progress';
  if (lifecycle === 'UNDER_TESTING_REVIEW') return 'under testing';
  if (lifecycle === 'INSTALLED_VERIFIED') return 'installed verified';
  if (lifecycle && lifecycle !== 'ISSUED') return lifecycle.toLowerCase().replace(/_/g, ' ');
  return status;
}
