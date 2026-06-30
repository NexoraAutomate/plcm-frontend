'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useDataStore } from '@/lib/data-store';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTrigger, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Edit, Search } from 'lucide-react';
import { toast } from 'sonner';
import { StatusBadge } from '@/components/status-badge';
import Link from 'next/link';
import * as api from '@/lib/api';
import type { Component, Hierarchy } from '@/lib/models';
import { getInventoryQuantityByComponentId, getCount } from '@/lib/entity-counts';
import { EntityCountCell } from '@/components/entity-count-cell';
import { EntityNameWithFault } from '@/components/entity-fault-ping';
import { useEntityFaultMap } from '@/hooks/use-entity-fault-map';
import { useEntityHierarchyGate } from '@/hooks/use-ensure-hierarchy';
import { HierarchyListDashboard } from '@/components/hierarchy/hierarchy-list-dashboard';
import { ParentEntityLink } from '@/components/entity-link';
import { buildHierarchyPageUrl } from '@/lib/hierarchy-page-filters';
import {
  COMPONENTS_DASHBOARD_CONFIG,
  COMPONENT_STATUS_NAMES,
} from '@/lib/hierarchy-dashboard-configs';

export default function ComponentsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { pageLoading } = useEntityHierarchyGate();
  const { components, units, inventory, createComponent, updateComponent, deleteComponent } = useDataStore();
  const faultMap = useEntityFaultMap();
  const statusFilterParam = searchParams.get('status');
  const parentFilterParam = searchParams.get('unit_id');
  const [statusFilter, setStatusFilter] = useState<string>(statusFilterParam || 'all');
  const [parentFilter, setParentFilter] = useState<string>(parentFilterParam || 'all');
  const [search, setSearch] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [unitHierarchyNames, setUnitHierarchyNames] = useState<Hierarchy[]>([]);
  const [componentHierarchyNames, setComponentHierarchyNames] = useState<Hierarchy[]>([]);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    unit_id: 0,
  });

  useEffect(() => {
    const fetchHierarchyNames = async () => {
      try {
        const unitsRes = await api.hierarchies.list('unit');
        setUnitHierarchyNames(unitsRes.data);
      } catch (err) {
        console.error('Failed to load unit hierarchy names', err);
      }
    };

    fetchHierarchyNames();
  }, []);

  useEffect(() => {
    const fetchComponentNames = async () => {
      if (!formData.unit_id) {
        setComponentHierarchyNames([]);
        return;
      }

      const selectedUnit = units.find((u) => u.id === formData.unit_id);
      const parentHierarchyId = selectedUnit
        ? unitHierarchyNames.find((hierarchy) => hierarchy.name === selectedUnit.name)?.id
        : undefined;

      if (!parentHierarchyId) {
        setComponentHierarchyNames([]);
        return;
      }

      try {
        const res = await api.hierarchies.list('component', parentHierarchyId);
        setComponentHierarchyNames(res.data);
      } catch (err) {
        console.error('Failed to load component hierarchy names', err);
      }
    };

    fetchComponentNames();
  }, [formData.unit_id, unitHierarchyNames, units]);

  const inventoryQtyByComponent = useMemo(
    () => getInventoryQuantityByComponentId(inventory),
    [inventory]
  );

  const getStatusName = (component: Component) => component.status?.status_name || 'Unknown';

  const filtered = components.filter((c) => {
    const matchesSearch = c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.description?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || getStatusName(c) === statusFilter;
    const matchesParent =
      parentFilter === 'all' || c.unit_id?.toString() === parentFilter;
    return matchesSearch && matchesStatus && matchesParent;
  });

  const filteredParent = useMemo(
    () => (parentFilter === 'all' ? null : units.find((u) => String(u.id) === parentFilter)),
    [parentFilter, units]
  );

  const applyStatusFilter = (statusName: string) => {
    setStatusFilter(statusName);
    router.push(buildHierarchyPageUrl('/components', statusName, parentFilter, 'unit_id'));
  };

  const applyParentFilter = (parentId: string) => {
    setParentFilter(parentId);
    router.push(buildHierarchyPageUrl('/components', statusFilter, parentId, 'unit_id'));
  };

  useEffect(() => {
    setStatusFilter(statusFilterParam || 'all');
    setParentFilter(parentFilterParam || 'all');
  }, [statusFilterParam, parentFilterParam]);

  async function handleCreate() {
    if (!formData.name.trim() || !formData.unit_id) {
      toast.error('Please fill in all required fields');
      return;
    }
    try {
      await createComponent(formData);
      setFormData({ name: '', description: '', unit_id: 0 });
      setIsCreateOpen(false);
    } catch {
      // Error handled
    }
  }

  async function handleUpdate() {
    if (!editingId) return;
    if (!formData.name.trim() || !formData.unit_id) {
      toast.error('Please fill in all required fields');
      return;
    }
    try {
      await updateComponent(editingId, formData);
      setFormData({ name: '', description: '', unit_id: 0 });
      setEditingId(null);
      setIsEditOpen(false);
    } catch {
      // Error handled
    }
  }

  async function handleDelete(id: number) {
    try {
      await deleteComponent(id);
      toast.success('Component deleted successfully');
    } catch {
      toast.error('Failed to delete component');
    }
  }

  function openEdit(component: typeof components[0]) {
    setEditingId(component.id);
    setFormData({
      name: component.name,
      description: component.description,
      unit_id: component.unit_id,
    });
    setIsEditOpen(true);
  }

  useEffect(() => {
    const fetchHierarchyNames = async () => {
      try {
        const [unitRes, componentRes] = await Promise.all([
          api.hierarchies.list('unit'),
          api.hierarchies.list('component'),
        ]);
        setUnitHierarchyNames(unitRes.data);
        setComponentHierarchyNames(componentRes.data);
      } catch (err) {
        console.error('Failed to load component hierarchy names', err);
      }
    };

    fetchHierarchyNames();
  }, []);

  if (pageLoading) return <div className="p-8 text-center">Loading...</div>;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Components</h1>
        <p className="text-muted-foreground mt-2">Manage unit components and parts</p>
      </div>

      <HierarchyListDashboard
        config={COMPONENTS_DASHBOARD_CONFIG}
        items={components}
        parents={units}
        children={inventory}
        getChildParentId={(item) => item.component_id}
        getStatusName={getStatusName}
        getParentId={(component) => component.unit_id}
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
              Unit: <strong>{filteredParent.name}</strong>
            </span>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setStatusFilter('all');
              setParentFilter('all');
              router.push('/components');
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
            placeholder="Search components..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={applyStatusFilter}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {COMPONENT_STATUS_NAMES.map((name) => (
              <SelectItem key={name} value={name}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={parentFilter} onValueChange={applyParentFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filter by unit" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Units</SelectItem>
            {units.map((u) => (
              <SelectItem key={u.id} value={u.id.toString()}>
                {u.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              New Component
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Component</DialogTitle>
              <DialogDescription>Add a new component</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Choose component from hierarchy</Label>
                <Select
                  value={formData.name}
                  onValueChange={(value) => setFormData({ ...formData, name: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select component name" />
                  </SelectTrigger>
                  <SelectContent>
                    {componentHierarchyNames.map((hierarchy) => (
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
                <Label>Unit *</Label>
                <Select
                  value={formData.unit_id.toString()}
                  onValueChange={(v) => setFormData({ ...formData, unit_id: parseInt(v), name: '' })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select unit" />
                  </SelectTrigger>
                  <SelectContent>
                    {units.map((u) => (
                      <SelectItem key={u.id} value={u.id.toString()}>
                        {u.name}
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
          <CardTitle>All Components</CardTitle>
          <CardDescription>Total: {filtered.length}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Inventory Qty</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      No components found
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((component) => {
                    const unit = units.find((u) => u.id === component.unit_id);
                    return (
                      <TableRow
                        key={component.id}
                        className="cursor-pointer"
                        onClick={() => router.push(`/components/${component.id}`)}
                      >
                        <TableCell className="font-medium">
                          <EntityNameWithFault
                            name={component.name}
                            entityType="component"
                            entityId={component.id}
                            faultMap={faultMap}
                          />
                        </TableCell>
                        <TableCell>
                          {unit ? (
                            <ParentEntityLink
                              href={`/units/${unit.id}`}
                              label={unit.name}
                            />
                          ) : (
                            'N/A'
                          )}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={getStatusName(component)} />
                        </TableCell>
                        <TableCell>
                          <EntityCountCell
                            count={getCount(inventoryQtyByComponent, component.id)}
                            label="Inventory quantity"
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-2 justify-end">
                            <Link href={`/components/${component.id}`} onClick={(e) => e.stopPropagation()}>
                              <Button variant="outline" size="sm">
                                View
                              </Button>
                            </Link>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => { e.stopPropagation(); openEdit(component)}}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            {/* <ConfirmDialog
                              title="Delete Component"
                              description="Are you sure you want to delete this component?"
                              onConfirm={() => handleDelete(component.id)}
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
            <DialogTitle>Edit Component</DialogTitle>
            <DialogDescription>Update component details</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Choose component from hierarchy</Label>
              <Select
                value={formData.name}
                onValueChange={(value) => setFormData({ ...formData, name: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select component name" />
                </SelectTrigger>
                <SelectContent>
                  {componentHierarchyNames.map((hierarchy) => (
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
              <Label>Unit</Label>
              <Select
                value={formData.unit_id.toString()}
                onValueChange={(v) => setFormData({ ...formData, unit_id: parseInt(v) })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {units.map((u) => (
                    <SelectItem key={u.id} value={u.id.toString()}>
                      {u.name}
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