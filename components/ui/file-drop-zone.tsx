'use client';

import { useCallback, useId, useRef, useState, type DragEvent, type ReactNode } from 'react';
import { Eye, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/** Accent used by upload drop zones and pill tab controls (matches product upload mock). */
export const UPLOAD_ACCENT = '#10A37F';

export const pillTabsListClassName =
  'flex h-auto w-full flex-wrap justify-start gap-0.5 rounded-full border bg-background p-1';

export const pillTabsTriggerClassName =
  'flex-1 rounded-full px-3 py-1.5 text-sm font-medium text-foreground shadow-none data-[state=active]:text-white data-[state=active]:shadow-none';

export type UploadedFileRowProps = {
  name: string;
  subtitle?: string | null;
  disabled?: boolean;
  onDelete?: () => void;
  onEdit?: () => void;
  onView?: () => void;
  className?: string;
};

/** One uploaded/queued file row with optional view / edit / delete actions. */
export function UploadedFileRow({
  name,
  subtitle,
  disabled = false,
  onDelete,
  onEdit,
  onView,
  className,
}: UploadedFileRowProps) {
  return (
    <div
      className={cn(
        'flex w-full min-w-0 max-w-full items-center justify-between gap-3 overflow-hidden rounded-lg border bg-background px-3 py-2.5',
        className
      )}
    >
      <div className="min-w-0 flex-1 overflow-hidden">
        {onView ? (
          <button
            type="button"
            className="block w-full truncate text-left text-sm font-medium text-foreground hover:underline"
            onClick={onView}
            disabled={disabled}
            title={name}
          >
            {name}
          </button>
        ) : (
          <p className="truncate text-sm font-medium" title={name}>
            {name}
          </p>
        )}
        {subtitle ? (
          <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-0.5">
        {onView ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            disabled={disabled}
            onClick={onView}
            title="View"
            aria-label={`View ${name}`}
          >
            <Eye className="h-4 w-4" />
          </Button>
        ) : null}
        {onEdit ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            disabled={disabled}
            onClick={onEdit}
            title="Edit"
            aria-label={`Edit ${name}`}
          >
            <Pencil className="h-4 w-4" />
          </Button>
        ) : null}
        {onDelete ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive hover:text-destructive"
            disabled={disabled}
            onClick={onDelete}
            title="Delete"
            aria-label={`Delete ${name}`}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        ) : null}
      </div>
    </div>
  );
}

type FileDropZoneProps = {
  accept?: string;
  multiple?: boolean;
  disabled?: boolean;
  /** Primary line; "Browse" is highlighted automatically when browseLabel is used. */
  browseLabel?: string;
  restLabel?: string;
  hint?: string;
  /**
   * Single-file mode: when set, the drop zone is replaced by a file name row.
   * Multi-file mode: ignored for zone visibility (parent lists rows below).
   */
  selectedLabel?: string | null;
  /** Required with selectedLabel in single-file mode to clear the selection. */
  onClear?: () => void;
  className?: string;
  onFiles: (files: File[]) => void;
  children?: ReactNode;
};

function filesFromList(list: FileList | null | undefined): File[] {
  if (!list?.length) return [];
  return Array.from(list);
}

export function FileDropZone({
  accept,
  multiple = false,
  disabled = false,
  browseLabel = 'Browse',
  restLabel = 'Computer Files or drop',
  hint,
  selectedLabel,
  onClear,
  className,
  onFiles,
  children,
}: FileDropZoneProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const emitFiles = useCallback(
    (files: File[]) => {
      if (disabled || files.length === 0) return;
      onFiles(multiple ? files : files.slice(0, 1));
    },
    [disabled, multiple, onFiles]
  );

  function handleDragOver(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (disabled) return;
    setDragging(true);
  }

  function handleDragLeave(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    event.stopPropagation();
    setDragging(false);
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    event.stopPropagation();
    setDragging(false);
    if (disabled) return;
    emitFiles(filesFromList(event.dataTransfer?.files));
  }

  // Single-file: replace the drop zone with a compact file row once selected.
  if (!multiple && selectedLabel) {
    return (
      <div className={cn('w-full min-w-0 max-w-full space-y-2', className)}>
        <UploadedFileRow
          name={selectedLabel}
          disabled={disabled}
          onDelete={onClear}
        />
      </div>
    );
  }

  return (
    <div className={cn('w-full min-w-0 max-w-full space-y-2', className)}>
      <label
        htmlFor={inputId}
        onDragOver={handleDragOver}
        onDragEnter={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          'flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-4 py-8 text-center transition-colors',
          disabled && 'cursor-not-allowed opacity-60',
          dragging
            ? 'border-[var(--upload-accent)] bg-[color-mix(in_srgb,var(--upload-accent)_12%,transparent)]'
            : 'border-[color-mix(in_srgb,var(--upload-accent)_70%,transparent)] bg-[color-mix(in_srgb,var(--upload-accent)_6%,transparent)] hover:bg-[color-mix(in_srgb,var(--upload-accent)_10%,transparent)]'
        )}
        style={{ ['--upload-accent' as string]: UPLOAD_ACCENT }}
      >
        {children ?? (
          <>
            <p className="text-sm text-foreground">
              <span className="font-semibold" style={{ color: UPLOAD_ACCENT }}>
                {browseLabel}
              </span>{' '}
              {restLabel}
            </p>
            {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
          </>
        )}
      </label>
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        className="sr-only"
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        onChange={(event) => {
          emitFiles(filesFromList(event.target.files));
          event.target.value = '';
        }}
      />
    </div>
  );
}
