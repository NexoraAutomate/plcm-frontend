'use client';

import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Edit, Trash2, Search } from 'lucide-react';
import { toast } from 'sonner';
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

export default function UsersPage() {
  const { sort, cycleSort, listFilterPatch } = useTableSorting();
  const listFilters = useMemo(() => ({ ...listFilterPatch }), [listFilterPatch]);
  const pagination = usePaginatedList({
    queryKey: queryKeys.usersPage(listFilters),
    fetchPage: fetchUsersPage,
    filters: listFilters,
  });
  const users = pagination.items;
  const loading = pagination.loading;
  const [search, setSearch] = useState('');
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
  });
  const [editFormData, setEditFormData] = useState({
    username: '',
    password: '',
    full_name: '',
    email: '',
    role_id: '',
  });
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; id: number | null }>({
    open: false,
    id: null,
  });

  // Fetch available roles from API
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoadingRoles(true);

        const rolesRes = await api.auth.listRoles();
        setRoles(rolesRes.data);

      } catch (err) {
        console.error("API ERROR:", err);
        toast.error("Failed to load data");
      } finally {
        setLoadingRoles(false);
      }
    };

    fetchData();
  }, []);

  useEffect(() => {
    pagination.setPage(0);
  }, [search]);

  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    return (
      (u.full_name ?? '').toLowerCase().includes(q) ||
      (u.email ?? '').toLowerCase().includes(q) ||
      (u.username ?? '').toLowerCase().includes(q)
    );
  });

  async function handleCreate() {
    if (!formData.username.trim() || !formData.password.trim() || !formData.full_name.trim()) {
      toast.error('Please fill in all required fields');
      return;
    }
    try {
      // Use the register API (Viewer role assigned by default)
      const userData: any = {
        username: formData.username,
        password: formData.password,
        full_name: formData.full_name,
        email: formData.email,
      };
      await api.auth.register(userData);
      setFormData({ username: '', password: '', full_name: '', email: '', role_id: '' });
      setIsCreateOpen(false);
      toast.success('User created successfully');
      const lastPage = Math.max(
        0,
        Math.ceil((pagination.total + 1) / pagination.pageSize) - 1
      );
      pagination.setPage(lastPage);
      await pagination.invalidate();
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
      const userData: any = {
        full_name: editFormData.full_name,
        email: editFormData.email,
      };

      if (editFormData.password) {
        userData.password = editFormData.password;
      }

      await api.users.update(editingId, userData);

      if (editFormData.role_id) {
        const roleId = parseInt(editFormData.role_id);
        await api.auth.assignRole(editingId, roleId);
      }

      setEditFormData({ username: '', password: '', full_name: '', email: '', role_id: '' });
      setEditingId(null);
      setIsEditOpen(false);
      toast.success('User updated successfully');
      await pagination.invalidate();
    } catch (err) {
      console.error('Failed to update user:', err);
      toast.error('Failed to update user');
    }
  }

  async function confirmDelete() {
    if (deleteConfirm.id === null) return;
    try {
      await api.users.delete(deleteConfirm.id);
      toast.success('User deleted successfully');
      await pagination.invalidate();
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

  function openEdit(user: typeof filtered[0]) {
    const firstRoleName = roleName(user.roles?.[0]);

    const foundRole = roles.find(
      (r) => r.name === firstRoleName
    );

    const roleId = foundRole
      ? foundRole.id.toString()
      : '';

    setEditingId(user.id);

    setEditFormData({
      username: user.username,
      password: '',
      full_name: user.full_name,
      email: user.email,
      role_id: roleId,
    });

    setIsEditOpen(true);
  }

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Users</h1>
        <p className="text-muted-foreground mt-2">Manage system users and permissions</p>
      </div>

      <div className="flex gap-4 items-center">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search users..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
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
              <div className="flex gap-2 justify-end pt-4">
                <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreate}>Create</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Users</CardTitle>
          <CardDescription>
            Showing {filtered.length} on this page · {pagination.total} total in database
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableTableHead column="full_name" sort={sort} onSort={cycleSort}>Name</SortableTableHead>
                  <SortableTableHead column="username" sort={sort} onSort={cycleSort}>Username</SortableTableHead>
                  <SortableTableHead column="email" sort={sort} onSort={cycleSort}>Email</SortableTableHead>
                  <TableHead>Roles</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      No users found
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.full_name}</TableCell>
                      <TableCell className="font-mono text-sm">{user.username}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell className="capitalize">{formatRoleNames(user.roles)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-2 justify-end">
                          <Can permission={P.edit_users}>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openEdit(user)}
                            >
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
        </CardContent>
      </Card>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>Update user details and roles</DialogDescription>
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
            <Can permission={P.assign_roles}>
              <div>
                <Label>Role</Label>
                {loadingRoles ? (
                  <p className="text-sm text-muted-foreground">Loading roles...</p>
                ) : (
                  <Select value={editFormData.role_id} onValueChange={(value) => setEditFormData({ ...editFormData, role_id: value })}>
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
            <div className="flex gap-2 justify-end pt-4">
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
    </div>
  );
}

