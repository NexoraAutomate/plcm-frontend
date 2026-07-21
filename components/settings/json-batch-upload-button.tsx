"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type JsonBatchUploadButtonProps = {
  label?: string;
  disabled?: boolean;
  /** Validate and upload the parsed JSON array. Throw or reject to surface errors. */
  onUpload: (items: unknown[]) => Promise<void>;
};

function getErrorDetail(err: unknown): string | undefined {
  if (err && typeof err === "object" && "response" in err) {
    const detail = (err as { response?: { data?: { detail?: unknown } } }).response?.data?.detail;
    if (typeof detail === "string") return detail;
  }
  if (err instanceof Error && err.message) return err.message;
  return undefined;
}

export function JsonBatchUploadButton({
  label = "Upload JSON",
  disabled = false,
  onUpload,
}: JsonBatchUploadButtonProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Allow re-selecting the same file
    event.target.value = "";
    if (!file) return;

    setUploading(true);
    try {
      const text = await file.text();
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        toast.error("Invalid JSON file. Please upload a valid JSON array.");
        return;
      }

      if (!Array.isArray(parsed)) {
        toast.error("JSON must be an array of objects.");
        return;
      }

      if (parsed.length === 0) {
        toast.error("JSON array is empty.");
        return;
      }

      await onUpload(parsed);
    } catch (err) {
      console.error("JSON batch upload failed", err);
      toast.error(getErrorDetail(err) || "Failed to upload JSON");
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={handleFileChange}
      />
      <Button
        type="button"
        variant="outline"
        disabled={disabled || uploading}
        onClick={() => inputRef.current?.click()}
      >
        <Upload className="mr-2 h-4 w-4" />
        {uploading ? "Uploading..." : label}
      </Button>
    </>
  );
}
