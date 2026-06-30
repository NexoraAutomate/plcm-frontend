'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import type { Project, Status } from '@/lib/models';

interface ProjectProgressDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: Project | null;
  statuses: Status[];
  onSave: (projectId: number, data: { progress: number; status_id?: number }) => Promise<void>;
}

export function ProjectProgressDialog({
  open,
  onOpenChange,
  project,
  statuses,
  onSave,
}: ProjectProgressDialogProps) {
  const [progress, setProgress] = useState(0);
  const [statusId, setStatusId] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!project) return;
    setProgress(project.progress ?? 0);
    setStatusId(project.status_id);
  }, [project]);

  const completedStatus = statuses.find((s) => s.status_name === 'Completed');
  const executionStatus = statuses.find((s) => s.status_name === 'Execution');

  const handleProgressChange = (value: number[]) => {
    const next = value[0] ?? 0;
    setProgress(next);
    if (next >= 100 && completedStatus) {
      setStatusId(completedStatus.id);
    } else if ((project?.progress ?? 0) >= 100 && next > 0 && next < 100 && executionStatus) {
      setStatusId(executionStatus.id);
    }
  };

  async function handleSave() {
    if (!project) return;
    setSaving(true);
    try {
      const payload: { progress: number; status_id?: number } = { progress };
      if (statusId && statusId !== project.status_id) {
        payload.status_id = statusId;
      }
      if (progress >= 100 && completedStatus) {
        payload.progress = 100;
        payload.status_id = completedStatus.id;
      }
      await onSave(project.id, payload);
      toast.success('Project progress updated');
      onOpenChange(false);
    } catch {
      toast.error('Failed to update progress');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Progress</DialogTitle>
          <DialogDescription>
            {project?.name} — adjust completion percentage. At 100% the project status is set to
            Completed automatically.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-6 py-2">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Progress</Label>
              <span className="text-sm font-semibold">{progress}%</span>
            </div>
            <Progress value={progress} className="h-3" />
            <Slider
              value={[progress]}
              onValueChange={handleProgressChange}
              max={100}
              step={1}
              className="py-2"
            />
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <Select
              value={statusId?.toString() ?? ''}
              onValueChange={(v) => setStatusId(parseInt(v, 10))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                {statuses.map((s) => (
                  <SelectItem key={s.id} value={s.id.toString()}>
                    {s.status_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              You can override the auto-suggested status. Lowering progress from 100% defaults to
              Execution unless you choose otherwise.
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : 'Save Progress'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
