"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { auth } from "@/lib/api";
import { useTableSorting } from "@/hooks/use-table-sorting";
import { SortableTableHead } from "@/components/data-table/sortable-table-head";

export default function RoleManagementPage() {
  const [roles, setRoles] = useState<any[]>([]);
  const [selectedRole, setSelectedRole] = useState<any | null>(null);
  const [permissions, setPermissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const { sort, cycleSort, listFilterPatch } = useTableSorting();

  const fetchRoles = useCallback(async () => {
    setLoading(true);
    try {
      const res = await auth.listRoles(listFilterPatch.sort_by, listFilterPatch.sort_order);
      setRoles(res.data);
    } catch (err) {
      toast.error("Failed to fetch roles");
    } finally {
      setLoading(false);
    }
  }, [listFilterPatch.sort_by, listFilterPatch.sort_order]);

  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

  async function fetchRolePermissions(roleId: number) {
    setLoading(true);
    try {
      const res = await auth.getRole(roleId);
      setSelectedRole(res.data);
      setPermissions(res.data.permissions || []);
      setShowDialog(true);
    } catch (err) {
      toast.error("Failed to fetch role details");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Role Management</h1>
        <p className="text-muted-foreground mt-2">Manage roles and their assigned permissions</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>All Roles</CardTitle>
        </CardHeader>
        <CardContent>
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
                {loading && roles.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : (
                  roles.map((role) => (
                    <TableRow key={role.id}>
                      <TableCell className="font-medium">{role.name}</TableCell>
                      <TableCell>{role.description}</TableCell>
                      <TableCell>{role.permissions?.length || 0}</TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="outline" onClick={() => fetchRolePermissions(role.id)}>
                          View Permissions
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Role: {selectedRole?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <strong>Description:</strong> {selectedRole?.description}
            </div>
            <div>
              <strong>Permissions:</strong>
              <ul className="list-disc ml-6 mt-2">
                {permissions.length === 0 && <li>No permissions assigned</li>}
                {permissions.map((perm: any) => (
                  <li key={perm.id || perm}>{perm.name || perm}</li>
                ))}
              </ul>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
