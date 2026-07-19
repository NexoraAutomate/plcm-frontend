'use client';

import { useCallback, useEffect, useMemo, useState, type ComponentType } from 'react';
import axios from 'axios';
import {
  Plus,
  Edit,
  Trash2,
  Search,
  History,
  Eye,
  Users as UsersIcon,
  UserCheck,
  UserX,
  LogIn,
  ShieldAlert,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { Can } from '@/components/auth/can';
import { P } from '@/lib/permission-codes';
import * as api from '@/lib/api';
import type * as Models from '@/lib/models';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { SortableTableHead } from '@/components/data-table/sortable-table-head';
import { fetchUsersPage } from '@/hooks/queries/fetchers';
import { queryKeys } from '@/hooks/queries/query-keys';
import { usePaginatedList } from '@/hooks/use-paginated-list';
import { useTableSorting } from '@/hooks/use-table-sorting';
import { EntityListPagination } from '@/components/entity-list-pagination';
import { PageLoader } from '@/components/page-loader';
import { formatRoleNames, roleName } from '@/lib/user-display';
import { SettingsCard } from '@/components/settings/settings-card';
import { UserStatusBadge } from '@/components/settings/user-status-badge';
import { UserLoginHistoryDialog } from '@/components/settings/user-login-history-dialog';
import { UserDetailsDialog } from '@/components/settings/user-details-dialog';
import { useAuth } from '@/lib/auth-context';

export type UsersPanelProps = {
  embedded?: boolean;
};

function SummaryCard({
  title,
  value,
  icon: Icon,
}: {
  title: string;
  value: number | string;
  icon: ComponentType<{ className?: string }>;
}) {
  return (
    <SettingsCard className="shadow-none">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {title}
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
          <Icon className="h-5 w-5 text-muted-foreground" />
        </div>
      </div>
    </SettingsCard>
  );
}

export function UsersPanel({ embedded = false }: UsersPanelProps) {
  const { hasAccess } = useAuth();
  const adminOnly = hasAccess(['Admin']);
  const { sort, cycleSort, listFilterPatch } = useTableSorting();
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [search, setSearch] = useState('');

  const listFilters = useMemo(
    () => ({
      ...listFilterPatch,
      search: search.trim() || undefined,
      is_active:
        statusFilter === 'all' ? undefined : statusFilter === 'active' ? true : false,
    }),
    [listFilterPatch, search, statusFilter]
  );

  const pagination = usePaginatedList({
    queryKey: queryKeys.usersPage(listFilters),
    fetchPage: fetchUsersPage,
    filters: listFilters,
  });
  const users = pagination.items;
  const loading = pagination.loading;

  const [stats, setStats] = useState<Models.UserStatsSummary | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [roles, setRoles] = useState<Models.Role[]>([]);
  const [loadingRoles, setLoadingRoles] = useState(true);
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    full_name: '',
    email: '',
    role_id: '',
    is_active: true,
  });
  const [editFormData, setEditFormData] = useState({
    username: '',
    password: '',
    full_name: '',
    email: '',
    role_id: '',
    is_active: true,
  });
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; id: number | null }>({
    open: false,
    id: null,
  });
  const [historyUser, setHistoryUser] = useState<Models.User | null>(null);
  const [detailsUser, setDetailsUser] = useState<Models.User | null>(null);

  const refreshStats = useCallback(async () => {
    try {
      const res = await api.users.stats();
      setStats(res.data);
    } catch {
      setStats(null);
    }
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoadingRoles(true);
        const rolesRes = await api.auth.listRoles();
        setRoles(rolesRes.data);
      } catch (err) {
        console.error('API ERROR:', err);
        toast.error('Failed to load data');
      } finally {
        setLoadingRoles(false);
      }
    };
    fetchData();
    void refreshStats();
  }, [refreshStats]);

  useEffect(() => {
    pagination.setPage(0);
  }, [search, statusFilter]);

  async function handleCreate() {
    if (!formData.username.trim() || !formData.password.trim() || !formData.full_name.trim()) {
      toast.error('Please fill in all required fields');
      return;
    }
    try {
      await api.auth.register({
        username: formData.username,
        password: formData.password,
        full_name: formData.full_name,
        email: formData.email,
        is_active: formData.is_active,
      });
      setFormData({
        username: '',
        password: '',
        full_name: '',
        email: '',
        role_id: '',
        is_active: true,
      });
      setIsCreateOpen(false);
      toast.success('User created successfully');
      const lastPage = Math.max(
        0,
        Math.ceil((pagination.total + 1) / pagination.pageSize) - 1
      );
      pagination.setPage(lastPage);
      await pagination.invalidate();
      await refreshStats();
    } catch (err) {
      console.error('Failed to create user:', err);
      toast.error('Failed to create user');
    }
  }

  async function handleUpdate() {
    if (!editingId) return;
    if (!editFormData.full_name.trim()) {
      toast.error('Name is required');
      return;
    }
    try {
      const userData: Partial<Models.User> & { password?: string } = {
        full_name: editFormData.full_name,
        email: editFormData.email,
        is_active: editFormData.is_active,
      };
      if (editFormData.password) {
        userData.password = editFormData.password;
      }
      await api.users.update(editingId, userData);
      if (editFormData.role_id) {
        await api.auth.assignRole(editingId, parseInt(editFormData.role_id, 10));
      }
      setEditFormData({
        username: '',
        password: '',
        full_name: '',
        email: '',
        role_id: '',
        is_active: true,
      });
      setEditingId(null);
      setIsEditOpen(false);
      toast.success('User updated successfully');
      await pagination.invalidate();
      await refreshStats();
    } catch (err) {
      console.error('Failed to update user:', err);
      const detail = axios.isAxiosError(err)
        ? (err.response?.data as { detail?: string } | undefined)?.detail
        : undefined;
      toast.error(typeof detail === 'string' ? detail : 'Failed to update user');
    }
  }

  async function confirmDelete() {
    if (deleteConfirm.id === null) return;
    try {
      await api.users.delete(deleteConfirm.id);
      toast.success('User deleted successfully');
      await pagination.invalidate();
      await refreshStats();
    } catch (err) {
      console.error('Failed to delete user:', err);
      const detail = axios.isAxiosError(err)
        ? (err.response?.data as { detail?: string } | undefined)?.detail
        : undefined;
      toast.error(typeof detail === 'string' ? detail : 'Failed to delete user');
    } finally {
      setDeleteConfirm({ open: false, id: null });
    }
  }

  function openEdit(user: Models.User) {
    const firstRoleName = roleName(user.roles?.[0]);
    const foundRole = roles.find((r) => r.name === firstRoleName);
    setEditingId(user.id);
    setEditFormData({
      username: user.username,
      password: '',
      full_name: user.full_name,
      email: user.email,
      role_id: foundRole ? foundRole.id.toString() : '',
      is_active: user.is_active !== false,
    });
    setIsEditOpen(true);
  }

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-8">
      {!embedded && (
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Users</h1>
          <p className="mt-2 text-muted-foreground">Manage system users and permissions</p>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <SummaryCard title="Total Users" value={stats?.total_users ?? pagination.total} icon={UsersIcon} />
        <SummaryCard title="Active Users" value={stats?.active_users ?? '—'} icon={UserCheck} />
        <SummaryCard title="Inactive Users" value={stats?.inactive_users ?? '—'} icon={UserX} />
        <SummaryCard
          title="Currently Logged-in"
          value={stats?.currently_logged_in ?? '—'}
          icon={LogIn}
        />
        <SummaryCard
          title="Failed Logins (Today)"
          value={stats?.failed_logins_today ?? '—'}
          icon={ShieldAlert}
        />
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search users..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select
          value={statusFilter}
          onValueChange={(value: 'all' | 'active' | 'inactive') => setStatusFilter(value)}
        >
          <SelectTrigger className="w-full lg:w-44">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <Can permission={P.create_users}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Add User
              </Button>
            </DialogTrigger>
          </Can>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create User</DialogTitle>
              <DialogDescription>Add a new user to the system</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Username *</Label>
                <Input
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  placeholder="username"
                />
              </div>
              <div>
                <Label>Full Name *</Label>
                <Input
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  placeholder="John Doe"
                />
              </div>
              <div>
                <Label>Email</Label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="john@example.com"
                />
              </div>
              <div>
                <Label>Password *</Label>
                <Input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="Set initial password"
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border px-3 py-3">
                <div>
                  <Label htmlFor="create-active">Active Status</Label>
                  <p className="text-xs text-muted-foreground">Default is Active</p>
                </div>
                <Switch
                  id="create-active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreate}>Create</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <SettingsCard
        title="All Users"
        description={`Showing ${users.length} on this page · ${pagination.total} total in database`}
      >
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <SortableTableHead column="full_name" sort={sort} onSort={cycleSort}>
                  Name
                </SortableTableHead>
                <SortableTableHead column="username" sort={sort} onSort={cycleSort}>
                  Username
                </SortableTableHead>
                <SortableTableHead column="email" sort={sort} onSort={cycleSort}>
                  Email
                </SortableTableHead>
                <TableHead>Roles</TableHead>
                <SortableTableHead column="is_active" sort={sort} onSort={cycleSort}>
                  Status
                </SortableTableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                    No users found
                  </TableCell>
                </TableRow>
              ) : (
                users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.full_name}</TableCell>
                    <TableCell className="font-mono text-sm">{user.username}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell className="capitalize">{formatRoleNames(user.roles)}</TableCell>
                    <TableCell>
                      <UserStatusBadge isActive={user.is_active !== false} />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setDetailsUser(user)}
                          title="View details"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {adminOnly && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setHistoryUser(user)}
                            title="View login history"
                          >
                            <History className="h-4 w-4" />
                          </Button>
                        )}
                        <Can permission={P.edit_users}>
                          <Button size="sm" variant="outline" onClick={() => openEdit(user)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                        </Can>
                        <Can permission={P.delete_users}>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => setDeleteConfirm({ open: true, id: user.id })}
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
          page={pagination.page}
          totalPages={pagination.totalPages}
          total={pagination.total}
          rangeLabel={pagination.rangeLabel}
          hasPrev={pagination.hasPrev}
          hasNext={pagination.hasNext}
          onPrev={pagination.prevPage}
          onNext={pagination.nextPage}
          loading={pagination.fetching}
        />
      </SettingsCard>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>Update user details, status, and roles</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Username (read-only)</Label>
              <Input disabled value={editFormData.username} />
            </div>
            <div>
              <Label>Full Name</Label>
              <Input
                value={editFormData.full_name}
                onChange={(e) => setEditFormData({ ...editFormData, full_name: e.target.value })}
                placeholder="John Doe"
              />
            </div>
            <div>
              <Label>Email</Label>
              <Input
                type="email"
                value={editFormData.email}
                onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                placeholder="john@example.com"
              />
            </div>
            <div>
              <Label>New Password (optional)</Label>
              <Input
                type="password"
                value={editFormData.password}
                onChange={(e) => setEditFormData({ ...editFormData, password: e.target.value })}
                placeholder="Leave blank to keep current password"
              />
            </div>
            {adminOnly && (
              <div className="flex items-center justify-between rounded-lg border px-3 py-3">
                <div>
                  <Label htmlFor="edit-active">Account Active</Label>
                  <p className="text-xs text-muted-foreground">
                    Inactive users cannot sign in until reactivated
                  </p>
                </div>
                <Switch
                  id="edit-active"
                  checked={editFormData.is_active}
                  onCheckedChange={(checked) =>
                    setEditFormData({ ...editFormData, is_active: checked })
                  }
                />
              </div>
            )}
            <Can permission={P.assign_roles}>
              <div>
                <Label>Role</Label>
                {loadingRoles ? (
                  <p className="text-sm text-muted-foreground">Loading roles...</p>
                ) : (
                  <Select
                    value={editFormData.role_id}
                    onValueChange={(value) =>
                      setEditFormData({ ...editFormData, role_id: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a role" />
                    </SelectTrigger>
                    <SelectContent>
                      {roles.map((role) => (
                        <SelectItem key={role.id} value={role.id.toString()}>
                          {role.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </Can>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setIsEditOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleUpdate}>Update</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteConfirm.open}
        onOpenChange={(open) =>
          setDeleteConfirm((prev) => ({ ...prev, open, id: open ? prev.id : null }))
        }
        title="Delete User"
        description="Are you sure you want to delete this user? This action cannot be undone."
        onConfirm={confirmDelete}
      />

      <UserLoginHistoryDialog
        open={!!historyUser}
        onOpenChange={(open) => {
          if (!open) setHistoryUser(null);
        }}
        user={historyUser}
      />

      <UserDetailsDialog
        open={!!detailsUser}
        onOpenChange={(open) => {
          if (!open) setDetailsUser(null);
        }}
        user={detailsUser}
      />
    </div>
  );
}
