'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Plus, Edit, Trash2, Search, Shield } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
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
import { ConfirmDialog } from '@/components/confirm-dialog';
import { Can } from '@/components/auth/can';
import { SortableTableHead } from '@/components/data-table/sortable-table-head';
import { SettingsCard } from '@/components/settings/settings-card';
import { PageLoader } from '@/components/page-loader';
import { EntityListPagination } from '@/components/entity-list-pagination';
import { useTableSorting } from '@/hooks/use-table-sorting';
import { auth } from '@/lib/api';
import { P } from '@/lib/permission-codes';
import type { Permission, Role } from '@/lib/models';

const PAGE_SIZE = 10;

export type RolesPanelProps = {
  embedded?: boolean;
};

export function RolesPanel({ embedded = false }: RolesPanelProps) {
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [selectedPermissionIds, setSelectedPermissionIds] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; role: Role | null }>({
    open: false,
    role: null,
  });
  const { sort, cycleSort, listFilterPatch } = useTableSorting();

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [rolesRes, permsRes] = await Promise.all([
        auth.listRoles(listFilterPatch.sort_by, listFilterPatch.sort_order),
        auth.listPermissionRegistry(),
      ]);
      setRoles(rolesRes.data);
      setPermissions(permsRes.data);
    } catch {
      toast.error('Failed to load roles');
    } finally {
      setLoading(false);
    }
  }, [listFilterPatch.sort_by, listFilterPatch.sort_order]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    setPage(0);
  }, [search, sort]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return roles;
    return roles.filter(
      (role) =>
        role.name.toLowerCase().includes(q) ||
        (role.description ?? '').toLowerCase().includes(q)
    );
  }, [roles, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
  const rangeStart = filtered.length === 0 ? 0 : page * PAGE_SIZE + 1;
  const rangeEnd = Math.min(filtered.length, (page + 1) * PAGE_SIZE);

  function resetForm() {
    setFormName('');
    setFormDescription('');
    setSelectedPermissionIds([]);
    setEditingRole(null);
  }

  function openCreate() {
    resetForm();
    setIsCreateOpen(true);
  }

  function openEdit(role: Role) {
    setEditingRole(role);
    setFormName(role.name);
    setFormDescription(role.description ?? '');
    setSelectedPermissionIds((role.permissions ?? []).map((p) => p.id));
    setIsEditOpen(true);
  }

  function togglePermission(id: number, checked: boolean) {
    setSelectedPermissionIds((prev) =>
      checked ? [...prev, id] : prev.filter((item) => item !== id)
    );
  }

  async function handleCreate() {
    if (!formName.trim()) {
      toast.error('Role name is required');
      return;
    }
    setSaving(true);
    try {
      await auth.createRole({
        name: formName.trim(),
        description: formDescription.trim() || undefined,
        permission_ids: selectedPermissionIds,
      });
      toast.success('Role created successfully');
      setIsCreateOpen(false);
      resetForm();
      await loadData();
    } catch (err) {
      const detail = axios.isAxiosError(err)
        ? (err.response?.data as { detail?: string } | undefined)?.detail
        : undefined;
      toast.error(typeof detail === 'string' ? detail : 'Failed to create role');
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdate() {
    if (!editingRole) return;
    if (!formName.trim()) {
      toast.error('Role name is required');
      return;
    }
    setSaving(true);
    try {
      await auth.updateRole(editingRole.id, {
        name: formName.trim(),
        description: formDescription.trim() || undefined,
        permission_ids: selectedPermissionIds,
      });
      toast.success('Role updated successfully');
      setIsEditOpen(false);
      resetForm();
      await loadData();
    } catch (err) {
      const detail = axios.isAxiosError(err)
        ? (err.response?.data as { detail?: string } | undefined)?.detail
        : undefined;
      toast.error(typeof detail === 'string' ? detail : 'Failed to update role');
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteConfirm.role) return;
    try {
      await auth.deleteRole(deleteConfirm.role.id);
      toast.success('Role deleted successfully');
      await loadData();
    } catch (err) {
      const detail = axios.isAxiosError(err)
        ? (err.response?.data as { detail?: string } | undefined)?.detail
        : undefined;
      toast.error(typeof detail === 'string' ? detail : 'Failed to delete role');
    } finally {
      setDeleteConfirm({ open: false, role: null });
    }
  }

  const permissionPicker = (
    <div className="max-h-56 space-y-2 overflow-y-auto rounded-md border border-border p-3">
      {permissions.length === 0 ? (
        <p className="text-sm text-muted-foreground">No permissions available.</p>
      ) : (
        permissions.map((permission) => {
          const checked = selectedPermissionIds.includes(permission.id);
          return (
            <label
              key={permission.id}
              className="flex cursor-pointer items-start gap-3 rounded-md px-1 py-1.5 hover:bg-muted/50"
            >
              <Checkbox
                checked={checked}
                onCheckedChange={(value) => togglePermission(permission.id, value === true)}
              />
              <span className="min-w-0">
                <span className="block text-sm font-medium">{permission.name}</span>
                {permission.description ? (
                  <span className="block text-xs text-muted-foreground">
                    {permission.description}
                  </span>
                ) : null}
              </span>
            </label>
          );
        })
      )}
    </div>
  );

  if (loading && roles.length === 0) return <PageLoader />;

  return (
    <div className="space-y-6">
      {!embedded && (
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Roles</h1>
          <p className="mt-2 text-muted-foreground">Manage roles and their assigned permissions</p>
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search roles..."
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
              <Button className="gap-2" onClick={openCreate}>
                <Plus className="h-4 w-4" />
                Add Role
              </Button>
            </DialogTrigger>
          </Can>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Create Role</DialogTitle>
              <DialogDescription>Define a role and optionally assign permissions.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Name *</Label>
                <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="e.g. Project Manager" />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Input
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Optional description"
                />
              </div>
              <div className="space-y-2">
                <Label>Permissions</Label>
                {permissionPicker}
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
        title="All Roles"
        description={`Showing ${pageItems.length} on this page · ${filtered.length} total`}
      >
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <SortableTableHead column="name" sort={sort} onSort={cycleSort}>
                  Name
                </SortableTableHead>
                <SortableTableHead column="description" sort={sort} onSort={cycleSort}>
                  Description
                </SortableTableHead>
                <TableHead>Permissions</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-10 text-center text-muted-foreground">
                    <div className="flex flex-col items-center gap-2">
                      <Shield className="h-8 w-8 text-muted-foreground/60" />
                      <p>No roles found</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                pageItems.map((role) => (
                  <TableRow key={role.id}>
                    <TableCell className="font-medium">{role.name}</TableCell>
                    <TableCell>{role.description || '—'}</TableCell>
                    <TableCell>{role.permissions?.length ?? 0}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Can permission={P.edit_roles}>
                          <Button size="sm" variant="outline" onClick={() => openEdit(role)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                        </Can>
                        <Can permission={P.delete_roles}>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => setDeleteConfirm({ open: true, role })}
                            disabled={['admin', 'subadmin'].includes(role.name.toLowerCase())}
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
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Role</DialogTitle>
            <DialogDescription>Update role details and assigned permissions.</DialogDescription>
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
            <div className="space-y-2">
              <Label>Permissions</Label>
              {permissionPicker}
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
          setDeleteConfirm((prev) => ({ ...prev, open, role: open ? prev.role : null }))
        }
        title="Delete Role"
        description={`Delete "${deleteConfirm.role?.name ?? 'role'}"? Deletion is blocked if the role is assigned to any users.`}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
