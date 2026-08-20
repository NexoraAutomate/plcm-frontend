'use client';

import { useRef, useState } from 'react';
import { Download, Upload, AlertTriangle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SettingsSection } from '@/components/settings/settings-section';
import { SettingsCard } from '@/components/settings/settings-card';
import { Can } from '@/components/auth/can';
import { P } from '@/lib/permission-codes';
import { backup } from '@/lib/api';
import axios from 'axios';

export type BackupPanelProps = {
  embedded?: boolean;
};

const CONFIRM_PHRASE = 'RESTORE';

async function extractApiError(error: unknown, fallback: string): Promise<string> {
  if (!axios.isAxiosError(error)) {
    return error instanceof Error ? error.message : fallback;
  }
  const data = error.response?.data;
  if (data instanceof Blob) {
    try {
      const text = await data.text();
      const parsed = JSON.parse(text) as { detail?: string };
      if (typeof parsed.detail === 'string') return parsed.detail;
      return text || fallback;
    } catch {
      return fallback;
    }
  }
  const detail = data?.detail;
  if (typeof detail === 'string') return detail;
  return fallback;
}

export function BackupPanel({ embedded = false }: BackupPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [backingUp, setBackingUp] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [confirmText, setConfirmText] = useState('');

  const canRestore = confirmText === CONFIRM_PHRASE && selectedFile !== null && !restoring;

  async function handleBackup() {
    setBackingUp(true);
    try {
      const { filename } = await backup.create();
      toast.success(`Backup downloaded: ${filename}`);
    } catch (error) {
      toast.error(await extractApiError(error, 'Failed to create backup'));
    } finally {
      setBackingUp(false);
    }
  }

  async function handleRestore() {
    if (!selectedFile || confirmText !== CONFIRM_PHRASE) return;
    setRestoring(true);
    try {
      const res = await backup.restore(selectedFile, CONFIRM_PHRASE);
      toast.success(res.data.message || 'Restore completed successfully');
      toast.message('Sign out and sign back in to refresh your session.');
      setSelectedFile(null);
      setConfirmText('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (error) {
      toast.error(await extractApiError(error, 'Failed to restore backup'));
    } finally {
      setRestoring(false);
    }
  }

  return (
    <div className="space-y-8">
      {!embedded && (
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Backup & Restore</h1>
          <p className="text-sm text-muted-foreground">
            Download a full copy of application data, or restore from a previous backup
          </p>
        </div>
      )}

      <Can permission={P.backup_database}>
        <SettingsSection
          title="Create backup"
          description="Downloads a ZIP containing the full database and uploaded files."
        >
          <SettingsCard>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                Include all projects, hierarchy, inventory, users, and attachments in one archive.
              </p>
              <Button onClick={handleBackup} disabled={backingUp} className="shrink-0">
                {backingUp ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Download className="mr-2 h-4 w-4" />
                )}
                {backingUp ? 'Creating backup…' : 'Download backup'}
              </Button>
            </div>
          </SettingsCard>
        </SettingsSection>
      </Can>

      <Can permission={P.restore_database}>
        <SettingsSection
          title="Restore from backup"
          description="Replaces all current application data with the contents of a backup file."
        >
          <SettingsCard>
            <div className="space-y-5">
              <div className="flex gap-3 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <p>
                  Restoring overwrites the live database and uploaded files. Download a fresh backup
                  first if you need a rollback. Schema versions must match.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="backup-file">Backup file (.zip)</Label>
                <Input
                  id="backup-file"
                  ref={fileInputRef}
                  type="file"
                  accept=".zip,application/zip"
                  disabled={restoring}
                  onChange={(e) => {
                    const file = e.target.files?.[0] ?? null;
                    setSelectedFile(file);
                  }}
                />
                {selectedFile ? (
                  <p className="text-xs text-muted-foreground">{selectedFile.name}</p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="restore-confirm">
                  Type <span className="font-mono font-semibold">{CONFIRM_PHRASE}</span> to confirm
                </Label>
                <Input
                  id="restore-confirm"
                  value={confirmText}
                  disabled={restoring}
                  autoComplete="off"
                  placeholder={CONFIRM_PHRASE}
                  onChange={(e) => setConfirmText(e.target.value)}
                />
              </div>

              <Button
                variant="destructive"
                onClick={handleRestore}
                disabled={!canRestore}
                className="w-full sm:w-auto"
              >
                {restoring ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="mr-2 h-4 w-4" />
                )}
                {restoring ? 'Restoring…' : 'Restore backup'}
              </Button>
            </div>
          </SettingsCard>
        </SettingsSection>
      </Can>
    </div>
  );
}
