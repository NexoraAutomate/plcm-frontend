'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import * as api from '@/lib/api';
import type { User } from '@/lib/models';
import { formatUserRef } from '@/lib/user-display';
import { hasWorkflowRole } from '@/lib/workflow-roles';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityType: string;
  entityId: number;
  entityName?: string | null;
  users: User[];
  currentDeveloperId?: number | null;
  issued?: boolean;
  onAssigned?: (developerId: number | null, developerName?: string | null) => void;
};

export function AssignDeveloperDialog({
  open,
  onOpenChange,
  entityType,
  entityId,
  entityName,
  users,
  currentDeveloperId,
  issued = false,
  onAssigned,
}: Props) {
  const [developerId, setDeveloperId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const developers = useMemo(
    () =>
      users.filter((user) =>
        hasWorkflowRole(user.roles ?? [], ['DEV', 'ADMIN'])
      ),
    [users]
  );

  useEffect(() => {
    if (!open) return;
    setDeveloperId(currentDeveloperId ? String(currentDeveloperId) : '');
  }, [open, currentDeveloperId]);

  async function handleSubmit() {
    if (issued) {
      toast.error('Assignment cannot be changed after physical issue');
      return;
    }
    const id = Number(developerId);
    if (!Number.isFinite(id) || id <= 0) {
      toast.error('Select a developer');
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.hierarchyWorkflow.assignDeveloper(entityType, entityId, id);
      toast.success(currentDeveloperId ? 'Developer reassigned' : 'Developer assigned');
      onAssigned?.(id, res.data.assigned_developer_name);
      onOpenChange(false);
    } catch (error: unknown) {
      const detail =
        (error as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail || 'Assign developer failed';
      toast.error(typeof detail === 'string' ? detail : 'Assign developer failed');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleClear() {
    if (issued) {
      toast.error('Assignment cannot be changed after physical issue');
      return;
    }
    setSubmitting(true);
    try {
      await api.hierarchyWorkflow.assignDeveloper(entityType, entityId, null);
      toast.success('Developer assignment cleared');
      onAssigned?.(null, null);
      onOpenChange(false);
    } catch (error: unknown) {
      const detail =
        (error as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail || 'Clear assignment failed';
      toast.error(typeof detail === 'string' ? detail : 'Clear assignment failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {currentDeveloperId ? 'Reassign developer' : 'Assign developer'}
          </DialogTitle>
          <DialogDescription>
            {issued
              ? 'This item has been issued by Inventory Manager and can no longer be reassigned.'
              : `Assign hierarchy work${entityName ? ` for ${entityName}` : ''} to a Developer. You can revert or reassign until the item is physically issued.`}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label>Developer</Label>
          <Select
            value={developerId}
            onValueChange={setDeveloperId}
            disabled={issued || submitting}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select developer" />
            </SelectTrigger>
            <SelectContent>
              {developers.map((user) => (
                <SelectItem key={user.id} value={String(user.id)}>
                  {formatUserRef(user) || user.username || `User #${user.id}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
          <div>
            {currentDeveloperId && !issued ? (
              <Button
                variant="ghost"
                className="text-destructive hover:text-destructive"
                onClick={() => void handleClear()}
                disabled={submitting}
              >
                Clear assignment
              </Button>
            ) : null}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={() => void handleSubmit()} disabled={submitting || issued}>
              {submitting
                ? 'Saving…'
                : currentDeveloperId
                  ? 'Reassign'
                  : 'Assign'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
