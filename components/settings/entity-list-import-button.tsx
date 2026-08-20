"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { AlertCircle, CheckCircle2, Download, FileSpreadsheet, RefreshCw, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import * as api from "@/lib/api";

type EntityListImportButtonProps = {
  disabled?: boolean;
  onImported: () => Promise<void> | void;
};

type ImportPreview = {
  valid_rows: number;
  skipped: number;
  errors: { row: number; errors: string[] }[];
};

const TEMPLATE_CSV = [
  "entity_name,entity_type,abbreviation",
  "Antenna Pedestal,unit,AP",
  "Power Supply,component,PS",
  "Radar System,system,RAD",
].join("\n");

function getErrorDetail(err: unknown): string | undefined {
  if (err && typeof err === "object" && "response" in err) {
    const detail = (err as { response?: { data?: { detail?: unknown } } }).response?.data?.detail;
    if (typeof detail === "string") return detail;
    if (detail && typeof detail === "object" && "message" in detail) {
      const message = (detail as { message?: unknown }).message;
      if (typeof message === "string") return message;
    }
  }
  if (err instanceof Error && err.message) return err.message;
  return undefined;
}

function getRowErrors(err: unknown): { row: number; errors: string[] }[] | null {
  if (!err || typeof err !== "object" || !("response" in err)) return null;
  const detail = (err as { response?: { data?: { detail?: { errors?: { row: number; errors: string[] }[] } } } })
    .response?.data?.detail;
  if (detail && typeof detail === "object" && Array.isArray(detail.errors)) return detail.errors;
  return null;
}

export function EntityListImportButton({
  disabled = false,
  onImported,
}: EntityListImportButtonProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [validating, setValidating] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const resetState = () => {
    setFile(null);
    setPreview(null);
    setValidating(false);
    setSubmitting(false);
    if (inputRef.current) inputRef.current.value = "";
  };

  const downloadTemplate = () => {
    const blob = new Blob([TEMPLATE_CSV], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "entity-list-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const next = event.target.files?.[0] ?? null;
    event.target.value = "";
    setFile(next);
    setPreview(null);
    if (!next) return;

    setValidating(true);
    try {
      const res = await api.hierarchies.importSpreadsheet(next, true);
      setPreview({
        valid_rows: res.data.valid_rows ?? 0,
        skipped: res.data.skipped ?? 0,
        errors: res.data.errors ?? [],
      });
    } catch (err) {
      const rowErrors = getRowErrors(err);
      if (rowErrors) {
        setPreview({ valid_rows: 0, skipped: 0, errors: rowErrors });
      } else {
        toast.error(getErrorDetail(err) || "Failed to validate spreadsheet");
        setPreview(null);
      }
    } finally {
      setValidating(false);
    }
  };

  const handleImport = async () => {
    if (!file) return;
    setSubmitting(true);
    try {
      const res = await api.hierarchies.importSpreadsheet(file, false);
      const imported = res.data.imported ?? 0;
      const skipped = res.data.skipped ?? 0;
      const parts = [`Imported ${imported} entit${imported === 1 ? "y" : "ies"}`];
      if (skipped > 0) parts.push(`skipped ${skipped} duplicate${skipped === 1 ? "" : "s"}`);
      toast.success(parts.join(", "));
      setOpen(false);
      resetState();
      await onImported();
    } catch (err) {
      const rowErrors = getRowErrors(err);
      if (rowErrors) {
        setPreview({ valid_rows: 0, skipped: 0, errors: rowErrors });
        toast.error("Import failed with validation errors");
      } else {
        toast.error(getErrorDetail(err) || "Failed to import entities");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const canImport = Boolean(file && preview && preview.valid_rows > 0 && preview.errors.length === 0);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        <Upload className="mr-2 h-4 w-4" />
        Import CSV / Excel
      </Button>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (submitting) return;
          setOpen(next);
          if (!next) resetState();
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Import entities</DialogTitle>
            <DialogDescription>
              Upload a CSV or Excel (.xlsx) file with{" "}
              <code className="text-xs font-mono bg-muted px-1 rounded">entity name</code> and{" "}
              <code className="text-xs font-mono bg-muted px-1 rounded">entity type</code>.
              Types: system, subsystem, module, unit, component. Optional: abbreviation.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-1">
            <div className="flex items-center gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={downloadTemplate}>
                <Download className="mr-2 h-4 w-4" />
                Download template
              </Button>
            </div>

            <div className="flex items-center gap-3">
              <Label
                htmlFor="entity-list-file-input"
                className="flex items-center gap-2 cursor-pointer rounded-md border border-dashed px-4 py-3 text-sm text-muted-foreground hover:bg-muted/50 transition-colors flex-1"
              >
                <FileSpreadsheet className="h-4 w-4 shrink-0" />
                {file ? file.name : "Choose CSV or Excel file…"}
              </Label>
              <input
                ref={inputRef}
                id="entity-list-file-input"
                type="file"
                accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="hidden"
                onChange={(event) => void handleFileChange(event)}
                disabled={submitting}
              />
              {file && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={resetState}
                  disabled={submitting || validating}
                >
                  Clear
                </Button>
              )}
            </div>

            {validating && (
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                Validating…
              </p>
            )}

            {preview && (
              <div className="rounded-md border p-3 space-y-2 text-sm">
                {preview.valid_rows > 0 && (
                  <div className="flex items-center gap-2 text-emerald-600">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    <span>
                      {preview.valid_rows} valid row{preview.valid_rows === 1 ? "" : "s"} ready to import
                    </span>
                  </div>
                )}
                {preview.skipped > 0 && (
                  <p className="text-muted-foreground">
                    {preview.skipped} duplicate{preview.skipped === 1 ? "" : "s"} already in the list will be skipped.
                  </p>
                )}
                {preview.errors.length > 0 && (
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-destructive font-medium">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      <span>
                        {preview.errors.length} row{preview.errors.length === 1 ? "" : "s"} with errors
                      </span>
                    </div>
                    <ul className="ml-6 list-disc text-destructive/80 space-y-0.5 max-h-36 overflow-y-auto">
                      {preview.errors.map((entry) => (
                        <li key={entry.row}>
                          Row {entry.row}: {entry.errors.join("; ")}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {preview.valid_rows === 0 && preview.errors.length === 0 && (
                  <p className="text-muted-foreground">
                    No new entities to import{preview.skipped > 0 ? " — all rows already exist." : "."}
                  </p>
                )}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <Button
                variant="outline"
                onClick={() => { setOpen(false); resetState(); }}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button onClick={() => void handleImport()} disabled={!canImport || submitting}>
                {submitting ? "Importing…" : "Import"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
