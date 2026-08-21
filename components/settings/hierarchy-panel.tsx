"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Edit, Search, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Can } from "@/components/auth/can";
import { P } from "@/lib/permission-codes";
import { toast } from "sonner";
import * as api from "@/lib/api";
import type { Hierarchy } from "@/lib/models";
import { JsonBatchUploadButton } from "@/components/settings/json-batch-upload-button";
import { EntityListImportButton } from "@/components/settings/entity-list-import-button";
import { EntityListExportButton } from "@/components/settings/entity-list-export-button";
import { useAppDefinitions } from "@/lib/app-definitions-context";
import { SortableTableHead } from "@/components/data-table/sortable-table-head";
import { useTableSorting } from "@/hooks/use-table-sorting";
import { EntityListPagination } from "@/components/entity-list-pagination";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { cn } from "@/lib/utils";

const HIERARCHY_LEVEL_KEYS = [
  "system",
  "subsystem",
  "module",
  "unit",
  "component",
] as const;

type HierarchyLevel = (typeof HIERARCHY_LEVEL_KEYS)[number];

const PARENT_LEVEL: Record<HierarchyLevel, HierarchyLevel | null> = {
  system: null,
  subsystem: "system",
  module: "subsystem",
  unit: "module",
  component: "unit",
};

const LEVEL_COLOR: Record<HierarchyLevel, string> = {
  system:    "bg-blue-100 text-blue-800 border-blue-200",
  subsystem: "bg-purple-100 text-purple-800 border-purple-200",
  module:    "bg-amber-100 text-amber-800 border-amber-200",
  unit:      "bg-emerald-100 text-emerald-800 border-emerald-200",
  component: "bg-rose-100 text-rose-800 border-rose-200",
};

const PAGE_SIZE = 20;

function buildHierarchyTree(entries: Hierarchy[]) {
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

export type HierarchyPanelProps = {
  embedded?: boolean;
  variant?: "hierarchy" | "entity-list";
  readOnly?: boolean;
};

export function HierarchyPanel({
  embedded = false,
  variant = "hierarchy",
  readOnly = false,
}: HierarchyPanelProps) {
  const isEntityList = variant === "entity-list";
  const queryClient = useQueryClient();
  const { entityLabel } = useAppDefinitions();

  const invalidateEntityList = () => {
    void queryClient.invalidateQueries({ queryKey: ["hierarchies"] });
  };

  // ── Data ────────────────────────────────────────────────────────────────────
  const [hierarchies, setHierarchies] = useState<Hierarchy[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await api.hierarchies.list();
      setHierarchies(res.data ?? []);
    } catch {
      toast.error("Failed to load entity list");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadData(); }, []);

  // ── Flat-table state (entity-list mode) ─────────────────────────────────────
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search);
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const { sort, cycleSort } = useTableSorting();
  const [page, setPage] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  // ── Add-form state ───────────────────────────────────────────────────────────
  const [selectedLevel, setSelectedLevel] = useState<HierarchyLevel>("system");
  const [newName, setNewName] = useState("");
  const [newAbbr, setNewAbbr] = useState("");
  const addSectionRef = useRef<HTMLDivElement | null>(null);

  // ── Legacy-tree state (hierarchy mode) ───────────────────────────────────────
  const [selectedSystemId, setSelectedSystemId] = useState<number | null>(null);
  const [selectedSubsystemId, setSelectedSubsystemId] = useState<number | null>(null);
  const [selectedModuleId, setSelectedModuleId] = useState<number | null>(null);
  const [selectedUnitId, setSelectedUnitId] = useState<number | null>(null);

  // ── Edit / delete dialogs ────────────────────────────────────────────────────
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Hierarchy | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Hierarchy | null>(null);
  const [editName, setEditName] = useState("");
  const [editAbbr, setEditAbbr] = useState("");
  const [addOpen, setAddOpen] = useState(false);

  // ── Validation feedback ──────────────────────────────────────────────────────
  const [validationResult, setValidationResult] = useState<{ valid: boolean; message: string } | null>(null);
  const [validateSystemId, setValidateSystemId] = useState<number | null>(null);
  const [validateSubsystemId, setValidateSubsystemId] = useState<number | null>(null);

  const grouped = useMemo(() => buildHierarchyTree(hierarchies), [hierarchies]);

  // ── Duplicate detection ──────────────────────────────────────────────────────
  const duplicateIds = useMemo(() => {
    const seen = new Map<string, number[]>();
    for (const entry of hierarchies) {
      const key = `${entry.hierarchy_type}:${entry.name.trim().toLowerCase()}`;
      const ids = seen.get(key) ?? [];
      ids.push(entry.id);
      seen.set(key, ids);
    }
    const dupes = new Set<number>();
    for (const ids of seen.values()) {
      if (ids.length > 1) ids.forEach((id) => dupes.add(id));
    }
    return dupes;
  }, [hierarchies]);

  // ── Filtered + sorted list (entity-list mode) ────────────────────────────────
  const filteredSorted = useMemo(() => {
    let items = [...hierarchies];

    if (typeFilter !== "all") {
      items = items.filter((h) => h.hierarchy_type === typeFilter);
    }
    if (debouncedSearch.trim()) {
      const q = debouncedSearch.trim().toLowerCase();
      items = items.filter(
        (h) =>
          h.name.toLowerCase().includes(q) ||
          (h.abbreviation ?? "").toLowerCase().includes(q) ||
          h.hierarchy_type.toLowerCase().includes(q)
      );
    }

    // Sort
    if (sort.sortBy) {
      items.sort((a, b) => {
        let va = "";
        let vb = "";
        if (sort.sortBy === "name") { va = a.name; vb = b.name; }
        else if (sort.sortBy === "abbreviation") { va = a.abbreviation ?? ""; vb = b.abbreviation ?? ""; }
        else if (sort.sortBy === "hierarchy_type") { va = a.hierarchy_type; vb = b.hierarchy_type; }
        else if (sort.sortBy === "created_at") { va = a.created_at; vb = b.created_at; }
        const cmp = va.localeCompare(vb);
        return sort.sortOrder === "desc" ? -cmp : cmp;
      });
    }

    return items;
  }, [hierarchies, typeFilter, debouncedSearch, sort]);

  // Reset page + selection on filter/search change
  useEffect(() => {
    setPage(0);
    setSelectedIds(new Set());
  }, [typeFilter, debouncedSearch, sort]);

  const totalPages = Math.max(1, Math.ceil(filteredSorted.length / PAGE_SIZE));
  const pagedItems = filteredSorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const rangeStart = filteredSorted.length === 0 ? 0 : page * PAGE_SIZE + 1;
  const rangeEnd = Math.min((page + 1) * PAGE_SIZE, filteredSorted.length);
  const rangeLabel = filteredSorted.length === 0 ? "0" : `${rangeStart}–${rangeEnd}`;

  const filteredIds = useMemo(
    () => filteredSorted.map((item) => item.id),
    [filteredSorted]
  );
  const selectedCount = selectedIds.size;
  const allFilteredSelected =
    filteredIds.length > 0 && filteredIds.every((id) => selectedIds.has(id));
  const someFilteredSelected = filteredIds.some((id) => selectedIds.has(id));

  // ── Type-badge counts ────────────────────────────────────────────────────────
  const countByType = useMemo(() => {
    const counts: Record<string, number> = { all: hierarchies.length };
    for (const h of hierarchies) {
      counts[h.hierarchy_type] = (counts[h.hierarchy_type] ?? 0) + 1;
    }
    return counts;
  }, [hierarchies]);

  // ── CRUD helpers ─────────────────────────────────────────────────────────────
  const currentParentId = (() => {
    switch (selectedLevel) {
      case "subsystem": return selectedSystemId;
      case "module":    return selectedSubsystemId;
      case "unit":      return selectedModuleId;
      case "component": return selectedUnitId;
      default:          return undefined;
    }
  })();

  const resetChildSelection = (level: HierarchyLevel) => {
    if (level === "system")     { setSelectedSubsystemId(null); setSelectedModuleId(null); setSelectedUnitId(null); }
    if (level === "subsystem")  { setSelectedModuleId(null); setSelectedUnitId(null); }
    if (level === "module")     { setSelectedUnitId(null); }
  };

  const handleCreate = async () => {
    if (!newName.trim()) {
      setValidationResult({ valid: false, message: "Name is required." });
      return;
    }
    if (selectedLevel !== "system" && !currentParentId) {
      setValidationResult({ valid: false, message: `Select a parent ${entityLabel(PARENT_LEVEL[selectedLevel] as HierarchyLevel)}.` });
      return;
    }
    setSaving(true);
    try {
      await api.hierarchies.create({
        name: newName.trim(),
        hierarchy_type: selectedLevel,
        abbreviation: newAbbr.trim() || undefined,
        parent_id: currentParentId ?? undefined,
      });
      await loadData();
      invalidateEntityList();
      setNewName("");
      setNewAbbr("");
      setValidationResult({ valid: true, message: `${entityLabel(selectedLevel)} added successfully.` });
      setAddOpen(false);
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setValidationResult({ valid: false, message: detail ?? "Failed to create entity." });
    } finally {
      setSaving(false);
    }
  };

  const handleBatchUpload = async (items: unknown[]) => {
    const validTypes = new Set(HIERARCHY_LEVEL_KEYS);
    const payloads: Array<{ name: string; hierarchy_type: string; abbreviation?: string; description?: string | null; parent_id?: number | null }> = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item || typeof item !== "object") throw new Error(`Item at index ${i} must be an object.`);
      const r = item as Record<string, unknown>;
      const name = typeof r.name === "string" ? r.name.trim() : "";
      const ht = typeof r.hierarchy_type === "string" ? r.hierarchy_type.trim() : "";
      if (!name) throw new Error(`Item ${i}: missing name.`);
      if (!validTypes.has(ht as HierarchyLevel)) throw new Error(`Item ${i}: invalid hierarchy_type "${ht}". Expected one of: ${HIERARCHY_LEVEL_KEYS.join(", ")}.`);
      let parentId: number | null | undefined;
      if ("parent_id" in r) {
        if (r.parent_id === null || r.parent_id === undefined) parentId = null;
        else if (typeof r.parent_id === "number" && Number.isFinite(r.parent_id)) parentId = r.parent_id;
        else throw new Error(`Item ${i}: invalid parent_id.`);
      }
      payloads.push({
        name,
        hierarchy_type: ht,
        abbreviation: typeof r.abbreviation === "string" && r.abbreviation.trim() ? r.abbreviation.trim().toUpperCase() : undefined,
        description: typeof r.description === "string" ? r.description : null,
        parent_id: parentId,
      });
    }

    await api.hierarchies.batchCreate(payloads);
    await loadData();
    invalidateEntityList();
    toast.success(`Imported ${payloads.length} entit${payloads.length === 1 ? "y" : "ies"} successfully`);
  };

  const prepareDelete = (item: Hierarchy) => { setDeleteTarget(item); setDeleteConfirmOpen(true); };

  const toggleRowSelected = (id: number, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const toggleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(filteredIds));
      return;
    }
    setSelectedIds(new Set());
  };

  const clearSelection = () => setSelectedIds(new Set());

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.hierarchies.delete(deleteTarget.id);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(deleteTarget.id);
        return next;
      });
      await loadData();
      invalidateEntityList();
      toast.success("Entity deleted");
    } catch {
      toast.error("Failed to delete entity");
    } finally {
      setDeleteConfirmOpen(false);
      setDeleteTarget(null);
    }
  };

  const confirmBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setBulkDeleting(true);
    try {
      const results = await Promise.allSettled(
        ids.map((id) => api.hierarchies.delete(id))
      );
      const failed = results.filter((r) => r.status === "rejected").length;
      const deleted = ids.length - failed;
      await loadData();
      invalidateEntityList();
      clearSelection();
      if (failed === 0) {
        toast.success(`Deleted ${deleted} entit${deleted === 1 ? "y" : "ies"}`);
      } else if (deleted === 0) {
        toast.error("Failed to delete selected entities");
      } else {
        toast.error(`Deleted ${deleted}, failed ${failed}`);
      }
    } catch {
      toast.error("Failed to delete selected entities");
    } finally {
      setBulkDeleting(false);
      setBulkDeleteOpen(false);
    }
  };

  const openEdit = (item: Hierarchy) => {
    setEditTarget(item);
    setEditName(item.name);
    setEditAbbr(item.abbreviation ?? "");
    setEditOpen(true);
  };

  const handleEditSave = async () => {
    if (!editTarget || !editName.trim()) { toast.error("Name cannot be empty"); return; }
    try {
      await api.hierarchies.update(editTarget.id, {
        name: editName.trim(),
        abbreviation: editAbbr.trim() || undefined,
      });
      await loadData();
      invalidateEntityList();
      toast.success("Entity updated");
      setEditOpen(false);
      setEditTarget(null);
    } catch {
      toast.error("Failed to update entity");
    }
  };

  // ── Legacy tree helpers (hierarchy mode) ─────────────────────────────────────
  const prepareAddChild = (level: HierarchyLevel, parent: Hierarchy) => {
    setSelectedLevel(level);
    setNewName("");
    if (level === "subsystem") setSelectedSystemId(parent.id);
    if (level === "module")    setSelectedSubsystemId(parent.id);
    if (level === "unit")      setSelectedModuleId(parent.id);
    if (level === "component") setSelectedUnitId(parent.id);
    addSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const validateAssignment = () => {
    if (!validateSystemId || !validateSubsystemId) {
      setValidationResult({ valid: false, message: "Select a system and subsystem to validate." });
      return;
    }
    const sub = grouped.subsystem.find((s) => s.id === validateSubsystemId);
    const valid = sub?.parent_id === validateSystemId;
    setValidationResult({
      valid: !!valid,
      message: valid ? "This subsystem belongs to the selected system." : "This subsystem is not connected to that system.",
    });
  };

  // ────────────────────────────────────────────────────────────────────────────
  // ENTITY-LIST MODE render
  // ────────────────────────────────────────────────────────────────────────────
  if (isEntityList) {
    const duplicateCount = duplicateIds.size;

    return (
      <div className="space-y-6">
        {/* Header */}
        {!embedded && (
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Entity List</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Master catalog of entity names and categories. Only items listed here can be used in configurations and inventory.
            </p>
          </div>
        )}

        {/* Duplicate warning banner */}
        {duplicateCount > 0 && (
          <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              <strong>{duplicateCount} duplicate {duplicateCount === 1 ? "entry" : "entries"} detected</strong> — rows highlighted in amber share the same name and type. Review and remove duplicates to avoid conflicts.
            </span>
          </div>
        )}

        {/* Type filter badges */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground mr-1">Filter:</span>
          {(["all", ...HIERARCHY_LEVEL_KEYS] as const).map((type) => (
            <button
              key={type}
              onClick={() => setTypeFilter(type)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                typeFilter === type
                  ? "bg-foreground text-background border-foreground"
                  : "border-border bg-background text-muted-foreground hover:bg-muted"
              )}
            >
              {type === "all" ? "All" : entityLabel(type)}
              <span className={cn(
                "rounded-full px-1.5 py-0.5 tabular-nums text-[10px]",
                typeFilter === type ? "bg-background/20 text-background" : "bg-muted text-muted-foreground"
              )}>
                {countByType[type] ?? 0}
              </span>
            </button>
          ))}
          {typeFilter !== "all" && (
            <button
              onClick={() => setTypeFilter("all")}
              className="text-xs text-muted-foreground underline-offset-2 hover:underline ml-1"
            >
              Clear
            </button>
          )}
        </div>

        {/* Search + actions */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, acronym or type…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {!readOnly && selectedCount > 0 && (
              <Can permission={P.delete_hierarchy}>
                <div className="flex items-center gap-2 mr-1">
                  <span className="text-sm text-muted-foreground">
                    {selectedCount} selected
                  </span>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setBulkDeleteOpen(true)}
                    disabled={bulkDeleting}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete selected
                  </Button>
                  <Button variant="ghost" size="sm" onClick={clearSelection}>
                    Clear
                  </Button>
                </div>
              </Can>
            )}
            <Can role="Admin">
              <EntityListExportButton />
            </Can>
            {!readOnly && (
              <>
                <Can permission={P.create_hierarchy}>
                  <EntityListImportButton
                    onImported={async () => {
                      await loadData();
                      invalidateEntityList();
                      clearSelection();
                    }}
                  />
                </Can>
                <Can permission={P.create_hierarchy}>
                  <Button onClick={() => { setNewName(""); setNewAbbr(""); setValidationResult(null); setAddOpen(true); }}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Entity
                  </Button>
                </Can>
              </>
            )}
          </div>
        </div>

        {/* Table */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              {typeFilter === "all" ? "All Entities" : `${entityLabel(typeFilter)} entities`}
            </CardTitle>
            <CardDescription>
              Showing {rangeLabel} of {filteredSorted.length}
              {filteredSorted.length !== hierarchies.length && ` (${hierarchies.length} total)`}
              {duplicateCount > 0 && (
                <span className="ml-2 text-amber-600 font-medium">· {duplicateCount} duplicates highlighted</span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {!readOnly ? (
                      <TableHead className="w-10 pl-4">
                        <Can permission={P.delete_hierarchy}>
                          <Checkbox
                            checked={
                              allFilteredSelected
                                ? true
                                : someFilteredSelected
                                  ? "indeterminate"
                                  : false
                            }
                            onCheckedChange={(checked) =>
                              toggleSelectAll(checked === true)
                            }
                            aria-label="Select all matching entities"
                            disabled={filteredSorted.length === 0 || loading}
                          />
                        </Can>
                      </TableHead>
                    ) : null}
                    <TableHead className="w-12 text-center">#</TableHead>
                    <SortableTableHead column="name" sort={sort} onSort={cycleSort}>Entity Name</SortableTableHead>
                    <SortableTableHead column="abbreviation" sort={sort} onSort={cycleSort}>Acronym</SortableTableHead>
                    <SortableTableHead column="hierarchy_type" sort={sort} onSort={cycleSort}>Entity Type</SortableTableHead>
                    <SortableTableHead column="created_at" sort={sort} onSort={cycleSort}>Date Created</SortableTableHead>
                    <TableHead className="text-right pr-4">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={readOnly ? 6 : 7} className="py-10 text-center text-muted-foreground">
                        Loading…
                      </TableCell>
                    </TableRow>
                  ) : pagedItems.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={readOnly ? 6 : 7} className="py-10 text-center text-muted-foreground">
                        {hierarchies.length === 0
                          ? "No entities defined yet. Click \"Add Entity\" to get started, or import a CSV or Excel file."
                          : "No entities match your search."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    pagedItems.map((item, idx) => {
                      const isDuplicate = duplicateIds.has(item.id);
                      const globalIdx = page * PAGE_SIZE + idx + 1;
                      const levelKey = item.hierarchy_type as HierarchyLevel;
                      const isSelected = selectedIds.has(item.id);
                      return (
                        <TableRow
                          key={item.id}
                          className={cn(
                            isDuplicate && "bg-amber-50 dark:bg-amber-950/30",
                            isSelected && "bg-muted/50"
                          )}
                          data-state={isSelected ? "selected" : undefined}
                        >
                          {!readOnly ? (
                            <TableCell className="pl-4">
                              <Can permission={P.delete_hierarchy}>
                                <Checkbox
                                  checked={isSelected}
                                  onCheckedChange={(checked) =>
                                    toggleRowSelected(item.id, checked === true)
                                  }
                                  aria-label={`Select ${item.name}`}
                                />
                              </Can>
                            </TableCell>
                          ) : null}
                          <TableCell className="text-center text-muted-foreground tabular-nums text-xs">
                            {globalIdx}
                          </TableCell>
                          <TableCell className="font-medium">
                            <span className="flex items-center gap-2">
                              {item.name}
                              {isDuplicate && (
                                <span title="Duplicate name for this type">
                                  <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                                </span>
                              )}
                            </span>
                          </TableCell>
                          <TableCell>
                            {item.abbreviation ? (
                              <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
                                {item.abbreviation}
                              </code>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <span className={cn(
                              "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize",
                              LEVEL_COLOR[levelKey] ?? "bg-muted text-muted-foreground"
                            )}>
                              {entityLabel(item.hierarchy_type)}
                            </span>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {item.created_at
                              ? new Date(item.created_at).toLocaleDateString()
                              : "—"}
                          </TableCell>
                          <TableCell className="text-right pr-4">
                            <div className="flex items-center justify-end gap-1">
                              {!readOnly && (
                                <>
                                  <Can permission={P.edit_hierarchy}>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 text-muted-foreground hover:text-primary"
                                      onClick={() => openEdit(item)}
                                      title="Edit"
                                    >
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                  </Can>
                                  <Can permission={P.delete_hierarchy}>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                      onClick={() => prepareDelete(item)}
                                      title="Delete"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </Can>
                                </>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
            <div className="px-6 pb-4">
              <EntityListPagination
                page={page}
                totalPages={totalPages}
                total={filteredSorted.length}
                rangeLabel={rangeLabel}
                hasPrev={page > 0}
                hasNext={page < totalPages - 1}
                onPrev={() => setPage((p) => Math.max(0, p - 1))}
                onNext={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                loading={loading}
              />
            </div>
          </CardContent>
        </Card>

        {/* Add Entity dialog */}
        {!readOnly && (
          <Dialog open={addOpen} onOpenChange={(open) => { setAddOpen(open); if (!open) { setNewName(""); setNewAbbr(""); setValidationResult(null); } }}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Add Entity</DialogTitle>
                <DialogDescription>
                  Register a new entity name and type. Added entities become available in configurations and inventory.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-1">
                <div className="space-y-2">
                  <Label htmlFor="add-entity-type">Entity Type *</Label>
                  <Select
                    value={selectedLevel}
                    onValueChange={(v) => { setSelectedLevel(v as HierarchyLevel); resetChildSelection(v as HierarchyLevel); }}
                  >
                    <SelectTrigger id="add-entity-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {HIERARCHY_LEVEL_KEYS.map((key) => (
                        <SelectItem key={key} value={key}>
                          {entityLabel(key)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="add-entity-name">Entity Name *</Label>
                  <Input
                    id="add-entity-name"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g. Antenna Pedestal"
                    onKeyDown={(e) => { if (e.key === "Enter") void handleCreate(); }}
                    autoFocus
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="add-entity-abbr">Acronym / Abbreviation</Label>
                  <Input
                    id="add-entity-abbr"
                    value={newAbbr}
                    onChange={(e) => setNewAbbr(e.target.value.toUpperCase())}
                    placeholder="e.g. AP"
                    className="font-mono uppercase"
                  />
                </div>

                {validationResult && !validationResult.valid && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                    {validationResult.message}
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
                  <Button onClick={() => void handleCreate()} disabled={saving}>
                    {saving ? "Saving…" : `Add ${entityLabel(selectedLevel)}`}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}

        {/* Dialogs */}
        <ConfirmDialog
          open={deleteConfirmOpen}
          onOpenChange={(open) => { setDeleteConfirmOpen(open); if (!open) setDeleteTarget(null); }}
          title="Delete entity"
          description={`Delete "${deleteTarget?.name ?? "item"}" from the Entity List? This may affect configurations and inventory that use this name.`}
          onConfirm={() => void confirmDelete()}
        />

        <ConfirmDialog
          open={bulkDeleteOpen}
          onOpenChange={(open) => {
            if (bulkDeleting) return;
            setBulkDeleteOpen(open);
          }}
          title="Delete selected entities"
          description={`Delete ${selectedCount} selected entit${selectedCount === 1 ? "y" : "ies"} from the Entity List? This may affect configurations and inventory that use these names.`}
          onConfirm={() => void confirmBulkDelete()}
        />

        <Dialog open={editOpen} onOpenChange={(open) => { setEditOpen(open); if (!open) { setEditTarget(null); setEditName(""); setEditAbbr(""); } }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Edit Entity</DialogTitle>
              <DialogDescription>Update the name and acronym for this entity.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>Entity Name</Label>
                <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Acronym / Abbreviation</Label>
                <Input
                  className="font-mono uppercase"
                  value={editAbbr}
                  onChange={(e) => setEditAbbr(e.target.value.toUpperCase())}
                  placeholder="e.g. AP"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
                <Button onClick={() => void handleEditSave()}>Save</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // ────────────────────────────────────────────────────────────────────────────
  // LEGACY HIERARCHY-TREE MODE (unchanged functionality)
  // ────────────────────────────────────────────────────────────────────────────
  const renderTree = () => {
    if (loading) return <p className="text-sm text-muted-foreground">Loading hierarchy…</p>;
    if (hierarchies.length === 0) return <p className="text-sm text-muted-foreground">No hierarchy items found yet.</p>;

    return grouped.system.map((system) => (
      <Card key={system.id} className="shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-card-foreground">{system.name}</div>
              <div className="text-xs text-muted-foreground">{entityLabel("system")}</div>
            </div>
            <div className="flex items-center gap-1">
              <Can permission={P.edit_hierarchy}>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(system)}><Edit className="h-4 w-4" /></Button>
              </Can>
              <Can permission={P.create_hierarchy}>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => prepareAddChild("subsystem", system)}><Plus className="h-4 w-4" /></Button>
              </Can>
              <Can permission={P.delete_hierarchy}>
                <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-destructive" onClick={() => prepareDelete(system)}><Trash2 className="h-4 w-4" /></Button>
              </Can>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {grouped.subsystem.filter((s) => s.parent_id === system.id).length === 0
            ? <p className="text-sm text-muted-foreground">No subsystems defined.</p>
            : grouped.subsystem.filter((s) => s.parent_id === system.id).map((sub) => (
              <Card key={sub.id} className="border border-border bg-muted">
                <CardContent className="space-y-3 pt-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold">{sub.name}</div>
                      <div className="text-xs text-muted-foreground">{entityLabel("subsystem")}</div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Can permission={P.edit_hierarchy}><Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(sub)}><Edit className="h-4 w-4" /></Button></Can>
                      <Can permission={P.create_hierarchy}><Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => prepareAddChild("module", sub)}><Plus className="h-4 w-4" /></Button></Can>
                      <Can permission={P.delete_hierarchy}><Button variant="ghost" size="icon" className="h-8 w-8 hover:text-destructive" onClick={() => prepareDelete(sub)}><Trash2 className="h-4 w-4" /></Button></Can>
                    </div>
                  </div>
                  {grouped.module.filter((m) => m.parent_id === sub.id).map((mod) => (
                    <Card key={mod.id} className="border border-border bg-background">
                      <CardContent className="space-y-3 pt-3">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold">{mod.name}</div>
                            <div className="text-xs text-muted-foreground">{entityLabel("module")}</div>
                          </div>
                          <div className="flex items-center gap-1">
                            <Can permission={P.edit_hierarchy}><Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(mod)}><Edit className="h-4 w-4" /></Button></Can>
                            <Can permission={P.create_hierarchy}><Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => prepareAddChild("unit", mod)}><Plus className="h-4 w-4" /></Button></Can>
                            <Can permission={P.delete_hierarchy}><Button variant="ghost" size="icon" className="h-8 w-8 hover:text-destructive" onClick={() => prepareDelete(mod)}><Trash2 className="h-4 w-4" /></Button></Can>
                          </div>
                        </div>
                        {grouped.unit.filter((u) => u.parent_id === mod.id).map((unit) => (
                          <div key={unit.id} className="rounded-lg border border-border bg-muted p-3">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <div className="text-sm font-semibold">{unit.name}</div>
                                <div className="text-xs text-muted-foreground">{entityLabel("unit")}</div>
                              </div>
                              <div className="flex items-center gap-1">
                                <Can permission={P.edit_hierarchy}><Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(unit)}><Edit className="h-4 w-4" /></Button></Can>
                                <Can permission={P.create_hierarchy}><Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => prepareAddChild("component", unit)}><Plus className="h-4 w-4" /></Button></Can>
                                <Can permission={P.delete_hierarchy}><Button variant="ghost" size="icon" className="h-8 w-8 hover:text-destructive" onClick={() => prepareDelete(unit)}><Trash2 className="h-4 w-4" /></Button></Can>
                              </div>
                            </div>
                            <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
                              {grouped.component.filter((c) => c.parent_id === unit.id).map((comp) => (
                                <Badge key={comp.id} className="flex items-center justify-between gap-2">
                                  <span>{comp.name}</span>
                                  <div className="flex items-center gap-1">
                                    <Can permission={P.edit_hierarchy}><Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openEdit(comp)}><Edit className="h-3.5 w-3.5" /></Button></Can>
                                    <Can permission={P.delete_hierarchy}><Button variant="ghost" size="icon" className="h-6 w-6 hover:text-destructive" onClick={() => prepareDelete(comp)}><Trash2 className="h-3.5 w-3.5" /></Button></Can>
                                  </div>
                                </Badge>
                              ))}
                            </div>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  ))}
                </CardContent>
              </Card>
            ))
          }
        </CardContent>
      </Card>
    ));
  };

  return (
    <div className="space-y-6">
      {!embedded && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Systems Hierarchy</h1>
            <p className="text-sm text-muted-foreground">Manage the system → subsystem → module → unit → component hierarchy.</p>
          </div>
          {!readOnly && <Can permission={P.create_hierarchy}><JsonBatchUploadButton onUpload={handleBatchUpload} /></Can>}
        </div>
      )}
      {embedded && !readOnly && (
        <Can permission={P.create_hierarchy}>
          <div className="flex justify-end"><JsonBatchUploadButton onUpload={handleBatchUpload} /></div>
        </Can>
      )}

      {!readOnly && (
        <Can permission={P.create_hierarchy}>
          <div ref={addSectionRef}>
            <Card className="shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold">Add Hierarchy Item</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Level</Label>
                    <Select value={selectedLevel} onValueChange={(v) => { setSelectedLevel(v as HierarchyLevel); resetChildSelection(v as HierarchyLevel); }}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {HIERARCHY_LEVEL_KEYS.map((k) => <SelectItem key={k} value={k}>{entityLabel(k)}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  {selectedLevel !== "system" && (
                    <div className="space-y-2">
                      <Label>Parent {entityLabel(PARENT_LEVEL[selectedLevel] as HierarchyLevel)}</Label>
                      <Select
                        value={String(currentParentId ?? "0")}
                        onValueChange={(v) => {
                          const id = v !== "0" ? parseInt(v, 10) : null;
                          if (selectedLevel === "subsystem") setSelectedSystemId(id);
                          if (selectedLevel === "module")    setSelectedSubsystemId(id);
                          if (selectedLevel === "unit")      setSelectedModuleId(id);
                          if (selectedLevel === "component") setSelectedUnitId(id);
                        }}
                      >
                        <SelectTrigger><SelectValue placeholder={`Select ${entityLabel(PARENT_LEVEL[selectedLevel] as HierarchyLevel)}`} /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0">None</SelectItem>
                          {(selectedLevel === "subsystem" ? grouped.system
                            : selectedLevel === "module"    ? grouped.subsystem
                            : selectedLevel === "unit"      ? grouped.module
                            : grouped.unit
                          ).map((item) => <SelectItem key={item.id} value={item.id.toString()}>{item.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div className="space-y-2 md:col-span-2">
                    <Label>{entityLabel(selectedLevel)} Name</Label>
                    <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={`e.g. Primary ${entityLabel(selectedLevel)}`} />
                  </div>

                  <div className="md:col-span-2 flex flex-col gap-3">
                    <Button onClick={() => void handleCreate()} disabled={saving}>
                      <Plus className="mr-2 h-4 w-4" />{saving ? "Saving…" : `Create ${entityLabel(selectedLevel)}`}
                    </Button>
                    {validationResult && (
                      <div className={cn("rounded-lg border p-3 text-sm", validationResult.valid ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-800")}>
                        {validationResult.message}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </Can>
      )}

      {/* Hierarchy Validator */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Hierarchy Validator</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>{entityLabel("system")}</Label>
              <Select value={String(validateSystemId ?? "0")} onValueChange={(v) => setValidateSystemId(v !== "0" ? parseInt(v, 10) : null)}>
                <SelectTrigger><SelectValue placeholder={`Select ${entityLabel("system")}`} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">None</SelectItem>
                  {grouped.system.map((s) => <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{entityLabel("subsystem")}</Label>
              <Select value={String(validateSubsystemId ?? "0")} onValueChange={(v) => setValidateSubsystemId(v !== "0" ? parseInt(v, 10) : null)}>
                <SelectTrigger><SelectValue placeholder={`Select ${entityLabel("subsystem")}`} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">None</SelectItem>
                  {grouped.subsystem.map((s) => <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button onClick={validateAssignment}>Validate</Button>
            </div>
          </div>
          {validationResult && (
            <div className={cn("mt-4 rounded-lg border p-3 text-sm", validationResult.valid ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-800")}>
              {validationResult.message}
            </div>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={(open) => { setDeleteConfirmOpen(open); if (!open) setDeleteTarget(null); }}
        title="Confirm delete"
        description={`Delete "${deleteTarget?.name ?? "item"}" and all its descendants? This cannot be undone.`}
        onConfirm={() => void confirmDelete()}
      />

      <Dialog open={editOpen} onOpenChange={(open) => { setEditOpen(open); if (!open) { setEditTarget(null); setEditName(""); setEditAbbr(""); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Hierarchy Item</DialogTitle>
            <DialogDescription>Update the name for this item.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
              <Button onClick={() => void handleEditSave()}>Save</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <div className="grid gap-4">{renderTree()}</div>
    </div>
  );
}
