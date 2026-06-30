"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Plus,
  Trash2,
  Edit,
  AlertCircle,
  CheckCircle2,
  ShieldAlert,
  Network,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import * as api from "@/lib/api";
import type { Hierarchy } from "@/lib/models";

const HIERARCHY_LEVELS = [
  { key: "system", label: "System" },
  { key: "subsystem", label: "Subsystem" },
  { key: "module", label: "Module" },
  { key: "unit", label: "Unit" },
  { key: "component", label: "Component" },
] as const;

type HierarchyLevel = (typeof HIERARCHY_LEVELS)[number]["key"];

const PARENT_LEVEL: Record<HierarchyLevel, HierarchyLevel | null> = {
  system: null,
  subsystem: "system",
  module: "subsystem",
  unit: "module",
  component: "unit",
};

function buildHierarchyTree(entries: Hierarchy[]) {
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  const grouped = {
    system: [] as Hierarchy[],
    subsystem: [] as Hierarchy[],
    module: [] as Hierarchy[],
    unit: [] as Hierarchy[],
    component: [] as Hierarchy[],
  };

  for (const entry of entries) {
    if (grouped[entry.hierarchy_type as HierarchyLevel]) {
      grouped[entry.hierarchy_type as HierarchyLevel].push(entry);
    }
  }

  return grouped;
}

function getHierarchyLabel(level: HierarchyLevel) {
  return HIERARCHY_LEVELS.find((item) => item.key === level)?.label || level;
}

export default function HierarchyPage() {
  const { hasAccess } = useAuth();
  const isAdmin = hasAccess(["Admin"]);

  const [hierarchies, setHierarchies] = useState<Hierarchy[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedLevel, setSelectedLevel] = useState<HierarchyLevel>("system");
  const [newName, setNewName] = useState("");
  const [selectedSystemId, setSelectedSystemId] = useState<number | null>(null);
  const [selectedSubsystemId, setSelectedSubsystemId] = useState<number | null>(null);
  const [selectedModuleId, setSelectedModuleId] = useState<number | null>(null);
  const [selectedUnitId, setSelectedUnitId] = useState<number | null>(null);

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Hierarchy | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Hierarchy | null>(null);
  const [editName, setEditName] = useState("");

  const [validateSystemId, setValidateSystemId] = useState<number | null>(null);
  const [validateSubsystemId, setValidateSubsystemId] = useState<number | null>(null);
  const [validationResult, setValidationResult] = useState<{ valid: boolean; message: string } | null>(null);
  const addSectionRef = useRef<HTMLDivElement | null>(null);

  const grouped = useMemo(() => buildHierarchyTree(hierarchies), [hierarchies]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await api.hierarchies.list();
        setHierarchies(res.data);
      } catch (err) {
        console.error("Failed to load hierarchy data", err);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const resetChildSelection = (level: HierarchyLevel) => {
    if (level === "system") {
      setSelectedSubsystemId(null);
      setSelectedModuleId(null);
      setSelectedUnitId(null);
    }
    if (level === "subsystem") {
      setSelectedModuleId(null);
      setSelectedUnitId(null);
    }
    if (level === "module") {
      setSelectedUnitId(null);
    }
  };

  const currentParentId = (() => {
    switch (selectedLevel) {
      case "subsystem":
        return selectedSystemId;
      case "module":
        return selectedSubsystemId;
      case "unit":
        return selectedModuleId;
      case "component":
        return selectedUnitId;
      default:
        return undefined;
    }
  })();

  const handleCreateHierarchy = async () => {
    if (!newName.trim()) {
      setValidationResult({ valid: false, message: "Hierarchy name is required." });
      return;
    }

    if (selectedLevel !== "system" && !currentParentId) {
      setValidationResult({
        valid: false,
        message: `Select a parent ${getHierarchyLabel(PARENT_LEVEL[selectedLevel] as HierarchyLevel)} before creating a ${getHierarchyLabel(selectedLevel)}.`,
      });
      return;
    }

    setSaving(true);
    try {
      await api.hierarchies.create({
        name: newName.trim(),
        hierarchy_type: selectedLevel,
        parent_id: currentParentId ?? undefined,
      });
      const res = await api.hierarchies.list();
      setHierarchies(res.data);
      setNewName("");
      setValidationResult({ valid: true, message: `${getHierarchyLabel(selectedLevel)} created successfully.` });
    } catch (err) {
      console.error("Failed to create hierarchy item", err);
      setValidationResult({ valid: false, message: "Failed to create hierarchy item." });
    } finally {
      setSaving(false);
    }
  };

  const prepareDelete = (item: Hierarchy) => {
    setDeleteTarget(item);
    setDeleteConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) {
      return;
    }

    try {
      await api.hierarchies.delete(deleteTarget.id);
      const res = await api.hierarchies.list();
      setHierarchies(res.data);
      setValidationResult({ valid: true, message: "Hierarchy item deleted successfully." });
      toast.success("Hierarchy item deleted");
    } catch (err) {
      console.error("Failed to delete hierarchy item", err);
      setValidationResult({ valid: false, message: "Failed to delete hierarchy item." });
      toast.error("Failed to delete hierarchy item");
    } finally {
      setDeleteConfirmOpen(false);
      setDeleteTarget(null);
    }
  };

  const openEditDialog = (item: Hierarchy) => {
    setEditTarget(item);
    setEditName(item.name);
    setEditOpen(true);
  };

  const handleEditSave = async () => {
    if (!editTarget) {
      return;
    }

    if (!editName.trim()) {
      toast.error("Name cannot be empty");
      return;
    }

    try {
      await api.hierarchies.update(editTarget.id, { name: editName.trim() });
      const res = await api.hierarchies.list();
      setHierarchies(res.data);
      toast.success("Hierarchy item updated");
      setEditOpen(false);
      setEditTarget(null);
      setEditName("");
    } catch (err) {
      console.error("Failed to update hierarchy item", err);
      toast.error("Failed to update hierarchy item");
    }
  };

  const prepareAddChild = (level: HierarchyLevel, parent: Hierarchy) => {
    setSelectedLevel(level);
    setNewName("");
    if (level === "subsystem") {
      setSelectedSystemId(parent.id);
    }
    if (level === "module") {
      setSelectedSubsystemId(parent.id);
    }
    if (level === "unit") {
      setSelectedModuleId(parent.id);
    }
    if (level === "component") {
      setSelectedUnitId(parent.id);
    }
    addSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const validateAssignment = () => {
    if (!validateSystemId || !validateSubsystemId) {
      setValidationResult({
        valid: false,
        message: "Select a system and subsystem to validate the relationship.",
      });
      return;
    }
    const subsystem = grouped.subsystem.find((item) => item.id === validateSubsystemId);
    const valid = subsystem?.parent_id === validateSystemId;
    setValidationResult({
      valid: !!valid,
      message: valid
        ? "This subsystem belongs to the selected system."
        : "This subsystem is not connected to that system.",
    });
  };

  const systemOptions = grouped.system;
  const subsystemOptions = grouped.subsystem.filter((item) => item.parent_id === selectedSystemId);
  const moduleOptions = grouped.module.filter((item) => item.parent_id === selectedSubsystemId);
  const unitOptions = grouped.unit.filter((item) => item.parent_id === selectedModuleId);

  const renderTree = () => {
    if (loading) {
      return <p className="text-sm text-muted-foreground">Loading hierarchy...</p>;
    }

    if (hierarchies.length === 0) {
      return <p className="text-sm text-muted-foreground">No hierarchy items found yet.</p>;
    }

    return grouped.system.map((system) => (
      <Card key={system.id} className="shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-card-foreground">{system.name}</div>
              <div className="text-xs text-muted-foreground">System</div>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-primary"
                onClick={() => openEditDialog(system)}
                aria-label="Edit system"
              >
                <Edit className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                onClick={() => prepareAddChild("subsystem", system)}
                aria-label="Add subsystem"
              >
                <Plus className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                onClick={() => prepareDelete(system)}
                aria-label="Delete system"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            {grouped.subsystem.filter((sub) => sub.parent_id === system.id).length === 0 ? (
              <p className="text-sm text-muted-foreground">No subsystems defined.</p>
            ) : (
              grouped.subsystem
                .filter((sub) => sub.parent_id === system.id)
                .map((subsystem) => (
                  <Card key={subsystem.id} className="border border-border bg-muted">
                    <CardContent className="space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold">{subsystem.name}</div>
                          <div className="text-xs text-muted-foreground">Subsystem</div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-primary"
                            onClick={() => openEditDialog(subsystem)}
                            aria-label="Edit subsystem"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            onClick={() => prepareAddChild("module", subsystem)}
                            aria-label="Add module"
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            onClick={() => prepareDelete(subsystem)}
                            aria-label="Delete subsystem"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <div className="space-y-2">
                        {grouped.module.filter((module) => module.parent_id === subsystem.id).length === 0 ? (
                          <p className="text-xs text-muted-foreground">No modules defined.</p>
                        ) : (
                          grouped.module
                            .filter((module) => module.parent_id === subsystem.id)
                            .map((module) => (
                              <Card key={module.id} className="border border-border bg-background">
                                <CardContent className="space-y-3">
                                  <div className="flex items-center justify-between gap-3">
                                    <div>
                                      <div className="text-sm font-semibold">{module.name}</div>
                                      <div className="text-xs text-muted-foreground">Module</div>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-muted-foreground hover:text-primary"
                                        onClick={() => openEditDialog(module)}
                                        aria-label="Edit module"
                                      >
                                        <Edit className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                        onClick={() => prepareAddChild("unit", module)}
                                        aria-label="Add unit"
                                      >
                                        <Plus className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                        onClick={() => prepareDelete(module)}
                                        aria-label="Delete module"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  </div>
                                  {grouped.unit.filter((unit) => unit.parent_id === module.id).length === 0 ? (
                                    <p className="text-xs text-muted-foreground">No units defined.</p>
                                  ) : (
                                    grouped.unit
                                      .filter((unit) => unit.parent_id === module.id)
                                      .map((unit) => (
                                        <div key={unit.id} className="rounded-lg border border-border bg-muted p-3">
                                          <div className="flex items-center justify-between gap-3">
                                            <div>
                                              <div className="text-sm font-semibold">{unit.name}</div>
                                              <div className="text-xs text-muted-foreground">Unit</div>
                                            </div>
                                            <div className="flex items-center gap-1">
                                              <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-muted-foreground hover:text-primary"
                                                onClick={() => openEditDialog(unit)}
                                                aria-label="Edit unit"
                                              >
                                                <Edit className="h-4 w-4" />
                                              </Button>
                                              <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                                onClick={() => prepareAddChild("component", unit)}
                                                aria-label="Add component"
                                              >
                                                <Plus className="h-4 w-4" />
                                              </Button>
                                              <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                                onClick={() => prepareDelete(unit)}
                                                aria-label="Delete unit"
                                              >
                                                <Trash2 className="h-4 w-4" />
                                              </Button>
                                            </div>
                                          </div>
                                          {grouped.component.filter((component) => component.parent_id === unit.id).length === 0 ? (
                                            <p className="text-xs text-muted-foreground">No components defined.</p>
                                          ) : (
                                            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                                              {grouped.component
                                                .filter((component) => component.parent_id === unit.id)
                                                .map((component) => (
                                                  <Badge
                                                    key={component.id}
                                                    className="flex items-center justify-between gap-2"
                                                  >
                                                    <span>{component.name}</span>
                                                    <div className="flex items-center gap-1">
                                                      <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-6 w-6 text-muted-foreground hover:text-primary"
                                                        onClick={() => openEditDialog(component)}
                                                        aria-label="Edit component"
                                                      >
                                                        <Edit className="h-3.5 w-3.5" />
                                                      </Button>
                                                      <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-6 w-6 text-muted-foreground hover:text-destructive"
                                                        onClick={() => prepareDelete(component)}
                                                      >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                      </Button>
                                                    </div>
                                                  </Badge>
                                                ))}
                                            </div>
                                          )}
                                        </div>
                                      ))
                                  )}
                                </CardContent>
                              </Card>
                            ))
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))
            )}
          </div>
        </CardContent>
      </Card>
    ));
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Systems Hierarchy</h1>
        <p className="text-sm text-muted-foreground">
          Manage the complete system → subsystem → module → unit → component hierarchy.
        </p>
      </div>

      <div ref={addSectionRef}>
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold text-card-foreground">
              Add Hierarchy Item
            </CardTitle>
          </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Hierarchy Level</Label>
              <Select value={selectedLevel} onValueChange={(value) => {
                const level = value as HierarchyLevel;
                setSelectedLevel(level);
                resetChildSelection(level);
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select level" />
                </SelectTrigger>
                <SelectContent>
                  {HIERARCHY_LEVELS.map((option) => (
                    <SelectItem key={option.key} value={option.key}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedLevel !== "system" && (
              <div className="space-y-2">
                <Label>{getHierarchyLabel(PARENT_LEVEL[selectedLevel] as HierarchyLevel)}</Label>
                <Select
                  value={String(currentParentId ?? "0")}
                  onValueChange={(value) => {
                    const id = value !== "0" ? parseInt(value, 10) : null;
                    if (selectedLevel === "subsystem") setSelectedSystemId(id);
                    if (selectedLevel === "module") setSelectedSubsystemId(id);
                    if (selectedLevel === "unit") setSelectedModuleId(id);
                    if (selectedLevel === "component") setSelectedUnitId(id);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={`Select ${getHierarchyLabel(PARENT_LEVEL[selectedLevel] as HierarchyLevel)}`} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">None</SelectItem>
                    {(selectedLevel === "subsystem" ? grouped.system :
                      selectedLevel === "module" ? grouped.subsystem :
                      selectedLevel === "unit" ? grouped.module :
                      selectedLevel === "component" ? grouped.unit :
                      []).map((item) => (
                      <SelectItem key={item.id} value={item.id.toString()}>
                        {item.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2 md:col-span-2">
              <Label>{getHierarchyLabel(selectedLevel)} Name</Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={`e.g. Primary ${getHierarchyLabel(selectedLevel)}`}
              />
            </div>

            <div className="md:col-span-2 flex flex-col gap-3">
              <Button onClick={handleCreateHierarchy} disabled={saving}>
                <Plus className="mr-2 h-4 w-4" />
                {saving ? "Saving..." : `Create ${getHierarchyLabel(selectedLevel)}`}
              </Button>
              {validationResult && (
                <div className={`rounded-lg border p-3 text-sm ${validationResult.valid ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-800"}`}>
                  {validationResult.message}
                </div>
              )}
            </div>
          </div>
          </CardContent>
      </Card>
      </div>

      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold text-card-foreground">
            Hierarchy Validator
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>System</Label>
              <Select value={String(validateSystemId ?? "0")} onValueChange={(value) => setValidateSystemId(value !== "0" ? parseInt(value, 10) : null)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select system" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">None</SelectItem>
                  {grouped.system.map((system) => (
                    <SelectItem key={system.id} value={system.id.toString()}>
                      {system.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Subsystem</Label>
              <Select value={String(validateSubsystemId ?? "0")}
                onValueChange={(value) => setValidateSubsystemId(value !== "0" ? parseInt(value, 10) : null)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select subsystem" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">None</SelectItem>
                  {grouped.subsystem.map((subsystem) => (
                    <SelectItem key={subsystem.id} value={subsystem.id.toString()}>
                      {subsystem.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button onClick={validateAssignment}>Validate</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Confirm delete</DialogTitle>
            <DialogDescription>
              Delete "{deleteTarget?.name}" and all its descendants from the hierarchy.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-sm text-muted-foreground">
              This action cannot be undone. Are you sure you want to continue?
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={confirmDelete}>
                Delete
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={(open) => {
        setEditOpen(open);
        if (!open) {
          setEditTarget(null);
          setEditName("");
        }
      }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Hierarchy Item</DialogTitle>
            <DialogDescription>
              Update the name for this hierarchy item.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
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

      <div className="grid gap-4">
        {renderTree()}
      </div>
    </div>
  );
}
