'use client';

import React, { useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { validateMaintenanceCaseForm } from '@/lib/form-validation';
import type {
  MaintenanceCase,
  CreateMaintenanceCasePayload,
  UpdateMaintenanceCasePayload,
  ProductionSupportPreview,
} from '@/lib/models';
import { maintenanceCases } from '@/lib/api';
import {
  CASE_STATUS_META,
  CASE_WORKFLOW_ORDER,
  getAllowedCaseStatusTransitions,
  mapCaseStatusFromApi,
  mapCaseStatusToApi,
  MaintenanceCaseWorkflowStatus,
} from '@/lib/maintenance-workflow';

interface MaintenanceCaseDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateMaintenanceCasePayload | UpdateMaintenanceCasePayload) => Promise<void>;
  editingCase?: MaintenanceCase | null;
  projects: any[];
  isLoading?: boolean;
}

const API_CASE_OPTIONS = CASE_WORKFLOW_ORDER.filter(
  (status) => status !== MaintenanceCaseWorkflowStatus.AWAITING_VERIFICATION
).map((displayStatus) => ({
  displayStatus,
  apiValue: mapCaseStatusToApi(displayStatus),
  label: CASE_STATUS_META[displayStatus].label,
}));

export function MaintenanceCaseDialog({
  isOpen,
  onClose,
  onSubmit,
  editingCase,
  projects,
  isLoading = false,
}: MaintenanceCaseDialogProps) {
  const [formData, setFormData] = React.useState({
    project_id: '',
    description: '',
    status: 'open',
    resolution_notes: '',
    support_override_reason: '',
  });
  const [supportPreview, setSupportPreview] = React.useState<ProductionSupportPreview | null>(
    null
  );
  const [supportLoading, setSupportLoading] = React.useState(false);

  const currentDisplayStatus = useMemo(
    () => mapCaseStatusFromApi(formData.status),
    [formData.status]
  );

  const allowedStatuses = useMemo(() => {
    const transitions = getAllowedCaseStatusTransitions(currentDisplayStatus);
    const options = API_CASE_OPTIONS.filter(
      (option) =>
        option.apiValue === formData.status ||
        transitions.some((t) => mapCaseStatusToApi(t) === option.apiValue)
    );
    return options.length ? options : API_CASE_OPTIONS;
  }, [currentDisplayStatus, formData.status]);

  useEffect(() => {
    if (editingCase) {
      setFormData({
        project_id: editingCase.project_id.toString(),
        description: editingCase.description ?? '',
        status: editingCase.status,
        resolution_notes: editingCase.resolution_notes || '',
        support_override_reason: '',
      });
      setSupportPreview(null);
    } else {
      setFormData({
        project_id: '',
        description: '',
        status: 'open',
        resolution_notes: '',
        support_override_reason: '',
      });
      setSupportPreview(null);
    }
  }, [editingCase, isOpen]);

  useEffect(() => {
    if (editingCase || !formData.project_id) {
      setSupportPreview(null);
      return;
    }
    let cancelled = false;
    setSupportLoading(true);
    maintenanceCases
      .getProductionSupport(parseInt(formData.project_id, 10))
      .then((preview) => {
        if (!cancelled) setSupportPreview(preview);
      })
      .catch(() => {
        if (!cancelled) setSupportPreview(null);
      })
      .finally(() => {
        if (!cancelled) setSupportLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [editingCase, formData.project_id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validationError = validateMaintenanceCaseForm({
      isEdit: Boolean(editingCase),
      projectId: formData.project_id,
      description: formData.description,
      status: formData.status,
    });
    if (validationError) {
      toast.error(validationError);
      return;
    }

    if (
      !editingCase &&
      supportPreview?.requires_override &&
      !formData.support_override_reason.trim()
    ) {
      toast.error('Production support has ended — enter an override reason to open the case.');
      return;
    }

    try {
      if (editingCase) {
        await onSubmit({
          status: formData.status as CreateMaintenanceCasePayload['status'],
          resolution_notes: formData.resolution_notes,
        });
      } else {
        await onSubmit({
          project_id: parseInt(formData.project_id),
          description: formData.description,
          status: formData.status as CreateMaintenanceCasePayload['status'],
          support_override_reason: supportPreview?.requires_override
            ? formData.support_override_reason.trim()
            : undefined,
        });
      }
      onClose();
    } catch {
      // Error is handled by caller
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {editingCase ? 'Edit Maintenance Case' : 'Add New Maintenance Case'}
          </DialogTitle>
          <DialogDescription>
            {editingCase
              ? 'Update the maintenance case details below'
              : 'Create a new maintenance case to track issues'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!editingCase && (
            <div className="space-y-2">
              <Label htmlFor="project_id">Project *</Label>
              <Select
                value={formData.project_id}
                onValueChange={(value) =>
                  setFormData({ ...formData, project_id: value, support_override_reason: '' })
                }
              >
                <SelectTrigger id="project_id">
                  <SelectValue placeholder="Select a project" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id.toString()}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {supportLoading ? (
                <p className="text-xs text-muted-foreground">Checking production support…</p>
              ) : supportPreview?.requires_override ? (
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  Production support ended
                  {supportPreview.production_support_date
                    ? ` on ${supportPreview.production_support_date}`
                    : ''}
                  . Override reason required.
                </p>
              ) : supportPreview?.in_production_support ? (
                <p className="text-xs text-emerald-700 dark:text-emerald-300">
                  In production support until {supportPreview.production_support_date}.
                </p>
              ) : null}
            </div>
          )}

          {!editingCase && (
            <div className="space-y-2">
              <Label htmlFor="description">Description *</Label>
              <Textarea
                id="description"
                placeholder="Describe the maintenance issue..."
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                rows={4}
              />
            </div>
          )}

          {!editingCase && supportPreview?.requires_override ? (
            <div className="space-y-2">
              <Label htmlFor="support_override_reason">Support override reason *</Label>
              <Input
                id="support_override_reason"
                value={formData.support_override_reason}
                onChange={(e) =>
                  setFormData({ ...formData, support_override_reason: e.target.value })
                }
                placeholder="Why open this case after support ended?"
              />
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="status">Status *</Label>
            <Select
              value={formData.status}
              onValueChange={(value) =>
                setFormData({ ...formData, status: value })
              }
            >
              <SelectTrigger id="status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {allowedStatuses.map((s) => (
                  <SelectItem key={s.apiValue} value={s.apiValue}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {editingCase && (
            <div className="space-y-2">
              <Label htmlFor="resolution_notes">Resolution Notes</Label>
              <Textarea
                id="resolution_notes"
                placeholder="Add resolution notes..."
                value={formData.resolution_notes}
                onChange={(e) =>
                  setFormData({ ...formData, resolution_notes: e.target.value })
                }
                rows={3}
              />
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading
                ? 'Saving...'
                : editingCase
                ? 'Update Case'
                : 'Create Case'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
