'use client';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { ItemInstallRejection } from '@/lib/models';
import { parseApiDate } from '@/lib/parse-api-date';

function formatWhen(value?: string | null) {
  if (!value) return '—';
  try {
    const d = parseApiDate(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleString();
  } catch {
    return value;
  }
}

interface RejectionReasonsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemLabel?: string;
  history?: ItemInstallRejection[] | null;
}

export function RejectionReasonsDialog({
  open,
  onOpenChange,
  itemLabel,
  history,
}: RejectionReasonsDialogProps) {
  const rows = history ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Rejection Reasons</DialogTitle>
          <DialogDescription>
            History of Hierarchy Manager installation rejections
            {itemLabel ? ` for ${itemLabel}` : ''}.
          </DialogDescription>
        </DialogHeader>
        {rows.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">No rejection history.</p>
        ) : (
          <ul className="max-h-80 space-y-3 overflow-y-auto">
            {rows.map((row, index) => {
              const isLatest = index === 0;
              return (
                <li
                  key={row.id}
                  className={cn(
                    'rounded-md border px-3 py-2 text-sm',
                    isLatest
                      ? 'border-red-300 bg-red-50 text-red-950 dark:border-red-800 dark:bg-red-950/40 dark:text-red-50'
                      : 'border-border bg-background'
                  )}
                >
                  <div className="mb-1 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex flex-wrap items-center gap-2">
                      {isLatest ? (
                        <Badge
                          variant="destructive"
                          className="h-5 px-1.5 text-[10px] uppercase tracking-wide"
                        >
                          Latest
                        </Badge>
                      ) : null}
                      <span
                        className={
                          isLatest
                            ? 'text-red-700 dark:text-red-300'
                            : 'text-muted-foreground'
                        }
                      >
                        {formatWhen(row.rejected_at)}
                      </span>
                    </div>
                    <span
                      className={
                        isLatest
                          ? 'text-red-700 dark:text-red-300'
                          : 'text-muted-foreground'
                      }
                    >
                      {row.rejected_by_name || 'HM'}
                    </span>
                  </div>
                  <p
                    className={cn(
                      'whitespace-pre-wrap',
                      isLatest ? 'font-medium text-red-950 dark:text-red-50' : 'text-foreground'
                    )}
                  >
                    {row.reason?.trim() || '—'}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
