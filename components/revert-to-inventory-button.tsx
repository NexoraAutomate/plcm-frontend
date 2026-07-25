'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Undo2 } from 'lucide-react';
import * as api from '@/lib/api';
import { Can } from '@/components/auth/can';
import { useAuth } from '@/lib/auth-context';
import { P } from '@/lib/permission-codes';
import { canManageInstall } from '@/lib/install-ownership';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

type Props = {
  entityType: string;
  entityId: number;
  partNumber?: string | null;
  serialNumber?: string | null;
  installedById?: number | null;
  isCurrentInstall?: boolean;
  onReverted?: () => void;
  className?: string;
  variant?: 'default' | 'outline' | 'ghost' | 'secondary' | 'destructive' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
};

export function RevertToInventoryButton({
  entityType,
  entityId,
  partNumber,
  serialNumber,
  installedById,
  isCurrentInstall = true,
  onReverted,
  className,
  variant = 'outline',
  size = 'sm',
}: Props) {
  const { user, isInventoryManager } = useAuth();
  const [busy, setBusy] = useState(false);

  const ownsInstall = canManageInstall({
    isInventoryManager: isInventoryManager(),
    currentUserId: user?.id,
    installedById,
  });

  // Admin/SubAdmin manage issue/returns — only owning installers revert
  if (isInventoryManager() || !isCurrentInstall || !ownsInstall) return null;

  const handleRevert = async () => {
    setBusy(true);
    try {
      await api.inventory.revertToStock(entityType, entityId);
      toast.success(
        `Restored to your inventory${partNumber ? ` (${partNumber}` : ''}${
          serialNumber ? ` / ${serialNumber}` : ''
        }${partNumber || serialNumber ? ')' : ''} with children removed from hierarchy`
      );
      onReverted?.();
    } catch (err: unknown) {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        'Failed to revert install to inventory';
      toast.error(typeof detail === 'string' ? detail : 'Failed to revert install to inventory');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Can permission={P.revert_inventory_install}>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant={variant} size={size} className={className} disabled={busy}>
            <Undo2 className="mr-1.5 size-3.5" />
            Revert to inventory
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revert accidental install?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the item and all its children from the hierarchy UI and restores the
              assembly to your issued inventory list
              {partNumber ? ` (${partNumber}` : ''}
              {serialNumber ? ` / ${serialNumber}` : ''}
              {partNumber || serialNumber ? ')' : ''}. Installation metadata will be cleared.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={busy} onClick={() => void handleRevert()}>
              {busy ? 'Reverting…' : 'Revert'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Can>
  );
}
