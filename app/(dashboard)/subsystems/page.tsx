'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useDataStore } from '@/lib/data-store';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Edit, Search } from 'lucide-react';
import { toast } from 'sonner';
import { StatusBadge } from '@/components/status-badge';
import Link from 'next/link';
import * as api from '@/lib/api';
import type { Hierarchy, Subsystem } from '@/lib/models';
import { getModuleCountBySubsystemId, getCount } from '@/lib/entity-counts';
import { EntityCountCell } from '@/components/entity-count-cell';
import { EntityNameWithFault } from '@/components/entity-fault-ping';
import { useEntityFaultMap } from '@/hooks/use-entity-fault-map';
import { useEntityHierarchyGate } from '@/hooks/use-ensure-hierarchy';
import { HierarchyListDashboard } from '@/components/hierarchy/hierarchy-list-dashboard';
import { ParentEntityLink } from '@/components/entity-link';
import { buildHierarchyPageUrl } from '@/lib/hierarchy-page-filters';
import {
  SUBSYSTEMS_DASHBOARD_CONFIG,
  SUBSYSTEM_STATUS_NAMES,
} from '@/lib/hierarchy-dashboard-configs';

export default function SubsystemsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { pageLoading } = useEntityHierarchyGate();
  const { subsystems, systems, modules, createSubsystem, updateSubsystem, deleteSubsystem } = useDataStore();
  const faultMap = useEntityFaultMap();
  const [search, setSearch] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  
  const statusFilterParam = searchParams.get('status');
  const parentFilterParam = searchParams.get('system_id');
  const [statusFilter, setStatusFilter] = useState<string>(statusFilterParam || 'all');
  const [parentFilter, setParentFilter] = useState<string>(parentFilterParam || 'all');
  const [systemHierarchyNames, setSystemHierarchyNames] = useState<Hierarchy[]>([]);
  const [subsystemHierarchyNames, setSubsystemHierarchyNames] = useState<Hierarchy[]>([]);
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    system_id: 0,
  });

  useEffect(() => {
    const fetchHierarchyNames = async () => {
      try {
        const systemsRes = await api.hierarchies.list('system');
        setSystemHierarchyNames(systemsRes.data);
      } catch (err) {
        console.error('Failed to load system hierarchy names', err);
      }
    };

    fetchHierarchyNames();
  }, []);

  useEffect(() => {
    const fetchSubsystemNames = async () => {
      if (!formData.system_id) {
        setSubsystemHierarchyNames([]);
        return;
      }

      const selectedSystem = systems.find((s) => s.id === formData.system_id);
      const parentHierarchyId = selectedSystem
        ? systemHierarchyNames.find((hierarchy) => hierarchy.name === selectedSystem.name)?.id
        : undefined;

      if (!parentHierarchyId) {
        setSubsystemHierarchyNames([]);
        return;
      }

      try {
        const res = await api.hierarchies.list('subsystem', parentHierarchyId);
        setSubsystemHierarchyNames(res.data);
      } catch (err) {
        console.error('Failed to load subsystem hierarchy names', err);
      }
    };

    fetchSubsystemNames();
  }, [formData.system_id, systemHierarchyNames, systems]);

  const moduleCountBySubsystem = useMemo(
    () => getModuleCountBySubsystemId(modules),
    [modules]
  );

  const getStatusName = (subsystem: Subsystem) => subsystem.status?.status_name || 'Unknown';

  const filtered = subsystems.filter((s) => {
    const matchesSearch = s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.description?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || getStatusName(s) === statusFilter;
    const matchesParent =
      parentFilter === 'all' || s.system_id?.toString() === parentFilter;
    return matchesSearch && matchesStatus && matchesParent;
  });

  const filteredParent = useMemo(
    () => (parentFilter === 'all' ? null : systems.find((s) => String(s.id) === parentFilter)),
    [parentFilter, systems]
  );

  const applyStatusFilter = (statusName: string) => {
    setStatusFilter(statusName);
    router.push(buildHierarchyPageUrl('/subsystems', statusName, parentFilter, 'system_id'));
  };

  const applyParentFilter = (parentId: string) => {
    setParentFilter(parentId);
    router.push(buildHierarchyPageUrl('/subsystems', statusFilter, parentId, 'system_id'));
  };

  useEffect(() => {
    setStatusFilter(statusFilterParam || 'all');
    setParentFilter(parentFilterParam || 'all');
  }, [statusFilterParam, parentFilterParam]);

  async function handleCreate() {
    if (!formData.name.trim() || !formData.system_id) {
      toast.error('Please fill in all required fields');
      return;
    }
    try {
      await createSubsystem(formData);
      setFormData({ name: '', description: '', system_id: 0 });
      setIsCreateOpen(false);
      toast.success('Subsystem created successfully');
    } catch {
      toast.error('Failed to create subsystem');
    }
  }

  async function handleUpdate() {
    if (!editingId) return;
    if (!formData.name.trim() || !formData.system_id) {
      toast.error('Please fill in all required fields');
      return;
    }
    try {
      await updateSubsystem(editingId, formData);
      setFormData({ name: '', description: '', system_id: 0 });
      setEditingId(null);
      setIsEditOpen(false);
      toast.success('Subsystem updated successfully');
    } catch {
      toast.error('Failed to update subsystem');
    }
  }

  async function handleDelete(id: number) {
    try {
      await deleteSubsystem(id);
      toast.success('Subsystem deleted successfully');
    } catch {
      toast.error('Failed to delete subsystem');
    }
  }

  function openEdit(subsystem: typeof subsystems[0]) {
    setEditingId(subsystem.id);
    setFormData({
      name: subsystem.name,
      description: subsystem.description,
      system_id: subsystem.system_id,
    });
    setIsEditOpen(true);
  }

  useEffect(() => {
    const fetchHierarchyNames = async () => {
      try {
        const [systemsRes, subsystemsRes] = await Promise.all([
          api.hierarchies.list('system'),
          api.hierarchies.list('subsystem'),
        ]);
        setSystemHierarchyNames(systemsRes.data);
        setSubsystemHierarchyNames(subsystemsRes.data);
      } catch (err) {
        console.error('Failed to load hierarchy names', err);
      }
    };

    fetchHierarchyNames();
  }, []);

  if (pageLoading) return <div className="p-8 text-center">Loading...</div>;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Subsystems</h1>
        <p className="text-muted-foreground mt-2">Manage system subsystems</p>
      </div>

      <HierarchyListDashboard
        config={SUBSYSTEMS_DASHBOARD_CONFIG}
        items={subsystems}
        parents={systems}
        children={modules}
        getChildParentId={(module) => module.subsystem_id}
        getStatusName={getStatusName}
        getParentId={(subsystem) => subsystem.system_id}
        faultMap={faultMap}
        activeStatusName={statusFilter}
        activeParentId={parentFilter}
        onStatusFilter={applyStatusFilter}
        onParentFilter={applyParentFilter}
      />

      {(statusFilter !== 'all' || parentFilter !== 'all') && (
        <div className="flex flex-wrap items-center gap-2">
          {statusFilter !== 'all' && (
            <span className="rounded-full border bg-muted px-3 py-1 text-sm">
              Status: <strong>{statusFilter}</strong>
            </span>
          )}
          {filteredParent && (
            <span className="rounded-full border bg-muted px-3 py-1 text-sm">
              System: <strong>{filteredParent.name}</strong>
            </span>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setStatusFilter('all');
              setParentFilter('all');
              router.push('/subsystems');
            }}
          >
            Clear filters
          </Button>
        </div>
      )}

      <div className="flex gap-4 items-center flex-wrap">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search subsystems..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={applyStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {SUBSYSTEM_STATUS_NAMES.map((name) => (
              <SelectItem key={name} value={name}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={parentFilter} onValueChange={applyParentFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filter by system" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Systems</SelectItem>
            {systems.map((s) => (
              <SelectItem key={s.id} value={s.id.toString()}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              New Subsystem
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Subsystem</DialogTitle>
              <DialogDescription>Add a new subsystem</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Choose subsystem from hierarchy</Label>
                <Select
                  value={formData.name}
                  onValueChange={(value) => setFormData({ ...formData, name: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select subsystem name" />
                  </SelectTrigger>
                  <SelectContent>
                    {subsystemHierarchyNames.map((hierarchy) => (
                      <SelectItem key={hierarchy.id} value={hierarchy.name}>
                        {hierarchy.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Description</Label>
                <Input
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Details"
                />
              </div>
              <div>
                <Label>System *</Label>
                <Select
                  value={formData.system_id.toString()}
                  onValueChange={(v) => setFormData({ ...formData, system_id: parseInt(v), name: '' })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select system" />
                  </SelectTrigger>
                  <SelectContent>
                    {systems.map((s) => (
                      <SelectItem key={s.id} value={s.id.toString()}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
          <CardTitle>All Subsystems</CardTitle>
          <CardDescription>Total: {filtered.length}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>System</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Modules</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      No subsystems found
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((subsystem) => {
                    const system = systems.find((s) => s.id === subsystem.system_id);
                    return (
                      <TableRow
                        key={subsystem.id}
                        className="cursor-pointer"
                        onClick={() => router.push(`/subsystems/${subsystem.id}`)}
                      >
                        <TableCell className="font-medium">
                          <EntityNameWithFault
                            name={subsystem.name}
                            entityType="subsystem"
                            entityId={subsystem.id}
                            faultMap={faultMap}
                          />
                        </TableCell>
                        <TableCell>
                          {system ? (
                            <ParentEntityLink
                              href={`/systems/${system.id}`}
                              label={system.name}
                            />
                          ) : (
                            'N/A'
                          )}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={getStatusName(subsystem)} />
                        </TableCell>
                        <TableCell>
                          <EntityCountCell
                            count={getCount(moduleCountBySubsystem, subsystem.id)}
                            label="Total modules"
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-2 justify-end">
                            <Link href={`/subsystems/${subsystem.id}`} onClick={(e) => e.stopPropagation()}>
                              <Button variant="outline" size="sm">
                                View
                              </Button>
                            </Link>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => { e.stopPropagation(); openEdit(subsystem)}}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            {/* <ConfirmDialog
                              title="Delete Subsystem"
                              description="Are you sure you want to delete this subsystem?"
                              onConfirm={() => handleDelete(subsystem.id)}
                            >
                              <Button
                                size="sm"
                                variant="destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </ConfirmDialog> */}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Subsystem</DialogTitle>
            <DialogDescription>Update subsystem details</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Choose subsystem from hierarchy</Label>
              <Select
                value={formData.name}
                onValueChange={(value) => setFormData({ ...formData, name: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select subsystem name" />
                </SelectTrigger>
                <SelectContent>
                  {subsystemHierarchyNames.map((hierarchy) => (
                    <SelectItem key={hierarchy.id} value={hierarchy.name}>
                      {hierarchy.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Description</Label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>
            <div>
              <Label>System</Label>
              <Select
                value={formData.system_id.toString()}
                onValueChange={(v) => setFormData({ ...formData, system_id: parseInt(v) })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {systems.map((s) => (
                    <SelectItem key={s.id} value={s.id.toString()}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
