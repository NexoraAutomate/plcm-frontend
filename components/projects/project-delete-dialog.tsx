'use client';

import { useEffect, useState } from 'react';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ConfirmDialog } from '@/components/confirm-dialog';
import * as api from '@/lib/api';
import type { ProjectDeleteDisposition, ProjectDeletePreview } from '@/lib/models';
import { toast } from 'sonner';

type Mode = 'loading' | 'simple' | 'choice' | 'waiting' | 'finalize' | 'discard-confirm';

interface ProjectDeleteDialogProps {
  open: boolean;
  projectId: number | null;
  onOpenChange: (open: boolean) => void;
  onDelete: (
    id: number,
    options?: {
      inventory_disposition?: ProjectDeleteDisposition;
      confirm?: boolean;
    }
  ) => Promise<unknown>;
  onCompleted: () => void;
}

function generateDeleteCode(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

export function ProjectDeleteDialog({
  open,
  projectId,
  onOpenChange,
  onDelete,
  onCompleted,
}: ProjectDeleteDialogProps) {
  const [mode, setMode] = useState<Mode>('loading');
  const [preview, setPreview] = useState<ProjectDeletePreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [discardCode, setDiscardCode] = useState('');
  const [discardInput, setDiscardInput] = useState('');

  useEffect(() => {
    if (!open || projectId == null) {
      setMode('loading');
      setPreview(null);
      return;
    }

    let cancelled = false;
    setMode('loading');
    setPreview(null);
    api.projects
      .deletePreview(projectId)
      .then((res) => {
        if (cancelled) return;
        const data = res.data;
        setPreview(data);
        if (!data.progressed_past_reserve_or_assign) {
          setMode('simple');
        } else if (data.can_hard_delete) {
          setMode('finalize');
        } else if (data.delete_requested_at) {
          setMode('waiting');
        } else {
          setMode('choice');
        }
      })
      .catch((err) => {
        if (cancelled) return;
        const detail =
          err && typeof err === 'object' && 'response' in err
            ? (err as { response?: { data?: { detail?: unknown } } }).response?.data
                ?.detail
            : undefined;
        toast.error(
          typeof detail === 'string' && detail.trim()
            ? detail
            : 'Failed to load delete preview'
        );
        onOpenChange(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, projectId, onOpenChange]);

  useEffect(() => {
    if (mode === 'discard-confirm') {
      setDiscardCode(generateDeleteCode());
      setDiscardInput('');
    }
  }, [mode]);

  async function runDelete(
    disposition: ProjectDeleteDisposition,
    confirm = false
  ) {
    if (projectId == null) return;
    setBusy(true);
    try {
      await onDelete(projectId, {
        inventory_disposition: disposition,
        confirm,
      });
      onCompleted();
      onOpenChange(false);
    } catch {
      // toast handled by caller
    } finally {
      setBusy(false);
    }
  }

  const projectName = preview?.project_name ?? 'this project';
  const openRecalls = preview?.open_recall_count ?? 0;

  if (mode === 'simple') {
    return (
      <ConfirmDialog
        open={open}
        onOpenChange={onOpenChange}
        title="Delete Project"
        description="Are you sure? Reserved inventory will be released back to stock. This action cannot be undone."
        onConfirm={() => void runDelete('auto')}
      />
    );
  }

  if (mode === 'finalize') {
    return (
      <ConfirmDialog
        open={open}
        onOpenChange={onOpenChange}
        title="Permanently Delete Project"
        description={`${projectName} inventory has been cleared. Permanently delete the project and its inventory ledger? This cannot be undone.`}
        onConfirm={() => void runDelete('auto')}
      />
    );
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle>
            {mode === 'discard-confirm'
              ? 'Discard project and inventory ledger'
              : mode === 'waiting'
                ? 'Delete waiting on inventory recall'
                : mode === 'choice'
                  ? 'Inventory has progressed — choose how to delete'
                  : 'Delete Project'}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-sm text-muted-foreground">
              {mode === 'loading' && <p>Checking inventory status…</p>}

              {mode === 'choice' && (
                <>
                  <p>
                    <span className="font-medium text-foreground">{projectName}</span>{' '}
                    has inventory past reservation / assign-to-developer. Choose how
                    to proceed:
                  </p>
                  <ul className="list-disc space-y-2 pl-5">
                    <li>
                      <span className="font-medium text-foreground">Revert inventory</span>
                      — release reserved stock, open recall tasks for Inventory
                      Manager, and keep the project until stock is cleared. Then
                      you can delete permanently.
                    </li>
                    <li>
                      <span className="font-medium text-foreground">Discard everything</span>
                      — permanently delete the project and its inventory ledger now.
                      Physical stock item rows are left as-is (may remain issued /
                      reserved). This cannot be undone.
                    </li>
                  </ul>
                </>
              )}

              {mode === 'waiting' && (
                <>
                  <p>
                    Delete was already requested for{' '}
                    <span className="font-medium text-foreground">{projectName}</span>.
                    Inventory Manager still has {openRecalls} open recall
                    {openRecalls === 1 ? '' : 's'}.
                  </p>
                  <p>
                    Wait until recalls are complete, then delete again — or discard
                    everything now (permanent data loss).
                  </p>
                </>
              )}

              {mode === 'discard-confirm' && (
                <>
                  <p className="text-destructive">
                    This permanently deletes {projectName} and purges its inventory
                    ledger. Inventory item statuses will not be reverted. Type the
                    confirmation code to continue.
                  </p>
                  <div className="space-y-2 pt-1">
                    <Label htmlFor="discard-code">
                      Type {discardCode} to confirm
                    </Label>
                    <Input
                      id="discard-code"
                      value={discardInput}
                      onChange={(e) => setDiscardInput(e.target.value)}
                      autoComplete="off"
                      disabled={busy}
                    />
                  </div>
                </>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          {mode === 'choice' && (
            <>
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => void runDelete('revert', true)}
              >
                Revert inventory
              </Button>
              <Button
                variant="destructive"
                disabled={busy}
                onClick={() => setMode('discard-confirm')}
              >
                Discard everything
              </Button>
            </>
          )}
          {mode === 'waiting' && (
            <Button
              variant="destructive"
              disabled={busy}
              onClick={() => setMode('discard-confirm')}
            >
              Discard everything
            </Button>
          )}
          {mode === 'discard-confirm' && (
            <Button
              variant="destructive"
              disabled={busy || discardInput !== discardCode}
              onClick={() => void runDelete('discard', true)}
            >
              Discard and delete
            </Button>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
