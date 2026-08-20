"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import * as api from "@/lib/api";

function downloadBlob(data: Blob, filename: string) {
  const url = URL.createObjectURL(data);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function EntityListExportButton() {
  const [busy, setBusy] = useState(false);

  const handleExport = async (format: "csv" | "xlsx") => {
    setBusy(true);
    try {
      const res = await api.hierarchies.exportSpreadsheet(format);
      const blob = res.data as Blob;
      downloadBlob(blob, format === "xlsx" ? "entity-list.xlsx" : "entity-list.csv");
    } catch {
      toast.error("Failed to download entity list");
    } finally {
      setBusy(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" disabled={busy}>
          <Download className="mr-2 h-4 w-4" />
          {busy ? "Downloading…" : "Download"}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => void handleExport("csv")}>
          Download CSV
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => void handleExport("xlsx")}>
          Download Excel
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
