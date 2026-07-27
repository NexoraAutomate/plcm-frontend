"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Edit, Trash2, Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import * as api from "@/lib/api";
import * as Models from "@/lib/models";
import { Can } from "@/components/auth/can";
import { P } from "@/lib/permission-codes";
import { JsonBatchUploadButton } from "@/components/settings/json-batch-upload-button";
import { StatusBadge } from "@/components/status-badge";
import {
  STATUS_COLOR_PALETTE,
  normalizeStatusColor,
  statusBadgeStyleFromColor,
  suggestColorForStatusName,
} from "@/lib/status-colors";
import { cn } from "@/lib/utils";
import { useDataStore } from "@/lib/data-store";

const STATUS_TYPES = [
  { key: "projects", label: "Projects" },
  { key: "systems", label: "Systems" },
  { key: "subsystems", label: "Subsystems" },
  { key: "modules", label: "Modules" },
  { key: "units", label: "Units" },
  { key: "components", label: "Components" },
  { key: "orders", label: "Orders" },
  { key: "customers", label: "Customers" },
] as const;

function ColorPalettePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (hex: string) => void;
}) {
  const selected = normalizeStatusColor(value) ?? "";

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {STATUS_COLOR_PALETTE.map((swatch) => {
          const active = selected === swatch.hex.toUpperCase();
          return (
            <button
              key={swatch.hex}
              type="button"
              title={swatch.name}
              aria-label={swatch.name}
              onClick={() => onChange(swatch.hex)}
              className={cn(
                "h-7 w-7 rounded-full border-2 transition-transform",
                active ? "scale-110 border-foreground" : "border-transparent hover:scale-105"
              )}
              style={{ backgroundColor: swatch.hex }}
            />
          );
        })}
      </div>
      <div className="flex items-center gap-2">
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#059669"
          className="font-mono text-sm md:w-36"
          maxLength={7}
        />
        <Badge variant="outline" style={statusBadgeStyleFromColor(value)} className="text-xs">
          Preview
        </Badge>
      </div>
    </div>
  );
}

export type StatusesPanelProps = {
  embedded?: boolean;
};

export function StatusesPanel({ embedded = false }: StatusesPanelProps) {
  const { statuses: storeStatuses, createStatus, updateStatus, deleteStatus } = useDataStore();
  const [statuses, setStatuses] = useState<Models.Status[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newStatusType, setNewStatusType] = useState("");
  const [newColor, setNewColor] = useState(STATUS_COLOR_PALETTE[0].hex);
  const [editOpen, setEditOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Models.Status | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editStatusType, setEditStatusType] = useState("");
  const [editColor, setEditColor] = useState(STATUS_COLOR_PALETTE[0].hex);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Models.Status | null>(null);
  const [statusTypeFilter, setStatusTypeFilter] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    if (storeStatuses.length > 0) {
      setStatuses(storeStatuses);
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await api.statuses.list();
        if (!cancelled) setStatuses(res.data);
      } catch (err) {
        console.error("Failed to load statuses", err);
        if (!cancelled) toast.error("Failed to load statuses");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [storeStatuses]);

  const refreshStatuses = async () => {
    try {
      const res = await api.statuses.list();
      setStatuses(res.data);
    } catch (err) {
      console.error("Failed to refresh statuses", err);
    }
  };

  const handleBatchUpload = async (items: unknown[]) => {
    const payloads: Array<Partial<Models.Status>> = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item || typeof item !== "object") {
        throw new Error(`Item at index ${i} must be an object.`);
      }
      const record = item as Record<string, unknown>;
      const statusName = typeof record.status_name === "string" ? record.status_name.trim() : "";
      if (!statusName) {
        throw new Error(`Item at index ${i} is missing a valid status_name.`);
      }
      const colorRaw = typeof record.color === "string" ? record.color : undefined;
      payloads.push({
        status_name: statusName,
        description: typeof record.description === "string" ? record.description : undefined,
        status_type: typeof record.status_type === "string" ? record.status_type : undefined,
        color: normalizeStatusColor(colorRaw) ?? suggestColorForStatusName(statusName),
      });
    }

    await api.statuses.batchCreate(payloads);
    await refreshStatuses();
    toast.success(`Imported ${payloads.length} status${payloads.length === 1 ? "" : "es"}`);
  };

  const handleCreateStatus = async () => {
    if (!newName.trim()) {
      toast.error("Status name is required");
      return;
    }
    if (!newStatusType) {
      toast.error("Category is required");
      return;
    }
    const color = normalizeStatusColor(newColor);
    if (!color) {
      toast.error("Select a valid color from the palette (e.g. #059669)");
      return;
    }

    setSaving(true);
    try {
      await createStatus({
        status_name: newName.trim(),
        description: newDescription.trim(),
        status_type: newStatusType,
        color,
      });
      setNewName("");
      setNewDescription("");
      setNewStatusType("");
      setNewColor(STATUS_COLOR_PALETTE[0].hex);
      setCreateOpen(false);
      await refreshStatuses();
    } catch (err) {
      console.error("Failed to create status", err);
    } finally {
      setSaving(false);
    }
  };

  const openEditDialog = (status: Models.Status) => {
    setEditTarget(status);
    setEditName(status.status_name);
    setEditDescription(status.description || "");
    setEditStatusType(status.status_type || "");
    setEditColor(
      normalizeStatusColor(status.color) ?? suggestColorForStatusName(status.status_name)
    );
    setEditOpen(true);
  };

  const handleEditSave = async () => {
    if (!editTarget) return;

    if (!editName.trim()) {
      toast.error("Status name cannot be empty");
      return;
    }
    if (!editStatusType) {
      toast.error("Category is required");
      return;
    }
    const color = normalizeStatusColor(editColor);
    if (!color) {
      toast.error("Select a valid color from the palette (e.g. #059669)");
      return;
    }

    try {
      await updateStatus(editTarget.id, {
        status_name: editName.trim(),
        description: editDescription.trim(),
        status_type: editStatusType,
        color,
      });
      setEditOpen(false);
      setEditTarget(null);
      await refreshStatuses();
    } catch (err) {
      console.error("Failed to update status", err);
    }
  };

  const prepareDelete = (status: Models.Status) => {
    setDeleteTarget(status);
    setDeleteConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;

    try {
      await deleteStatus(deleteTarget.id);
      await refreshStatuses();
    } catch (err) {
      console.error("Failed to delete status", err);
    } finally {
      setDeleteConfirmOpen(false);
      setDeleteTarget(null);
    }
  };

  const filteredStatuses =
    statusTypeFilter && statusTypeFilter !== "all"
      ? statuses.filter((s) => s.status_type === statusTypeFilter)
      : statuses;

  const grouped = useMemo(() => {
    const map = new Map<string, Models.Status[]>();
    for (const type of STATUS_TYPES) {
      map.set(type.key, []);
    }
    map.set("other", []);
    for (const status of filteredStatuses) {
      const key = status.status_type || "other";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(status);
    }
    return map;
  }, [filteredStatuses]);

  const visibleGroups = STATUS_TYPES.filter((type) => (grouped.get(type.key)?.length ?? 0) > 0);
  const otherStatuses = grouped.get("other") ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        {!embedded ? (
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Statuses</h1>
            <p className="text-muted-foreground mt-2">
              Group statuses by category and assign badge colors used across the app.
            </p>
          </div>
        ) : (
          <div />
        )}
        <Can permission={P.create_statuses}>
          <div className="flex flex-wrap items-center gap-2">
            <JsonBatchUploadButton onUpload={handleBatchUpload} />
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Status
            </Button>
          </div>
        </Can>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-2">
          <Label>Filter by category</Label>
          <Select value={statusTypeFilter} onValueChange={setStatusTypeFilter}>
            <SelectTrigger className="w-full md:w-64">
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {STATUS_TYPES.map((type) => (
                <SelectItem key={type.key} value={type.key}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading statuses…</p>
      ) : filteredStatuses.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No statuses found. Add a status for a category to get started.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {visibleGroups.map((type) => {
            const items = grouped.get(type.key) ?? [];
            return (
              <Card key={type.key} className="shadow-sm">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-base font-semibold">{type.label}</CardTitle>
                    <Badge variant="secondary">{items.length}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground font-normal">
                    Badge colors below appear on lists, detail pages, and history across this
                    category.
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-3">
                    {items.map((status) => (
                      <div
                        key={status.id}
                        className="flex min-w-[220px] flex-1 items-start justify-between gap-3 rounded-lg border border-border bg-background p-3"
                      >
                        <div className="space-y-2">
                          <StatusBadge status={status.status_name} color={status.color} />
                          <p className="text-xs text-muted-foreground max-w-[200px]">
                            {status.description || "No description"}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Can permission={P.edit_statuses}>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground"
                              onClick={() => openEditDialog(status)}
                              aria-label="Edit status"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          </Can>
                          <Can permission={P.delete_statuses}>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive"
                              onClick={() => prepareDelete(status)}
                              aria-label="Delete status"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </Can>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {otherStatuses.length > 0 && (
            <Card className="shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold">Other</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-3">
                  {otherStatuses.map((status) => (
                    <div
                      key={status.id}
                      className="flex min-w-[220px] flex-1 items-start justify-between gap-3 rounded-lg border border-border bg-background p-3"
                    >
                      <div className="space-y-2">
                        <StatusBadge status={status.status_name} color={status.color} />
                        <p className="text-xs text-muted-foreground">
                          {status.status_type || "uncategorized"} ·{" "}
                          {status.description || "No description"}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Can permission={P.edit_statuses}>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openEditDialog(status)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </Can>
                        <Can permission={P.delete_statuses}>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 hover:text-destructive"
                            onClick={() => prepareDelete(status)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </Can>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={(open) => {
          setDeleteConfirmOpen(open);
          if (!open) setDeleteTarget(null);
        }}
        title="Confirm delete"
        description={`Delete "${deleteTarget?.status_name ?? "status"}" and remove it from the status registry. This action cannot be undone.`}
        onConfirm={confirmDelete}
      />

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Status</DialogTitle>
            <DialogDescription>
              Create a status under a category and pick a badge color for the UI.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Status Name</Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Ready"
              />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={newStatusType} onValueChange={setNewStatusType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_TYPES.map((type) => (
                    <SelectItem key={type.key} value={type.key}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Optional description"
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Palette className="h-4 w-4" />
                Badge color
              </Label>
              <ColorPalettePicker value={newColor} onChange={setNewColor} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateStatus} disabled={saving}>
                {saving ? "Saving..." : "Create Status"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={editOpen}
        onOpenChange={(open) => {
          setEditOpen(open);
          if (!open) setEditTarget(null);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Status</DialogTitle>
            <DialogDescription>
              Update name, category, description, or badge color.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={editStatusType} onValueChange={setEditStatusType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_TYPES.map((type) => (
                    <SelectItem key={type.key} value={type.key}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Palette className="h-4 w-4" />
                Badge color
              </Label>
              <ColorPalettePicker value={editColor} onChange={setEditColor} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleEditSave}>Save</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
