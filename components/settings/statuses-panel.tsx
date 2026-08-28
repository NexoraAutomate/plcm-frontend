"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Edit, Trash2, ChevronDown, Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import * as Models from "@/lib/models";
import { Can } from "@/components/auth/can";
import { P } from "@/lib/permission-codes";
import { StatusImportButton } from "@/components/settings/status-import-button";
import { StatusBadge } from "@/components/status-badge";
import {
  STATUS_COLOR_PALETTE,
  THEME_COLOR_COLUMNS,
  STANDARD_COLORS,
  normalizeStatusColor,
  statusBadgeStyleFromColor,
  suggestColorForStatusName,
} from "@/lib/status-colors";
import { cn } from "@/lib/utils";
import { useDataStore } from "@/lib/data-store";
import { useAppDefinitions } from "@/lib/app-definitions-context";
import { usePageDataRefresh } from "@/components/page-data-refresh";

function getStatusTypes(entityLabel: (level: string, plural?: boolean) => string) {
  return [
    { key: "projects", label: entityLabel("project", true) },
    { key: "systems", label: entityLabel("system", true) },
    { key: "subsystems", label: entityLabel("subsystem", true) },
    { key: "modules", label: entityLabel("module", true) },
    { key: "units", label: entityLabel("unit", true) },
    { key: "components", label: entityLabel("component", true) },
    { key: "orders", label: "Orders" },
    { key: "customers", label: "Customers" },
  ] as const;
}

function ColorPalettePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (hex: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = normalizeStatusColor(value) ?? "";
  const customRef = useRef<HTMLInputElement>(null);

  function pick(hex: string) {
    const normalized = normalizeStatusColor(hex);
    if (!normalized) return;
    onChange(normalized);
    setOpen(false);
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" size="sm" className="h-8 gap-2 px-2.5">
            <span
              className="h-3.5 w-3.5 rounded-[2px] border border-black/20"
              style={{ backgroundColor: selected || "#2F5496" }}
            />
            <span className="text-xs">Color</span>
            <ChevronDown className="h-3.5 w-3.5 opacity-60" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-55 p-2" sideOffset={6}>
          <div className="space-y-2">
            <p className="px-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Theme Colors
            </p>
            <div className="flex gap-0.5">
              {THEME_COLOR_COLUMNS.map((column) => (
                <div key={column.name} className="flex flex-col gap-0.5" title={column.name}>
                  {column.shades.map((hex) => {
                    const active = selected === hex.toUpperCase();
                    return (
                      <button
                        key={hex}
                        type="button"
                        title={`${column.name} (${hex})`}
                        aria-label={`${column.name} ${hex}`}
                        onClick={() => pick(hex)}
                        className={cn(
                          "h-3.5 w-3.5 rounded-[1px] border border-black/10 hover:relative hover:z-10 hover:outline-1 hover:outline-offset-0 hover:outline-foreground",
                          active && "outline-1 outline-offset-0 outline-foreground"
                        )}
                        style={{ backgroundColor: hex }}
                      />
                    );
                  })}
                </div>
              ))}
            </div>

            <p className="px-0.5 pt-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Standard Colors
            </p>
            <div className="flex gap-0.5">
              {STANDARD_COLORS.map((swatch) => {
                const active = selected === swatch.hex.toUpperCase();
                return (
                  <button
                    key={swatch.hex}
                    type="button"
                    title={swatch.name}
                    aria-label={swatch.name}
                    onClick={() => pick(swatch.hex)}
                    className={cn(
                      "h-3.5 w-3.5 rounded-[1px] border border-black/10 hover:relative hover:z-10 hover:outline-1 hover:outline-offset-0 hover:outline-foreground",
                      active && "outline-1 outline-offset-0 outline-foreground"
                    )}
                    style={{ backgroundColor: swatch.hex }}
                  />
                );
              })}
            </div>

            <div className="border-t border-border pt-1.5">
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-sm px-1.5 py-1 text-xs hover:bg-accent"
                onClick={() => customRef.current?.click()}
              >
                <span
                  className="relative h-3.5 w-3.5 overflow-hidden rounded-[1px] border border-black/20"
                  style={{
                    background:
                      "conic-gradient(red, yellow, lime, aqua, blue, magenta, red)",
                  }}
                />
                More Colors…
              </button>
              <input
                ref={customRef}
                type="color"
                className="sr-only"
                value={selected || "#2F5496"}
                onChange={(e) => pick(e.target.value)}
              />
            </div>
          </div>
        </PopoverContent>
      </Popover>

      <Badge variant="outline" style={statusBadgeStyleFromColor(value)} className="text-xs">
        Preview
      </Badge>
    </div>
  );
}

export type StatusesPanelProps = {
  embedded?: boolean;
};

export function StatusesPanel({ embedded = false }: StatusesPanelProps) {
  const { entityLabel } = useAppDefinitions();
  const STATUS_TYPES = getStatusTypes(entityLabel);
  const { statuses: storeStatuses, createStatus, updateStatus, deleteStatus, refreshStatuses } =
    useDataStore();
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

  usePageDataRefresh(refreshStatuses);

  useEffect(() => {
    setStatuses(storeStatuses);
    if (storeStatuses.length > 0) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        await refreshStatuses();
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
  }, [storeStatuses, refreshStatuses]);

  const handleImportedStatuses = async () => {
    try {
      await refreshStatuses();
    } catch (err) {
      console.error("Failed to refresh statuses after import", err);
      toast.error("Statuses imported, but the list failed to refresh");
    }
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
            <h1 className="text-2xl font-semibold tracking-tight">Statuses</h1>
            <p className="text-sm text-muted-foreground">
              Group statuses by category and assign badge colors used across the app.
            </p>
          </div>
        ) : (
          <div />
        )}
        <Can permission={P.create_statuses}>
          <div className="flex flex-wrap items-center gap-2">
            <StatusImportButton onImported={handleImportedStatuses} />
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
                        className="flex min-w-55 flex-1 items-start justify-between gap-3 rounded-lg border border-border bg-background p-3"
                      >
                        <div className="space-y-2">
                          <StatusBadge status={status.status_name} color={status.color} />
                          <p className="text-xs text-muted-foreground max-w-50">
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
                      className="flex min-w-55 flex-1 items-start justify-between gap-3 rounded-lg border border-border bg-background p-3"
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
