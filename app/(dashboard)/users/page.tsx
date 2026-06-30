'use client';

import { useEffect, useState } from 'react';
import { useDataStore } from '@/lib/data-store';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Edit, Trash2, Search, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-context';
import * as api from '@/lib/api';
import type * as Models from '@/lib/models';

export default function UsersPage() {
  const { user: currentUser } = useAuth();
  const { users, loading, createUser, updateUser, deleteUser } = useDataStore();
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
  const [usersWithRoles, setUsersWithRoles] = useState<any[]>([]);

  // Fetch available roles and user roles from API
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoadingRoles(true);

        const rolesRes = await api.auth.listRoles();
        // console.log("rolesRes OK", rolesRes.data);

        const usersRes = await api.users.usersWithRoles();
        // console.log("usersRes OK", usersRes.data);

        setRoles(rolesRes.data);
        setUsersWithRoles(usersRes.data);

      } catch (err) {
        console.error("API ERROR:", err);
        toast.error("Failed to load data");
      } finally {
        setLoadingRoles(false);
      }
    };

    fetchData();
  }, []);

  const filtered = usersWithRoles.filter(
    (u) =>
      u.full_name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      u.username.toLowerCase().includes(search.toLowerCase())
  );

  // Debug logging
  useEffect(() => {
    // console.log('Users data:', users);
    // console.log('Roles data:', roles);
  }, [users, roles]);

  // Admin-only access
  if (currentUser?.roles?.includes('Admin') === false && currentUser?.roles?.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <ShieldAlert className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold text-foreground">Access Denied</h2>
        <p className="text-sm text-muted-foreground mt-2">Only administrators can manage users</p>
      </div>
    );
  }

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
      const res = await api.auth.register(userData);
      // console.log('User registered:', res.data);
      setFormData({ username: '', password: '', full_name: '', email: '', role_id: '' });
      setIsCreateOpen(false);
      toast.success('User created successfully');
      // Smart reload: refetch users
      if (typeof window !== 'undefined') {
        window.location.reload();
      }
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

      await updateUser(editingId, userData);
      // console.log('User updated:', editingId);

      if (editFormData.role_id) {
        const roleId = parseInt(editFormData.role_id);
        await api.auth.assignRole(editingId, roleId);
        // console.log('Role assigned to user:', editingId, 'roleId:', roleId);
      }

      setEditFormData({ username: '', password: '', full_name: '', email: '', role_id: '' });
      setEditingId(null);
      setIsEditOpen(false);
      toast.success('User updated successfully');
      // Smart reload: refetch users
      if (typeof window !== 'undefined') {
        window.location.reload();
      }
    } catch (err) {
      console.error('Failed to update user:', err);
      toast.error('Failed to update user');
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('Are you sure you want to delete this user?')) return;
    try {
      await api.auth.deregister(id);
      toast.success('User deleted successfully');
      // Smart reload: refetch users
      if (typeof window !== 'undefined') {
        window.location.reload();
      }
    } catch (err) {
      console.error('Failed to delete user:', err);
      toast.error('Failed to delete user');
    }
  }

  function openEdit(user: typeof filtered[0]) {
    const firstRoleName = user.roles?.[0] || '';

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

  if (loading) return <div className="p-8 text-center">Loading...</div>;

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
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Add User
            </Button>
          </DialogTrigger>
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
          <CardDescription>Total: {filtered.length}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Username</TableHead>
                  <TableHead>Email</TableHead>
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
                      <TableCell className="capitalize">{user.roles?.join(', ') || 'No role'}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-2 justify-end">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openEdit(user)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleDelete(user.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
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
            <div className="flex gap-2 justify-end pt-4">
              <Button variant="outline" onClick={() => setIsEditOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleUpdate}>Update</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

