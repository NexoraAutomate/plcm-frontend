"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, Edit, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { toast } from "sonner";
import * as api from "@/lib/api";
import * as Models from "@/lib/models";
import { Can } from "@/components/auth/can";
import { P } from "@/lib/permission-codes";

const STATUS_TYPES = [
  { key: "projects", label: "Projects" },
  { key: "systems", label: "Systems" },
  { key: "subsystems", label: "Subsystems" },
  { key: "modules", label: "Modules" },
  { key: "units", label: "Units" },
  { key: "components", label: "Components" },
  { key: "orders", label: "Orders" },
  
] as const;

export default function StatusesPage() {
  const [statuses, setStatuses] = useState<Models.Status[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newStatusType, setNewStatusType] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Models.Status | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editStatusType, setEditStatusType] = useState("");
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Models.Status | null>(null);
  const [statusTypeFilter, setStatusTypeFilter] = useState("all");
  const addSectionRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const loadStatuses = async () => {
      setLoading(true);
      try {
        const res = await api.statuses.list();
        setStatuses(res.data);
      } catch (err) {
        console.error("Failed to load statuses", err);
      } finally {
        setLoading(false);
      }
    };

    loadStatuses();
  }, []);

  const refreshStatuses = async () => {
    try {
      const res = await api.statuses.list();
      setStatuses(res.data);
    } catch (err) {
      console.error("Failed to refresh statuses", err);
    }
  };

  const handleCreateStatus = async () => {
    if (!newName.trim()) {
      toast.error("Status name is required");
      return;
    }
    if (!newStatusType) {
      toast.error("Status type is required");
      return;
    }

    setSaving(true);
    try {
      await api.statuses.create({ 
        status_name: newName.trim(), 
        description: newDescription.trim(),
        status_type: newStatusType,
      });
      setNewName("");
      setNewDescription("");
      setNewStatusType("");
      await refreshStatuses();
      toast.success("Status created successfully");
    } catch (err) {
      console.error("Failed to create status", err);
      toast.error("Failed to create status");
    } finally {
      setSaving(false);
    }
  };

  const openEditDialog = (status: Models.Status) => {
    setEditTarget(status);
    setEditName(status.status_name);
    setEditDescription(status.description || "");
    setEditStatusType(status.status_type || "");
    setEditOpen(true);
  };

  const handleEditSave = async () => {
    if (!editTarget) {
      return;
    }

    if (!editName.trim()) {
      toast.error("Status name cannot be empty");
      return;
    }

    if (!editStatusType) {
      toast.error("Status type is required");
      return;
    }

    try {
      await api.statuses.update(editTarget.id, {
        status_name: editName.trim(),
        description: editDescription.trim(),
        status_type: editStatusType,
      });
      setEditOpen(false);
      setEditTarget(null);
      setEditName("");
      setEditDescription("");
      setEditStatusType("");
      await refreshStatuses();
      toast.success("Status updated successfully");
    } catch (err) {
      console.error("Failed to update status", err);
      toast.error("Failed to update status");
    }
  };

  const prepareDelete = (status: Models.Status) => {
    setDeleteTarget(status);
    setDeleteConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) {
      return;
    }

    try {
      await api.statuses.delete(deleteTarget.id);
      await refreshStatuses();
      toast.success("Status deleted successfully");
    } catch (err) {
      console.error("Failed to delete status", err);
      toast.error("Failed to delete status");
    } finally {
      setDeleteConfirmOpen(false);
      setDeleteTarget(null);
    }
  };

  const filteredStatuses = statusTypeFilter && statusTypeFilter !== "all"
    ? statuses.filter(s => s.status_type === statusTypeFilter)
    : statuses;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Statuses</h1>
          <p className="text-muted-foreground mt-2">Create and manage all status values used across the app.</p>
        </div>
        <Can permission={P.create_statuses}>
          <Button variant="secondary" onClick={() => addSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}>
            <Plus className="mr-2 h-4 w-4" />
            Add Status
          </Button>
        </Can>
      </div>

      <Can permission={P.create_statuses}>
        <div ref={addSectionRef}>
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold text-card-foreground">Add Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>Status Name</Label>
                  <Input value={newName} onChange={(event) => setNewName(event.target.value)} placeholder="e.g. Ready" />
                </div>
                <div className="space-y-2">
                  <Label>Status Type</Label>
                  <Select value={newStatusType} onValueChange={setNewStatusType}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
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
                  <Input value={newDescription} onChange={(event) => setNewDescription(event.target.value)} placeholder="Optional description" />
                </div>
                <div className="md:col-span-3 flex items-end">
                  <Button onClick={handleCreateStatus} disabled={saving}>
                    <Plus className="mr-2 h-4 w-4" />
                    {saving ? "Saving..." : "Create Status"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </Can>

      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold text-card-foreground">Status List</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <Label>Filter by Type</Label>
            <Select value={statusTypeFilter} onValueChange={setStatusTypeFilter}>
              <SelectTrigger className="w-full md:w-64">
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                {STATUS_TYPES.map((type) => (
                  <SelectItem key={type.key} value={type.key}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading statuses…</p>
          ) : filteredStatuses.length === 0 ? (
            <p className="text-sm text-muted-foreground">No statuses found.</p>
          ) : (
            <div className="space-y-3">
              {filteredStatuses.map((status) => (
                <Card key={status.id} className="border border-border bg-background">
                  <CardContent className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between pt-6">
                    <div>
                      <div className="text-sm font-semibold">{status.status_name}</div>
                      <div className="text-xs text-muted-foreground">{status.status_type}</div>
                      <div className="text-sm text-muted-foreground">{status.description || "No description."}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Can permission={P.edit_statuses}>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={() => openEditDialog(status)} aria-label="Edit status">
                          <Edit className="h-4 w-4" />
                        </Button>
                      </Can>
                      <Can permission={P.delete_statuses}>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => prepareDelete(status)} aria-label="Delete status">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </Can>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

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

      <Dialog open={editOpen} onOpenChange={(open) => {
        setEditOpen(open);
        if (!open) {
          setEditTarget(null);
          setEditName("");
          setEditDescription("");
          setEditStatusType("");
        }
      }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Status</DialogTitle>
            <DialogDescription>Update the status name, type, or description.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={editName} onChange={(event) => setEditName(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Status Type</Label>
              <Select value={editStatusType} onValueChange={setEditStatusType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
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
              <Input value={editDescription} onChange={(event) => setEditDescription(event.target.value)} />
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
