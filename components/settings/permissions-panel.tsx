'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Plus, Edit, Trash2, Search, KeyRound } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { Can } from '@/components/auth/can';
import { SortableTableHead } from '@/components/data-table/sortable-table-head';
import { SettingsCard } from '@/components/settings/settings-card';
import { PageLoader } from '@/components/page-loader';
import { EntityListPagination } from '@/components/entity-list-pagination';
import { useTableSorting } from '@/hooks/use-table-sorting';
import { useSyncedPage } from '@/hooks/use-synced-page';
import { auth } from '@/lib/api';
import { P } from '@/lib/permission-codes';
import type { Permission } from '@/lib/models';

const PAGE_SIZE = 10;

function permissionModule(name: string): string {
  const parts = name.split('_');
  if (parts.length <= 1) return 'General';
  // e.g. view_users → users, create_maintenance_cases → maintenance
  const withoutVerb = parts.slice(1).join('_');
  const moduleKey = withoutVerb.split('_')[0] || 'general';
  return moduleKey.charAt(0).toUpperCase() + moduleKey.slice(1);
}

export type PermissionsPanelProps = {
  embedded?: boolean;
};

export function PermissionsPanel({ embedded = false }: PermissionsPanelProps) {
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editing, setEditing] = useState<Permission | null>(null);
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; permission: Permission | null }>({
    open: false,
    permission: null,
  });
  const { sort, cycleSort, listFilterPatch } = useTableSorting();
  const { page, setPage } = useSyncedPage(
    `${search}|${sort.sortBy ?? ''}|${sort.sortOrder ?? ''}`
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await auth.listPermissionRegistry(
        listFilterPatch.sort_by,
        listFilterPatch.sort_order
      );
      setPermissions(res.data);
    } catch {
      toast.error('Failed to load permissions');
    } finally {
      setLoading(false);
    }
  }, [listFilterPatch.sort_by, listFilterPatch.sort_order]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return permissions;
    return permissions.filter(
      (permission) =>
        permission.name.toLowerCase().includes(q) ||
        (permission.description ?? '').toLowerCase().includes(q) ||
        permissionModule(permission.name).toLowerCase().includes(q)
    );
  }, [permissions, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
  const rangeStart = filtered.length === 0 ? 0 : page * PAGE_SIZE + 1;
  const rangeEnd = Math.min(filtered.length, (page + 1) * PAGE_SIZE);

  function resetForm() {
    setFormName('');
    setFormDescription('');
    setEditing(null);
  }

  function openEdit(permission: Permission) {
    setEditing(permission);
    setFormName(permission.name);
    setFormDescription(permission.description ?? '');
    setIsEditOpen(true);
  }

  async function handleCreate() {
    if (!formName.trim()) {
      toast.error('Permission name is required');
      return;
    }
    setSaving(true);
    try {
      await auth.createPermission({
        name: formName.trim(),
        description: formDescription.trim() || undefined,
      });
      toast.success('Permission created successfully');
      setIsCreateOpen(false);
      resetForm();
      await loadData();
    } catch (err) {
      const detail = axios.isAxiosError(err)
        ? (err.response?.data as { detail?: string } | undefined)?.detail
        : undefined;
      toast.error(typeof detail === 'string' ? detail : 'Failed to create permission');
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdate() {
    if (!editing) return;
    if (!formName.trim()) {
      toast.error('Permission name is required');
      return;
    }
    setSaving(true);
    try {
      await auth.updatePermission(editing.id, {
        name: formName.trim(),
        description: formDescription.trim() || undefined,
      });
      toast.success('Permission updated successfully');
      setIsEditOpen(false);
      resetForm();
      await loadData();
    } catch (err) {
      const detail = axios.isAxiosError(err)
        ? (err.response?.data as { detail?: string } | undefined)?.detail
        : undefined;
      toast.error(typeof detail === 'string' ? detail : 'Failed to update permission');
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteConfirm.permission) return;
    try {
      await auth.deletePermission(deleteConfirm.permission.id);
      toast.success('Permission deleted successfully');
      await loadData();
    } catch (err) {
      const detail = axios.isAxiosError(err)
        ? (err.response?.data as { detail?: string } | undefined)?.detail
        : undefined;
      toast.error(typeof detail === 'string' ? detail : 'Failed to delete permission');
    } finally {
      setDeleteConfirm({ open: false, permission: null });
    }
  }

  if (loading && permissions.length === 0) return <PageLoader />;

  return (
    <div className="space-y-6">
      {!embedded && (
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Permissions</h1>
          <p className="text-sm text-muted-foreground">
            Manage permission codes used across modules
          </p>
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search permissions or modules..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Dialog
          open={isCreateOpen}
          onOpenChange={(open) => {
            setIsCreateOpen(open);
            if (!open) resetForm();
          }}
        >
          <Can permission={P.create_roles}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Add Permission
              </Button>
            </DialogTrigger>
          </Can>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Permission</DialogTitle>
              <DialogDescription>
                Add a new permission code. Prefer snake_case names (e.g. view_reports).
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Name *</Label>
                <Input
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="view_example"
                />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Input
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Optional description"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreate} disabled={saving}>
                  {saving ? 'Saving...' : 'Create'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <SettingsCard
        title="All Permissions"
        description={`Showing ${pageItems.length} on this page · ${filtered.length} total · grouped by module when searching`}
      >
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <SortableTableHead column="name" sort={sort} onSort={cycleSort}>
                  Name
                </SortableTableHead>
                <TableHead>Module</TableHead>
                <SortableTableHead column="description" sort={sort} onSort={cycleSort}>
                  Description
                </SortableTableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-10 text-center text-muted-foreground">
                    <div className="flex flex-col items-center gap-2">
                      <KeyRound className="h-8 w-8 text-muted-foreground/60" />
                      <p>No permissions found</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                pageItems.map((permission) => (
                  <TableRow key={permission.id}>
                    <TableCell className="font-mono text-sm font-medium">{permission.name}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{permissionModule(permission.name)}</Badge>
                    </TableCell>
                    <TableCell>{permission.description || '—'}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Can permission={P.edit_roles}>
                          <Button size="sm" variant="outline" onClick={() => openEdit(permission)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                        </Can>
                        <Can permission={P.delete_roles}>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => setDeleteConfirm({ open: true, permission })}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </Can>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        <EntityListPagination
          page={page}
          totalPages={totalPages}
          total={filtered.length}
          rangeLabel={`${rangeStart}–${rangeEnd}`}
          hasPrev={page > 0}
          hasNext={page < totalPages - 1}
          onPrev={() => setPage((p) => Math.max(0, p - 1))}
          onNext={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
          loading={loading}
        />
      </SettingsCard>

      <Dialog
        open={isEditOpen}
        onOpenChange={(open) => {
          setIsEditOpen(open);
          if (!open) resetForm();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Permission</DialogTitle>
            <DialogDescription>Update the permission code or description.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input value={formName} onChange={(e) => setFormName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input value={formDescription} onChange={(e) => setFormDescription(e.target.value)} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setIsEditOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleUpdate} disabled={saving}>
                {saving ? 'Saving...' : 'Update'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteConfirm.open}
        onOpenChange={(open) =>
          setDeleteConfirm((prev) => ({
            ...prev,
            open,
            permission: open ? prev.permission : null,
          }))
        }
        title="Delete Permission"
        description={`Delete "${deleteConfirm.permission?.name ?? 'permission'}"? Deletion is blocked if it is assigned to any roles.`}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
