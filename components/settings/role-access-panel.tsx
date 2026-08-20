'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { Plus, Save, ShieldCheck, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { AccessRestricted } from '@/components/auth/access-restricted';
import { SettingsCard } from '@/components/settings/settings-card';
import { PageLoader } from '@/components/page-loader';
import { useAuth } from '@/lib/auth-context';
import { auth } from '@/lib/api';
import type { Permission, Role } from '@/lib/models';
import {
  CRUD_ACTIONS,
  CRUD_MODULES,
  TOGGLE_SECTIONS,
  crudPermissionCode,
  humanizePermissionCode,
  matrixKnownCodes,
  type CrudAction,
} from '@/lib/role-access-matrix';
import { cn } from '@/lib/utils';

export type RoleAccessPanelProps = {
  embedded?: boolean;
};

function sameIdSet(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort((x, y) => x - y);
  const sortedB = [...b].sort((x, y) => x - y);
  return sortedA.every((id, i) => id === sortedB[i]);
}

export function RoleAccessPanel({ embedded = false }: RoleAccessPanelProps) {
  const { hasAccess } = useAuth();
  const isAdmin = hasAccess(['Admin']);

  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRoleId, setSelectedRoleId] = useState<string>('');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [baselineIds, setBaselineIds] = useState<number[]>([]);
  const [roleDescription, setRoleDescription] = useState('');
  const [baselineDescription, setBaselineDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleDescription, setNewRoleDescription] = useState('');
  const [creating, setCreating] = useState(false);

  const selectedRoleIdRef = useRef(selectedRoleId);
  selectedRoleIdRef.current = selectedRoleId;

  const permissionByName = useMemo(() => {
    const map = new Map<string, Permission>();
    for (const perm of permissions) {
      map.set(perm.name, perm);
    }
    return map;
  }, [permissions]);

  const selectedRole = useMemo(
    () => roles.find((role) => role.id.toString() === selectedRoleId) ?? null,
    [roles, selectedRoleId]
  );

  const isDirty = useMemo(() => {
    if (!selectedRole) return false;
    return (
      !sameIdSet(selectedIds, baselineIds) ||
      roleDescription.trim() !== baselineDescription.trim()
    );
  }, [selectedRole, selectedIds, baselineIds, roleDescription, baselineDescription]);

  const isAdminRole = selectedRole?.name.toLowerCase() === 'admin';
  const isSubAdminRole = selectedRole?.name.toLowerCase() === 'subadmin';

  const loadData = useCallback(async (preferRoleId?: number) => {
    setLoading(true);
    try {
      const [rolesRes, permsRes] = await Promise.all([
        auth.listRoles('name', 'asc'),
        auth.listPermissionRegistry('name', 'asc'),
      ]);
      setRoles(rolesRes.data);
      setPermissions(permsRes.data);

      const currentId = selectedRoleIdRef.current;
      const nextId =
        preferRoleId != null
          ? preferRoleId.toString()
          : currentId && rolesRes.data.some((r) => r.id.toString() === currentId)
            ? currentId
            : rolesRes.data[0]
              ? rolesRes.data[0].id.toString()
              : '';

      if (nextId) {
        applyRoleSelection(
          rolesRes.data.find((r) => r.id.toString() === nextId) ?? null,
          nextId
        );
      } else {
        setSelectedRoleId('');
        setSelectedIds([]);
        setBaselineIds([]);
        setRoleDescription('');
        setBaselineDescription('');
      }
    } catch {
      toast.error('Failed to load roles and permissions');
    } finally {
      setLoading(false);
    }
  }, []);

  function applyRoleSelection(role: Role | null, id: string) {
    setSelectedRoleId(id);
    const ids = (role?.permissions ?? []).map((p) => p.id);
    setSelectedIds(ids);
    setBaselineIds(ids);
    setRoleDescription(role?.description ?? '');
    setBaselineDescription(role?.description ?? '');
  }

  useEffect(() => {
    if (!isAdmin) return;
    loadData();
  }, [isAdmin, loadData]);

  function handleRoleChange(value: string) {
    if (isDirty) {
      const leave = window.confirm(
        'You have unsaved changes. Discard them and switch roles?'
      );
      if (!leave) return;
    }
    const role = roles.find((r) => r.id.toString() === value) ?? null;
    applyRoleSelection(role, value);
  }

  function resolveCode(code: string): Permission | undefined {
    return permissionByName.get(code);
  }

  function hasCode(code: string): boolean {
    const perm = resolveCode(code);
    return perm ? selectedIds.includes(perm.id) : false;
  }

  function codeAvailable(code: string): boolean {
    return permissionByName.has(code);
  }

  function toggleCode(code: string, checked: boolean) {
    const perm = resolveCode(code);
    if (!perm) return;
    setSelectedIds((prev) =>
      checked ? (prev.includes(perm.id) ? prev : [...prev, perm.id]) : prev.filter((id) => id !== perm.id)
    );
  }

  function setModuleAction(resource: string, action: CrudAction, checked: boolean) {
    toggleCode(crudPermissionCode(resource, action), checked);
  }

  function setModuleAll(resource: string, checked: boolean, extras: { code: string }[] = []) {
    const codes = [
      ...CRUD_ACTIONS.map(({ action }) => crudPermissionCode(resource, action)),
      ...extras.map((e) => e.code),
    ];
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const code of codes) {
        const perm = resolveCode(code);
        if (!perm) continue;
        if (checked) next.add(perm.id);
        else next.delete(perm.id);
      }
      return Array.from(next);
    });
  }

  function selectAllAvailable() {
    setSelectedIds(permissions.map((p) => p.id));
  }

  function clearAll() {
    setSelectedIds([]);
  }

  function resetChanges() {
    setSelectedIds(baselineIds);
    setRoleDescription(baselineDescription);
  }

  async function handleSave() {
    if (!selectedRole) return;
    setSaving(true);
    try {
      await auth.updateRole(selectedRole.id, {
        description: roleDescription.trim() || undefined,
        permission_ids: selectedIds,
      });
      toast.success(`Permissions updated for ${selectedRole.name}`);
      await loadData(selectedRole.id);
    } catch (err) {
      const detail = axios.isAxiosError(err)
        ? (err.response?.data as { detail?: string } | undefined)?.detail
        : undefined;
      toast.error(typeof detail === 'string' ? detail : 'Failed to save role permissions');
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateRole() {
    if (!newRoleName.trim()) {
      toast.error('Role name is required');
      return;
    }
    setCreating(true);
    try {
      const res = await auth.createRole({
        name: newRoleName.trim(),
        description: newRoleDescription.trim() || undefined,
        permission_ids: [],
      });
      toast.success(`Role "${res.data.name}" created`);
      setIsCreateOpen(false);
      setNewRoleName('');
      setNewRoleDescription('');
      await loadData(res.data.id);
    } catch (err) {
      const detail = axios.isAxiosError(err)
        ? (err.response?.data as { detail?: string } | undefined)?.detail
        : undefined;
      toast.error(typeof detail === 'string' ? detail : 'Failed to create role');
    } finally {
      setCreating(false);
    }
  }

  const knownCodes = useMemo(() => matrixKnownCodes(), []);

  const uncategorized = useMemo(() => {
    return permissions.filter((p) => !knownCodes.has(p.name));
  }, [permissions, knownCodes]);

  const enabledCount = selectedIds.length;
  const totalCount = permissions.length;

  if (!isAdmin) {
    return (
      <AccessRestricted
        title="Access Restricted"
        message="Only Administrators can manage role access. Contact an administrator if you need changes."
      />
    );
  }

  if (loading && roles.length === 0) return <PageLoader />;

  return (
    <div className="space-y-6">
      {!embedded && (
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Role Access</h1>
          <p className="text-sm text-muted-foreground">
            Control what each role can view, create, update, and delete
          </p>
        </div>
      )}

      <SettingsCard
        title="Select role"
        description="Choose a role to review and edit its permissions, or create a new one"
        headerAction={
          <Dialog
            open={isCreateOpen}
            onOpenChange={(open) => {
              setIsCreateOpen(open);
              if (!open) {
                setNewRoleName('');
                setNewRoleDescription('');
              }
            }}
          >
            <DialogTrigger asChild>
              <Button className="gap-2" size="sm">
                <Plus className="h-4 w-4" />
                Add Role
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Role</DialogTitle>
                <DialogDescription>
                  Add a new role, then configure its permissions in the matrix below.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="new-role-name">Name *</Label>
                  <Input
                    id="new-role-name"
                    value={newRoleName}
                    onChange={(e) => setNewRoleName(e.target.value)}
                    placeholder="e.g. QualityInspector"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-role-desc">Description</Label>
                  <Input
                    id="new-role-desc"
                    value={newRoleDescription}
                    onChange={(e) => setNewRoleDescription(e.target.value)}
                    placeholder="Optional description"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreateRole} disabled={creating}>
                    {creating ? 'Creating...' : 'Create'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        }
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1 space-y-2">
            <Label>Role</Label>
            <Select value={selectedRoleId} onValueChange={handleRoleChange}>
              <SelectTrigger className="w-full sm:max-w-md">
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                {roles.map((role) => (
                  <SelectItem key={role.id} value={role.id.toString()}>
                    {role.name}
                    {role.user_count != null ? ` (${role.user_count})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {selectedRole ? (
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <Badge variant="secondary">
                {enabledCount} / {totalCount} permissions
              </Badge>
              {isDirty ? <Badge variant="outline">Unsaved changes</Badge> : null}
            </div>
          ) : null}
        </div>

        {selectedRole ? (
          <div className="mt-4 space-y-2">
            <Label htmlFor="role-description">Description</Label>
            <Input
              id="role-description"
              value={roleDescription}
              onChange={(e) => setRoleDescription(e.target.value)}
              placeholder="Describe what this role is for"
            />
          </div>
        ) : null}
      </SettingsCard>

      {!selectedRole ? (
        <SettingsCard>
          <div className="flex flex-col items-center gap-2 py-10 text-muted-foreground">
            <ShieldCheck className="h-8 w-8 text-muted-foreground/60" />
            <p>Select or create a role to manage its access.</p>
          </div>
        </SettingsCard>
      ) : (
        <>
          {isAdminRole ? (
            <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-950 dark:text-amber-100">
              You are editing the Admin role. Changes affect every administrator. Keep full access
              unless you intentionally want to restrict Admin capabilities.
            </div>
          ) : null}
          {isSubAdminRole ? (
            <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-950 dark:text-amber-100">
              You are editing the SubAdmin role. SubAdmins should not receive role-management,
              security settings, or backup/restore permissions. Startup sync restores the default
              SubAdmin permission set.
            </div>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={selectAllAvailable}>
                Select all
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={clearAll}>
                Clear all
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="gap-1.5"
                onClick={resetChanges}
                disabled={!isDirty}
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reset
              </Button>
            </div>
            <Button className="gap-2" onClick={handleSave} disabled={!isDirty || saving}>
              <Save className="h-4 w-4" />
              {saving ? 'Saving...' : 'Save changes'}
            </Button>
          </div>

          <SettingsCard
            title="Resource permissions"
            description="Toggle view / create / edit / delete for each area of the application"
          >
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-40">Resource</TableHead>
                    {CRUD_ACTIONS.map(({ action, label }) => (
                      <TableHead key={action} className="w-20 text-center">
                        {label}
                      </TableHead>
                    ))}
                    <TableHead className="min-w-50">Other options</TableHead>
                    <TableHead className="w-24 text-center">All</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {CRUD_MODULES.map((mod) => {
                    const availableActions = CRUD_ACTIONS.filter(({ action }) =>
                      codeAvailable(crudPermissionCode(mod.resource, action))
                    );
                    if (
                      availableActions.length === 0 &&
                      !(mod.extras ?? []).some((e) => codeAvailable(e.code))
                    ) {
                      return null;
                    }
                    const allOn =
                      availableActions.every(({ action }) =>
                        hasCode(crudPermissionCode(mod.resource, action))
                      ) &&
                      (mod.extras ?? [])
                        .filter((e) => codeAvailable(e.code))
                        .every((e) => hasCode(e.code));

                    return (
                      <TableRow key={mod.key}>
                        <TableCell className="font-medium">{mod.label}</TableCell>
                        {CRUD_ACTIONS.map(({ action }) => {
                          const code = crudPermissionCode(mod.resource, action);
                          const available = codeAvailable(code);
                          return (
                            <TableCell key={action} className="text-center">
                              {available ? (
                                <Checkbox
                                  checked={hasCode(code)}
                                  onCheckedChange={(value) =>
                                    setModuleAction(mod.resource, action, value === true)
                                  }
                                  aria-label={`${mod.label} ${action}`}
                                  className="mx-auto"
                                />
                              ) : (
                                <span className="text-muted-foreground/40">—</span>
                              )}
                            </TableCell>
                          );
                        })}
                        <TableCell>
                          <div className="flex flex-wrap gap-x-4 gap-y-2">
                            {(mod.extras ?? [])
                              .filter((extra) => codeAvailable(extra.code))
                              .map((extra) => (
                                <label
                                  key={extra.code}
                                  className="flex cursor-pointer items-center gap-2 text-sm"
                                >
                                  <Checkbox
                                    checked={hasCode(extra.code)}
                                    onCheckedChange={(value) =>
                                      toggleCode(extra.code, value === true)
                                    }
                                  />
                                  <span>{extra.label}</span>
                                </label>
                              ))}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <Checkbox
                            checked={allOn}
                            onCheckedChange={(value) =>
                              setModuleAll(mod.resource, value === true, mod.extras)
                            }
                            aria-label={`Toggle all ${mod.label}`}
                            className="mx-auto"
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </SettingsCard>

          {TOGGLE_SECTIONS.map((section) => {
            const items = section.permissions.filter((p) => codeAvailable(p.code));
            if (items.length === 0) return null;
            return (
              <SettingsCard
                key={section.key}
                title={section.label}
                description={section.description}
              >
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {items.map((item) => (
                    <label
                      key={item.code}
                      className={cn(
                        'flex cursor-pointer items-start gap-3 rounded-md border border-border px-3 py-2.5',
                        'hover:bg-muted/40'
                      )}
                    >
                      <Checkbox
                        checked={hasCode(item.code)}
                        onCheckedChange={(value) => toggleCode(item.code, value === true)}
                        className="mt-0.5"
                      />
                      <span className="min-w-0">
                        <span className="block text-sm font-medium">{item.label}</span>
                        {item.description ? (
                          <span className="block text-xs text-muted-foreground">
                            {item.description}
                          </span>
                        ) : null}
                      </span>
                    </label>
                  ))}
                </div>
              </SettingsCard>
            );
          })}

          {uncategorized.length > 0 ? (
            <SettingsCard
              title="Other permissions"
              description="Additional permission codes not covered by the matrix above"
            >
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {uncategorized.map((perm) => (
                  <label
                    key={perm.id}
                    className="flex cursor-pointer items-start gap-3 rounded-md border border-border px-3 py-2.5 hover:bg-muted/40"
                  >
                    <Checkbox
                      checked={selectedIds.includes(perm.id)}
                      onCheckedChange={(value) => {
                        setSelectedIds((prev) =>
                          value === true
                            ? prev.includes(perm.id)
                              ? prev
                              : [...prev, perm.id]
                            : prev.filter((id) => id !== perm.id)
                        );
                      }}
                      className="mt-0.5"
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">
                        {humanizePermissionCode(perm.name)}
                      </span>
                      <span className="block font-mono text-xs text-muted-foreground">
                        {perm.name}
                      </span>
                      {perm.description ? (
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          {perm.description}
                        </span>
                      ) : null}
                    </span>
                  </label>
                ))}
              </div>
            </SettingsCard>
          ) : null}

          <div className="flex justify-end">
            <Button className="gap-2" onClick={handleSave} disabled={!isDirty || saving}>
              <Save className="h-4 w-4" />
              {saving ? 'Saving...' : 'Save changes'}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
