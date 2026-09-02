'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import * as api from '@/lib/api';
import type { InventoryIssuance, InventoryIssuanceSignature } from '@/lib/models';
import { issuanceHasSignatureArtifacts } from '@/lib/issuance-signature';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { PageLoader } from '@/components/page-loader';
import { Download, FileText } from 'lucide-react';

type Props = {
  issuance: InventoryIssuance | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function IssuanceSignatureDialog({ issuance, open, onOpenChange }: Props) {
  const [details, setDetails] = useState<InventoryIssuanceSignature | null>(null);
  const [signaturePreviewUrl, setSignaturePreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !issuance) {
      setDetails(null);
      setSignaturePreviewUrl(null);
      return;
    }

    let cancelled = false;
    let objectUrl: string | null = null;
    setLoading(true);

    void (async () => {
      try {
        const res = await api.inventory.getIssuanceSignature(issuance.id);
        if (cancelled) return;
        const data = res.data;
        setDetails(data ?? null);

        if (data?.has_signature_attachment) {
          const blobRes = await api.inventory.downloadIssuanceSignatureBlob(
            issuance.id,
            'digital'
          );
          if (!cancelled) {
            objectUrl = URL.createObjectURL(blobRes.data);
            setSignaturePreviewUrl(objectUrl);
          }
        }
      } catch {
        if (!cancelled) {
          toast.error('Failed to load issuance signature details');
          setDetails(null);
          setSignaturePreviewUrl(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [open, issuance]);

  const title =
    issuance?.inventory_name ||
    (issuance ? `Issuance #${issuance.id}` : 'Issuance signature');

  const signatureType = (details?.signature_type || issuance?.signature_type || '').toUpperCase();
  const hasArtifacts = details
    ? issuanceHasSignatureArtifacts(details)
    : issuance
      ? issuanceHasSignatureArtifacts(issuance)
      : false;

  async function downloadProforma() {
    if (!issuance) return;
    try {
      const blobRes = await api.inventory.downloadIssuanceSignatureBlob(
        issuance.id,
        'proforma'
      );
      const fileName =
        details?.proforma_file_name || `issuance-${issuance.id}-proforma`;
      const url = URL.createObjectURL(blobRes.data);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = fileName;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Failed to download proforma');
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Issuance signature</DialogTitle>
          <DialogDescription>
            {title}
            {issuance?.serial_number ? ` · SN ${issuance.serial_number}` : ''}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <PageLoader />
        ) : !hasArtifacts && signatureType !== 'HARD_COPY' ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No digital signature or scanned proforma was stored for this issuance.
          </p>
        ) : (
          <div className="space-y-4">
            {signatureType === 'DIGITAL' && details?.has_signature_attachment ? (
              <div className="space-y-2">
                <p className="text-sm font-medium">Digital signature</p>
                {signaturePreviewUrl ? (
                  <div className="overflow-hidden rounded-md border bg-muted/20 p-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={signaturePreviewUrl}
                      alt="Digital issue signature"
                      className="mx-auto max-h-48 w-full object-contain"
                    />
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Signature image unavailable.</p>
                )}
              </div>
            ) : null}

            {signatureType === 'HARD_COPY' ? (
              <div className="space-y-3">
                <div className="rounded-md border bg-muted/20 px-3 py-2 text-sm">
                  Hard-copy issue sheet confirmed at issuance.
                </div>
                {!details?.has_proforma_attachment ? (
                  <p className="text-sm text-muted-foreground">
                    No scanned proforma was uploaded for this issuance.
                  </p>
                ) : null}
              </div>
            ) : null}

            {details?.has_proforma_attachment ? (
              <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
                <div className="flex min-w-0 items-center gap-2 text-sm">
                  <FileText className="size-4 shrink-0 text-muted-foreground" />
                  <span className="truncate">
                    {details.proforma_file_name || 'Inventory Issuance Proforma'}
                  </span>
                </div>
                <Button variant="outline" size="sm" onClick={() => void downloadProforma()}>
                  <Download className="size-3.5" />
                  Download
                </Button>
              </div>
            ) : null}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
